/**
 * Implementation v2 — flexible, configurable stages per bank.
 *
 * Endpoints:
 *   GET    /api/v2/banks/:bankId/stages
 *   POST   /api/v2/banks/:bankId/stages
 *   POST   /api/v2/banks/:bankId/stages/reorder
 *   PATCH  /api/v2/stages/:stageId
 *   DELETE /api/v2/stages/:stageId
 *   GET    /api/v2/stages/:stageId/sub-stages
 *   POST   /api/v2/stages/:stageId/sub-stages
 *   PATCH  /api/v2/sub-stages/:subStageId
 *   DELETE /api/v2/sub-stages/:subStageId
 *   GET    /api/v2/admin/implementation-settings
 *   PATCH  /api/v2/admin/implementation-settings
 *   GET    /api/v2/implementation/summary
 */
import { Router, type IRouter } from "express";
import { and, eq, asc } from "drizzle-orm";
import { invalidateActivityCache } from "./banks";
import { eventBus } from "../lib/event-bus";
import {
  db, banksTable,
  implementationStagesTable,
  implementationSubStagesTable,
  implementationSettingsTable,
  bankImplementationProgressTable,
  IMPLEMENTATION_STAGE_LABELS,
  DEFAULT_STAGE_NAMES,
} from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

type Stage = typeof implementationStagesTable.$inferSelect;

/** Load all implementation settings in one query, return as a keyed map */
async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(implementationSettingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** Load the percentage mode from settings (default: dynamic) */
async function getPercentageMode(): Promise<"dynamic" | "fixed"> {
  const s = await getAllSettings();
  return (s["percentage_mode"] ?? "dynamic") as "dynamic" | "fixed";
}

/** Load default stage names from settings (falls back to hardcoded list) */
async function getDefaultStageNames(): Promise<string[]> {
  const s = await getAllSettings();
  if (!s["default_stages"]) return DEFAULT_STAGE_NAMES;
  try { return JSON.parse(s["default_stages"]); } catch { return DEFAULT_STAGE_NAMES; }
}

/** Compute effective percentage & derived rollup from a set of stages */
function computeDerivedV2(stages: Stage[], mode: "dynamic" | "fixed") {
  const nonSkipped = stages.filter((s) => !s.skipped);
  const denominator = mode === "dynamic" ? nonSkipped.length : stages.length;
  const equalShare = denominator > 0 ? 100 / denominator : 0;

  const stagesOut = stages.map((s) => ({
    ...s,
    percentage: s.skipped ? 0 : equalShare,
    completedAt: s.completedAt ?? null,
    owner: s.owner ?? null,
    notes: s.notes ?? null,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    daysInProgress:
      s.status === "in_progress"
        ? Math.floor((Date.now() - new Date(s.updatedAt).getTime()) / 86_400_000)
        : null,
  }));

  const completedCount = nonSkipped.filter((s) => s.completed).length;
  // Dynamic: denominator = non-skipped count  → skipped stages excluded entirely
  // Fixed:   denominator = total stage count  → skipped stages hold 0% but reduce max achievable
  const completionPercentage =
    denominator > 0
      ? Math.round((completedCount / denominator) * 1000) / 10
      : 0;

  const currentStage =
    stagesOut.find((s) => s.status === "in_progress" && !s.skipped) ??
    stagesOut.find((s) => s.status === "not_started" && !s.skipped);

  return {
    stages: stagesOut,
    completionPercentage,
    completedStages: completedCount,
    remainingStages: nonSkipped.filter((s) => !s.completed).length,
    skippedStages: stages.filter((s) => s.skipped).length,
    totalStages: stages.length,
    currentStageId: currentStage?.id ?? null,
    currentStageName: currentStage?.name ?? null,
    isBlocked: stages.some((s) => s.status === "blocked" && !s.skipped),
    percentageMode: mode,
  };
}

/** Seed a bank's stages from the admin template, backfilling any existing v1 progress */
async function seedBankStages(bankId: string): Promise<void> {
  const names = await getDefaultStageNames();

  // Load any existing v1 progress rows so we can pre-populate status/completed/etc.
  const v1Rows = await db
    .select()
    .from(bankImplementationProgressTable)
    .where(eq(bankImplementationProgressTable.bankId, bankId));

  // Build a label→v1row map so we can match by display name
  const byLabel = new Map(
    v1Rows.map((r) => [IMPLEMENTATION_STAGE_LABELS[r.stage] ?? r.stage, r])
  );

  await db.insert(implementationStagesTable).values(
    names.map((name, idx) => {
      const prior = byLabel.get(name);
      return {
        bankId,
        name,
        displayOrder: idx,
        status: prior?.status ?? "not_started",
        completed: prior?.completed ?? false,
        completedAt: prior?.completedAt ?? null,
        owner: prior?.owner ?? null,
        notes: prior?.notes ?? null,
      };
    })
  );
}

// ── Dashboard summary (v2) ────────────────────────────────────────────────────

router.get("/v2/implementation/summary", requirePermission("dashboard_access"), async (_req, res): Promise<void> => {
  const [activeBanks, allStages, mode] = await Promise.all([
    db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.isArchived, false)),
    db.select().from(implementationStagesTable).orderBy(asc(implementationStagesTable.displayOrder)),
    getPercentageMode(),
  ]);

  // Build a set of bank IDs that already have v2 rows
  const seededBankIds = new Set(allStages.map((s) => s.bankId));

  // Seed any bank that has no v2 rows yet (backfills from v1 progress data)
  const unseeded = activeBanks.filter(({ id }) => !seededBankIds.has(id));
  if (unseeded.length > 0) {
    await Promise.all(unseeded.map(({ id }) => seedBankStages(id)));
  }

  // Reload all stages after seeding (cheap because seeding is rare after first run)
  const finalStages = unseeded.length > 0
    ? await db.select().from(implementationStagesTable).orderBy(asc(implementationStagesTable.displayOrder))
    : allStages;

  const byBank = new Map<string, Stage[]>();
  for (const s of finalStages) {
    if (!byBank.has(s.bankId)) byBank.set(s.bankId, []);
    byBank.get(s.bankId)!.push(s);
  }

  const summary = activeBanks.map(({ id }) => {
    const stages = byBank.get(id) ?? [];
    if (stages.length === 0) {
      // Should not happen after seeding, but guard defensively
      return { bankId: id, completionPercentage: 0, completedStages: 0, remainingStages: 0, skippedStages: 0, totalStages: 0, currentStageId: null, currentStageName: null, isBlocked: false, percentageMode: mode };
    }
    const { stages: _, ...derived } = computeDerivedV2(stages, mode);
    return { bankId: id, ...derived };
  });

  res.json(summary);
});

// ── Stages CRUD ───────────────────────────────────────────────────────────────

/** GET /api/v2/banks/:bankId/stages */
router.get("/v2/banks/:bankId/stages", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const [bank] = await db.select({ id: banksTable.id }).from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }

  let stages = await db.select().from(implementationStagesTable)
    .where(eq(implementationStagesTable.bankId, bankId))
    .orderBy(asc(implementationStagesTable.displayOrder));

  if (stages.length === 0) { await seedBankStages(bankId); stages = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.bankId, bankId)).orderBy(asc(implementationStagesTable.displayOrder)); }

  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

/** POST /api/v2/banks/:bankId/stages */
router.post("/v2/banks/:bankId/stages", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const [bank] = await db.select({ id: banksTable.id }).from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }

  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const existing = await db.select({ ord: implementationStagesTable.displayOrder })
    .from(implementationStagesTable).where(eq(implementationStagesTable.bankId, bankId))
    .orderBy(asc(implementationStagesTable.displayOrder));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.ord)) + 1 : 0;

  await db.insert(implementationStagesTable).values({ bankId, name: name.trim(), displayOrder: maxOrder });

  await logAudit(req, { action: "CREATE", entityType: "impl_stage_v2", entityId: bankId, entityLabel: name.trim(), details: { bankId } });

  const stages = await db.select().from(implementationStagesTable)
    .where(eq(implementationStagesTable.bankId, bankId)).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.status(201).json(computeDerivedV2(stages, mode));
});

/** POST /api/v2/banks/:bankId/stages/reorder — body: { orderedIds: number[] } */
router.post("/v2/banks/:bankId/stages/reorder", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const { orderedIds } = req.body as { orderedIds?: number[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: "orderedIds must be a non-empty array" }); return;
  }

  // Update display_order for each id in the given order
  await Promise.all(
    orderedIds.map((id, idx) =>
      db.update(implementationStagesTable)
        .set({ displayOrder: idx, updatedAt: new Date() })
        .where(and(eq(implementationStagesTable.id, id), eq(implementationStagesTable.bankId, bankId)))
    )
  );

  await logAudit(req, { action: "UPDATE", entityType: "impl_stage_v2", entityId: bankId, entityLabel: "stages reordered", details: { orderedIds } });

  const stages = await db.select().from(implementationStagesTable)
    .where(eq(implementationStagesTable.bankId, bankId)).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

/** PATCH /api/v2/stages/:stageId */
router.patch("/v2/stages/:stageId", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }

  const VALID_STATUSES = new Set(["not_started", "in_progress", "completed", "skipped", "blocked"]);
  const { name, status, skipped, completed, completedAt, owner, notes } = req.body as Record<string, any>;

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: `Invalid status '${status}'` }); return;
  }
  if (completedAt && !/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) {
    res.status(400).json({ error: "completedAt must be YYYY-MM-DD" }); return;
  }

  const [existing] = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  if (!existing) { res.status(404).json({ error: "Stage not found" }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) update.name = String(name).trim();
  if (status !== undefined) update.status = status;
  if (skipped !== undefined) {
    update.skipped = Boolean(skipped);
    if (skipped) { update.status = "skipped"; } // force status sync
  }
  if (completed !== undefined) {
    update.completed = Boolean(completed);
    if (completed && !completedAt) update.completedAt = new Date().toISOString().split("T")[0];
    if (completed) update.status = "completed";
  }
  if (completedAt !== undefined) update.completedAt = completedAt;
  if (owner !== undefined) update.owner = owner;
  if (notes !== undefined) update.notes = notes;

  await db.update(implementationStagesTable).set(update as any).where(eq(implementationStagesTable.id, stageId));
  await logAudit(req, { action: "UPDATE", entityType: "impl_stage_v2", entityId: `${existing.bankId}:${stageId}`, entityLabel: existing.name, details: update });
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: existing.bankId });

  const stages = await db.select().from(implementationStagesTable)
    .where(eq(implementationStagesTable.bankId, existing.bankId)).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

/** DELETE /api/v2/stages/:stageId */
router.delete("/v2/stages/:stageId", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }

  const [existing] = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  if (!existing) { res.status(404).json({ error: "Stage not found" }); return; }

  await db.delete(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  await logAudit(req, { action: "ARCHIVE", entityType: "impl_stage_v2", entityId: `${existing.bankId}:${stageId}`, entityLabel: existing.name, details: {} });
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: existing.bankId });

  const stages = await db.select().from(implementationStagesTable)
    .where(eq(implementationStagesTable.bankId, existing.bankId)).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

// ── Sub-stages ────────────────────────────────────────────────────────────────

/** GET /api/v2/stages/:stageId/sub-stages */
router.get("/v2/stages/:stageId/sub-stages", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  const subs = await db.select().from(implementationSubStagesTable)
    .where(eq(implementationSubStagesTable.stageId, stageId))
    .orderBy(asc(implementationSubStagesTable.displayOrder));
  res.json(subs);
});

/** POST /api/v2/stages/:stageId/sub-stages */
router.post("/v2/stages/:stageId/sub-stages", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const existing = await db.select({ ord: implementationSubStagesTable.displayOrder })
    .from(implementationSubStagesTable).where(eq(implementationSubStagesTable.stageId, stageId));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.ord)) + 1 : 0;

  const [created] = await db.insert(implementationSubStagesTable)
    .values({ stageId, name: name.trim(), displayOrder: maxOrder }).returning();
  res.status(201).json(created);
});

/** PATCH /api/v2/sub-stages/:subStageId */
router.patch("/v2/sub-stages/:subStageId", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const subId = parseInt(req.params.subStageId as string, 10);
  if (isNaN(subId)) { res.status(400).json({ error: "Invalid subStageId" }); return; }

  const VALID = new Set(["not_started", "in_progress", "completed", "skipped", "blocked"]);
  const { name, status, skipped, completed, completedAt, owner, notes } = req.body as Record<string, any>;
  if (status !== undefined && !VALID.has(status)) { res.status(400).json({ error: `Invalid status '${status}'` }); return; }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = String(name).trim();
  if (status !== undefined) update.status = status;
  if (skipped !== undefined) { update.skipped = Boolean(skipped); if (skipped) update.status = "skipped"; }
  if (completed !== undefined) { update.completed = Boolean(completed); if (completed) { update.status = "completed"; if (!completedAt) update.completedAt = new Date().toISOString().split("T")[0]; } }
  if (completedAt !== undefined) update.completedAt = completedAt;
  if (owner !== undefined) update.owner = owner;
  if (notes !== undefined) update.notes = notes;

  const [updated] = await db.update(implementationSubStagesTable).set(update as any).where(eq(implementationSubStagesTable.id, subId)).returning();
  if (!updated) { res.status(404).json({ error: "Sub-stage not found" }); return; }

  // Find bankId via the parent stage so we can invalidate the activity cache
  const [parentStage] = await db.select({ bankId: implementationStagesTable.bankId })
    .from(implementationStagesTable).where(eq(implementationStagesTable.id, updated.stageId));
  if (parentStage) {
    invalidateActivityCache();
    eventBus.emit("bank_updated", { bankId: parentStage.bankId });
  }
  res.json(updated);
});

/** DELETE /api/v2/sub-stages/:subStageId */
router.delete("/v2/sub-stages/:subStageId", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const subId = parseInt(req.params.subStageId as string, 10);
  if (isNaN(subId)) { res.status(400).json({ error: "Invalid subStageId" }); return; }
  await db.delete(implementationSubStagesTable).where(eq(implementationSubStagesTable.id, subId));
  res.status(204).send();
});

// ── Admin settings ────────────────────────────────────────────────────────────

/** GET /api/v2/admin/implementation-settings */
router.get("/v2/admin/implementation-settings", requirePermission("user_management"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(implementationSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  // Ensure defaults
  settings.percentage_mode = settings.percentage_mode ?? "dynamic";
  settings.default_stages = settings.default_stages ?? JSON.stringify(DEFAULT_STAGE_NAMES);
  res.json(settings);
});

/** PATCH /api/v2/admin/implementation-settings */
router.patch("/v2/admin/implementation-settings", requirePermission("user_management"), async (req, res): Promise<void> => {
  const allowed = new Set(["percentage_mode", "default_stages"]);
  const updates = req.body as Record<string, string>;

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) continue;
    if (key === "percentage_mode" && !["dynamic", "fixed"].includes(value)) {
      res.status(400).json({ error: "percentage_mode must be 'dynamic' or 'fixed'" }); return;
    }
    await db
      .insert(implementationSettingsTable)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: implementationSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }

  await logAudit(req, { action: "UPDATE", entityType: "implementation_settings", entityId: "global", entityLabel: "Implementation Settings", details: updates });

  const rows = await db.select().from(implementationSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

export default router;

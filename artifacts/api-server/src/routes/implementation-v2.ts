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
import { and, eq, asc, isNull } from "drizzle-orm";
import { invalidateActivityCache } from "./banks";
import { eventBus } from "../lib/event-bus";
import {
  db, banksTable, productsTable, productStagesTable, productPhaseHistoryTable,
  implementationStagesTable,
  implementationSubStagesTable,
  implementationSettingsTable,
  ndaStatusHistoryTable,
  agreementStatusHistoryTable,
  agreementCommentsTable,
  bankImplementationProgressTable,
  IMPLEMENTATION_STAGE_LABELS,
  DEFAULT_STAGE_NAMES,
  TECHNICAL_STAGE_NAMES,
  type ImplementationTrackType,
} from "@workspace/db";
import { requireAuth, requirePermission, requireRole } from "../middlewares/auth";
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
  try {
    const parsed = JSON.parse(s["default_stages"]);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STAGE_NAMES;
  } catch { return DEFAULT_STAGE_NAMES; }
}

/** Compute effective percentage & derived rollup from a set of stages */
function computeDerivedV2(stages: Stage[], mode: "dynamic" | "fixed") {
  const nonSkipped = stages.filter((s) => !s.skipped);
  const denominator = mode === "dynamic" ? nonSkipped.length : stages.length;
  const equalShare = denominator > 0 ? 100 / denominator : 0;

  const stagesOut = stages.map((s) => {
    const endDate = s.completedAt ?? (s.startedAt && s.status === "in_progress" ? new Date().toISOString().split("T")[0] : null);
    const actualDays = s.startedAt && endDate
      ? Math.max(0, Math.floor((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${s.startedAt}T00:00:00Z`).getTime()) / 86_400_000))
      : null;
    return ({
    ...s,
    percentage: s.skipped ? 0 : equalShare,
    completedAt: s.completedAt ?? null,
    startedAt: s.startedAt ?? null,
    plannedDays: s.plannedDays ?? null,
    actualDays,
    varianceDays: actualDays !== null && s.plannedDays !== null ? actualDays - s.plannedDays : null,
    owner: s.owner ?? null,
    notes: s.notes ?? null,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    daysInProgress:
      s.status === "in_progress"
        ? actualDays
        : null,
    });
  });

  const completedCount = nonSkipped.filter((s) => s.completed).length;
  // Dynamic: denominator = non-skipped count  → skipped stages excluded entirely
  // Fixed:   denominator = total stage count  → skipped stages hold 0% but reduce max achievable
  const completionPercentage =
    denominator > 0
      ? Math.round((completedCount / denominator) * 1000) / 10
      : 0;

  const currentStage =
    stagesOut.find((s) => s.status === "in_progress" && !s.skipped) ??
    stagesOut.find((s) => !s.completed && !s.skipped);

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
async function seedBankStages(bankId: string, trackType: ImplementationTrackType = "business", productId?: number): Promise<void> {
  const names = trackType === "technical" ? TECHNICAL_STAGE_NAMES : await getDefaultStageNames();

  // Load any existing v1 progress rows so we can pre-populate status/completed/etc.
  const v1Rows = trackType === "business" && !productId ? await db
    .select()
    .from(bankImplementationProgressTable)
    .where(eq(bankImplementationProgressTable.bankId, bankId)) : [];

  // Build a label→v1row map so we can match by display name
  const byLabel = new Map(
    v1Rows.map((r) => [IMPLEMENTATION_STAGE_LABELS[r.stage] ?? r.stage, r])
  );
  const priorProductStages = productId && trackType === "technical"
    ? await db.select().from(productStagesTable).where(eq(productStagesTable.productId, productId))
    : [];
  const productStageByName = new Map(priorProductStages.map((stage) => [stage.name, stage]));

  await db.insert(implementationStagesTable).values(
    names.map((name, idx) => {
      const prior = byLabel.get(name);
      const priorProductStage = productStageByName.get(name);
      return {
        bankId,
        productId: productId ?? null,
        trackType,
        activityType: trackType === "business" && name.trim().toLowerCase() === "nda" ? "nda" : trackType === "business" && name.trim().toLowerCase() === "agreement" ? "commercial_agreement" : "standard",
        name,
        displayOrder: idx,
        status: priorProductStage?.completed ? "completed" : priorProductStage?.isCurrent ? "in_progress" : prior?.status ?? "not_started",
        completed: priorProductStage?.completed ?? prior?.completed ?? false,
        completedAt: priorProductStage?.completedAt?.toISOString().split("T")[0] ?? prior?.completedAt ?? null,
        owner: prior?.owner ?? null,
        notes: prior?.notes ?? null,
      };
    })
  ).onConflictDoNothing();
}

// ── Dashboard summary (v2) ────────────────────────────────────────────────────

router.get("/v2/implementation/summary", requirePermission("dashboard_access"), async (_req, res): Promise<void> => {
  const [activeBanks, allStages, allBusinessStages, allProducts, mode] = await Promise.all([
    db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.isArchived, false)),
    db.select().from(implementationStagesTable)
      .where(and(eq(implementationStagesTable.trackType, "business"), isNull(implementationStagesTable.productId)))
      .orderBy(asc(implementationStagesTable.displayOrder)),
    db.select().from(implementationStagesTable)
      .where(eq(implementationStagesTable.trackType, "business")),
    db.select({ id: productsTable.id, bankId: productsTable.bankId, productCode: productsTable.productCode }).from(productsTable),
    getPercentageMode(),
  ]);

  const ndaByBank = new Map<string, Stage>();
  for (const stage of allBusinessStages.filter((s) => s.name.trim().toLowerCase() === "nda")) {
    const current = ndaByBank.get(stage.bankId);
    const stageIsProduct = stage.productId !== null;
    const currentIsProduct = current?.productId !== null;
    if (!current || (stageIsProduct && !currentIsProduct) || (stageIsProduct === currentIsProduct && new Date(stage.updatedAt).getTime() > new Date(current.updatedAt).getTime())) {
      ndaByBank.set(stage.bankId, stage);
    }
  }
  const agreementByBank = new Map<string, Stage>();
  for (const stage of allBusinessStages.filter((s) => s.name.trim().toLowerCase() === "agreement")) {
    const current = agreementByBank.get(stage.bankId);
    const stageIsProduct = stage.productId !== null;
    const currentIsProduct = current?.productId !== null;
    if (!current || (stageIsProduct && !currentIsProduct) || (stageIsProduct === currentIsProduct && new Date(stage.updatedAt).getTime() > new Date(current.updatedAt).getTime())) {
      agreementByBank.set(stage.bankId, stage);
    }
  }

  // Build a set of bank IDs that already have v2 rows
  const seededBankIds = new Set(allStages.map((s) => s.bankId));

  // Seed any bank that has no v2 rows yet (backfills from v1 progress data)
  const unseeded = activeBanks.filter(({ id }) => !seededBankIds.has(id));
  if (unseeded.length > 0) {
    await Promise.all(unseeded.map(({ id }) => seedBankStages(id, "business")));
  }

  // Reload all stages after seeding (cheap because seeding is rare after first run)
  const finalStages = unseeded.length > 0
    ? await db.select().from(implementationStagesTable)
      .where(and(eq(implementationStagesTable.trackType, "business"), isNull(implementationStagesTable.productId)))
      .orderBy(asc(implementationStagesTable.displayOrder))
    : allStages;

  const byBank = new Map<string, Stage[]>();
  for (const s of finalStages) {
    if (!byBank.has(s.bankId)) byBank.set(s.bankId, []);
    byBank.get(s.bankId)!.push(s);
  }

  const summary = activeBanks.map(({ id }) => {
    const stages = byBank.get(id) ?? [];
    const nda = ndaByBank.get(id);
    const agreement = agreementByBank.get(id);
    const ndaSummary = {
      ndaStatus: nda?.status ?? null,
      ndaOwner: nda?.owner ?? null,
      ndaUpdatedAt: nda ? (nda.updatedAt instanceof Date ? nda.updatedAt.toISOString() : nda.updatedAt) : null,
    };
    const agreementSummary = {
      agreementStatus: agreement?.status ?? null,
      agreementOwner: agreement?.owner ?? null,
      agreementUpdatedAt: agreement ? (agreement.updatedAt instanceof Date ? agreement.updatedAt.toISOString() : agreement.updatedAt) : null,
    };
    const customAgreementActivities = allBusinessStages.filter((stage) => stage.bankId === id && stage.activityType === "custom_agreement" && stage.productId !== null);
    const agreementActivitiesSummary = {
      agreementActivitiesTotal: customAgreementActivities.length,
      agreementActivitiesCompleted: customAgreementActivities.filter((stage) => stage.completed).length,
    };
    const legalStatuses = allProducts.filter((product) => product.bankId === id).map((product) => {
      const productStages = allBusinessStages.filter((stage) => stage.productId === product.id);
      const ndaStage = productStages.find((stage) => stage.name.trim().toLowerCase() === "nda");
      const agreementStage = productStages.find((stage) => stage.name.trim().toLowerCase() === "agreement");
      return {
        productId: product.id,
        productCode: product.productCode,
        ndaStatus: ndaStage?.status ?? null,
        ndaOwner: ndaStage?.owner ?? null,
        ndaUpdatedAt: ndaStage ? (ndaStage.updatedAt instanceof Date ? ndaStage.updatedAt.toISOString() : ndaStage.updatedAt) : null,
        agreementStatus: agreementStage?.status ?? null,
        agreementOwner: agreementStage?.owner ?? null,
        agreementUpdatedAt: agreementStage ? (agreementStage.updatedAt instanceof Date ? agreementStage.updatedAt.toISOString() : agreementStage.updatedAt) : null,
      };
    });
    if (stages.length === 0) {
      // Should not happen after seeding, but guard defensively
      return { bankId: id, completionPercentage: 0, completedStages: 0, remainingStages: 0, skippedStages: 0, totalStages: 0, currentStageId: null, currentStageName: null, isBlocked: false, percentageMode: mode, ...ndaSummary, ...agreementSummary, ...agreementActivitiesSummary, legalStatuses };
    }
    const { stages: _, ...derived } = computeDerivedV2(stages, mode);
    return { bankId: id, ...derived, ...ndaSummary, ...agreementSummary, ...agreementActivitiesSummary, legalStatuses };
  });

  res.json(summary);
});

// ── Stages CRUD ───────────────────────────────────────────────────────────────

/** GET /api/v2/banks/:bankId/stages */
router.get("/v2/banks/:bankId/stages", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const trackType: ImplementationTrackType = req.query.track === "technical" ? "technical" : "business";
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const [bank] = await db.select({ id: banksTable.id }).from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }
  if (productId) {
    const [product] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.bankId, bankId)));
    if (!product) { res.status(404).json({ error: "Product not found for bank" }); return; }
  }

  let stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId)))
    .orderBy(asc(implementationStagesTable.displayOrder));

  if (stages.length === 0) {
    await seedBankStages(bankId, trackType, productId);
    stages = await db.select().from(implementationStagesTable)
      .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId)))
      .orderBy(asc(implementationStagesTable.displayOrder));
  }

  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

router.post("/v2/banks/:bankId/stages/advance", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const trackType: ImplementationTrackType = req.query.track === "technical" ? "technical" : "business";
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "productId is required" }); return; }

  let stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.productId, productId), eq(implementationStagesTable.trackType, trackType)))
    .orderBy(asc(implementationStagesTable.displayOrder));
  if (stages.length === 0) {
    await seedBankStages(bankId, trackType, productId);
    stages = await db.select().from(implementationStagesTable)
      .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.productId, productId), eq(implementationStagesTable.trackType, trackType)))
      .orderBy(asc(implementationStagesTable.displayOrder));
  }

  const currentIndex = stages.findIndex((stage) => stage.status === "in_progress") >= 0
    ? stages.findIndex((stage) => stage.status === "in_progress")
    : stages.findIndex((stage) => !stage.completed && !stage.skipped);
  if (currentIndex < 0) { res.status(409).json({ error: "All phases are already complete" }); return; }

  const current = stages[currentIndex];
  const next = stages.slice(currentIndex + 1).find((stage) => !stage.skipped);
  await db.transaction(async (tx) => {
    const today = new Date().toISOString().split("T")[0];
    await tx.update(implementationStagesTable).set({ status: "completed", completed: true, startedAt: current.startedAt ?? today, completedAt: today, updatedAt: new Date() })
      .where(eq(implementationStagesTable.id, current.id));
    if (current.name.trim().toLowerCase() === "nda") {
      await tx.insert(ndaStatusHistoryTable).values({ stageId: current.id, fromStatus: current.status, toStatus: "completed", changedById: req.authUser?.id ?? null, changedByName: req.authUser?.name ?? null });
    }
    if (current.name.trim().toLowerCase() === "agreement") {
      await tx.insert(agreementStatusHistoryTable).values({ stageId: current.id, fromStatus: current.status, toStatus: "completed", changedById: req.authUser?.id ?? null, changedByName: req.authUser?.name ?? null });
    }
    if (next) {
      await tx.update(implementationStagesTable).set({ status: "in_progress", completed: false, startedAt: next.startedAt ?? today, completedAt: null, updatedAt: new Date() })
        .where(eq(implementationStagesTable.id, next.id));
      if (next.name.trim().toLowerCase() === "nda") {
        await tx.insert(ndaStatusHistoryTable).values({ stageId: next.id, fromStatus: next.status, toStatus: "in_progress", changedById: req.authUser?.id ?? null, changedByName: req.authUser?.name ?? null });
      }
      if (next.name.trim().toLowerCase() === "agreement") {
        await tx.insert(agreementStatusHistoryTable).values({ stageId: next.id, fromStatus: next.status, toStatus: "in_progress", changedById: req.authUser?.id ?? null, changedByName: req.authUser?.name ?? null });
      }
    }
    const completedCount = stages.filter((stage, index) => stage.completed || index === currentIndex).length;
    await tx.update(productsTable).set({
      categoryStage: next?.name ?? current.name,
      progressPercent: completedCount / stages.filter((stage) => !stage.skipped).length,
      trackType,
      updatedAt: new Date(),
    }).where(and(eq(productsTable.id, productId), eq(productsTable.bankId, bankId)));
    await tx.insert(productPhaseHistoryTable).values({
      productId,
      fromStageName: current.name,
      toStageName: next?.name ?? "Completed",
      changedById: req.authUser?.id ?? null,
      changedByName: req.authUser?.name ?? null,
    });
  });

  const updated = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.productId, productId), eq(implementationStagesTable.trackType, trackType)))
    .orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(updated, mode));
});

/** POST /api/v2/banks/:bankId/stages */
router.post("/v2/banks/:bankId/stages", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const trackType: ImplementationTrackType = req.query.track === "technical" ? "technical" : "business";
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const [bank] = await db.select({ id: banksTable.id }).from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }

  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const existing = await db.select({ ord: implementationStagesTable.displayOrder })
    .from(implementationStagesTable).where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId)))
    .orderBy(asc(implementationStagesTable.displayOrder));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.ord)) + 1 : 0;

  await db.insert(implementationStagesTable).values({ bankId, productId: productId ?? null, trackType, name: name.trim(), displayOrder: maxOrder });

  await logAudit(req, { action: "CREATE", entityType: "impl_stage_v2", entityId: bankId, entityLabel: name.trim(), details: { bankId } });

  const stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId))).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.status(201).json(computeDerivedV2(stages, mode));
});

router.post("/v2/banks/:bankId/agreement-activities", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const productId = Number(req.query.productId);
  const name = String(req.body?.name ?? "").trim();
  const owner = String(req.body?.owner ?? "").trim() || null;
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "productId is required" }); return; }
  if (!name) { res.status(400).json({ error: "Activity name is required" }); return; }
  const [product] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.bankId, bankId)));
  if (!product) { res.status(404).json({ error: "Product not found for bank" }); return; }
  const existing = await db.select({ ord: implementationStagesTable.displayOrder }).from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.productId, productId), eq(implementationStagesTable.trackType, "business")));
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((row) => row.ord)) + 1 : 0;
  await db.insert(implementationStagesTable).values({ bankId, productId, trackType: "business", activityType: "custom_agreement", name, owner, displayOrder: maxOrder });
  await logAudit(req, { action: "CREATE", entityType: "agreement_activity", entityId: `${bankId}:${productId}`, entityLabel: name, details: { bankId, productId, owner } });
  const stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.productId, productId), eq(implementationStagesTable.trackType, "business")))
    .orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.status(201).json(computeDerivedV2(stages, mode));
});

/** POST /api/v2/banks/:bankId/stages/reorder — body: { orderedIds: number[] } */
router.post("/v2/banks/:bankId/stages/reorder", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const bankId = req.params.bankId as string;
  const trackType: ImplementationTrackType = req.query.track === "technical" ? "technical" : "business";
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const { orderedIds } = req.body as { orderedIds?: number[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: "orderedIds must be a non-empty array" }); return;
  }

  // Update display_order for each id in the given order
  await Promise.all(
    orderedIds.map((id, idx) =>
      db.update(implementationStagesTable)
        .set({ displayOrder: idx, updatedAt: new Date() })
        .where(and(eq(implementationStagesTable.id, id), eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId)))
    )
  );

  await logAudit(req, { action: "UPDATE", entityType: "impl_stage_v2", entityId: bankId, entityLabel: "stages reordered", details: { orderedIds } });

  const stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, bankId), eq(implementationStagesTable.trackType, trackType), productId ? eq(implementationStagesTable.productId, productId) : isNull(implementationStagesTable.productId))).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

/** PATCH /api/v2/stages/:stageId */
router.patch("/v2/stages/:stageId", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }

  const VALID_STATUSES = new Set(["not_started", "in_progress", "under_review", "completed", "on_hold", "skipped", "blocked"]);
  const { name, status, skipped, completed, startedAt, completedAt, plannedDays, owner, notes } = req.body as Record<string, any>;

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: `Invalid status '${status}'` }); return;
  }
  if (completedAt && !/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) {
    res.status(400).json({ error: "completedAt must be YYYY-MM-DD" }); return;
  }
  if (startedAt && !/^\d{4}-\d{2}-\d{2}$/.test(startedAt)) {
    res.status(400).json({ error: "startedAt must be YYYY-MM-DD" }); return;
  }
  if (plannedDays !== undefined && plannedDays !== null && (!Number.isInteger(Number(plannedDays)) || Number(plannedDays) < 0)) {
    res.status(400).json({ error: "plannedDays must be a non-negative whole number" }); return;
  }

  const [existing] = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  if (!existing) { res.status(404).json({ error: "Stage not found" }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) update.name = String(name).trim();
  if (status !== undefined) update.status = status;
  if (status === "in_progress" && !startedAt && !existing.startedAt) update.startedAt = new Date().toISOString().split("T")[0];
  if (skipped !== undefined) {
    update.skipped = Boolean(skipped);
    if (skipped) { update.status = "skipped"; } // force status sync
  }
  if (completed !== undefined) {
    update.completed = Boolean(completed);
    if (completed && !completedAt) update.completedAt = new Date().toISOString().split("T")[0];
    if (completed && !startedAt && !existing.startedAt) update.startedAt = new Date().toISOString().split("T")[0];
    if (completed) update.status = "completed";
  }
  if (startedAt !== undefined) update.startedAt = startedAt;
  if (completedAt !== undefined) update.completedAt = completedAt;
  if (plannedDays !== undefined) update.plannedDays = plannedDays === null ? null : Number(plannedDays);
  if (owner !== undefined) update.owner = owner;
  if (notes !== undefined) update.notes = notes;

  await db.transaction(async (tx) => {
    await tx.update(implementationStagesTable).set(update as any).where(eq(implementationStagesTable.id, stageId));
    if (existing.name.trim().toLowerCase() === "nda" && status !== undefined && status !== existing.status) {
      await tx.insert(ndaStatusHistoryTable).values({
        stageId,
        fromStatus: existing.status,
        toStatus: status,
        changedById: req.authUser?.id ?? null,
        changedByName: req.authUser?.name ?? null,
      });
    }
    if (existing.name.trim().toLowerCase() === "agreement" && status !== undefined && status !== existing.status) {
      await tx.insert(agreementStatusHistoryTable).values({
        stageId,
        fromStatus: existing.status,
        toStatus: status,
        changedById: req.authUser?.id ?? null,
        changedByName: req.authUser?.name ?? null,
      });
    }
  });
  await logAudit(req, { action: "UPDATE", entityType: "impl_stage_v2", entityId: `${existing.bankId}:${stageId}`, entityLabel: existing.name, details: update });
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: existing.bankId });

  const stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, existing.bankId), eq(implementationStagesTable.trackType, existing.trackType), existing.productId ? eq(implementationStagesTable.productId, existing.productId) : isNull(implementationStagesTable.productId))).orderBy(asc(implementationStagesTable.displayOrder));
  const mode = await getPercentageMode();
  res.json(computeDerivedV2(stages, mode));
});

router.get("/v2/stages/:stageId/nda-history", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  const history = await db.select().from(ndaStatusHistoryTable)
    .where(eq(ndaStatusHistoryTable.stageId, stageId))
    .orderBy(asc(ndaStatusHistoryTable.changedAt));
  res.json(history);
});

router.get("/v2/stages/:stageId/agreement-history", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  const history = await db.select().from(agreementStatusHistoryTable)
    .where(eq(agreementStatusHistoryTable.stageId, stageId))
    .orderBy(asc(agreementStatusHistoryTable.changedAt));
  res.json(history);
});

router.get("/v2/stages/:stageId/agreement-comments", requirePermission("dashboard_access"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  const comments = await db.select().from(agreementCommentsTable)
    .where(eq(agreementCommentsTable.stageId, stageId))
    .orderBy(asc(agreementCommentsTable.createdAt));
  res.json(comments);
});

router.post("/v2/stages/:stageId/agreement-comments", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  const body = String(req.body?.body ?? "").trim();
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }
  if (!body) { res.status(400).json({ error: "Comment is required" }); return; }
  const [stage] = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  if (!stage || stage.name.trim().toLowerCase() !== "agreement") { res.status(404).json({ error: "Agreement stage not found" }); return; }
  const [created] = await db.insert(agreementCommentsTable).values({ stageId, body, authorId: req.authUser?.id ?? null, authorName: req.authUser?.name ?? null }).returning();
  await logAudit(req, { action: "CREATE", entityType: "agreement_comment", entityId: String(created.id), entityLabel: stage.name, details: { stageId } });
  res.status(201).json(created);
});

/** DELETE /api/v2/stages/:stageId */
router.delete("/v2/stages/:stageId", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const stageId = parseInt(req.params.stageId as string, 10);
  if (isNaN(stageId)) { res.status(400).json({ error: "Invalid stageId" }); return; }

  const [existing] = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  if (!existing) { res.status(404).json({ error: "Stage not found" }); return; }

  await db.delete(implementationStagesTable).where(eq(implementationStagesTable.id, stageId));
  await logAudit(req, { action: "ARCHIVE", entityType: "impl_stage_v2", entityId: `${existing.bankId}:${stageId}`, entityLabel: existing.name, details: {} });
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: existing.bankId });

  const stages = await db.select().from(implementationStagesTable)
    .where(and(eq(implementationStagesTable.bankId, existing.bankId), eq(implementationStagesTable.trackType, existing.trackType), existing.productId ? eq(implementationStagesTable.productId, existing.productId) : isNull(implementationStagesTable.productId))).orderBy(asc(implementationStagesTable.displayOrder));
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
router.post("/v2/stages/:stageId/sub-stages", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
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
router.patch("/v2/sub-stages/:subStageId", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
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
router.delete("/v2/sub-stages/:subStageId", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
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

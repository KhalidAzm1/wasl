import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, bankImplementationProgressTable, banksTable, IMPLEMENTATION_STAGES, IMPLEMENTATION_STAGE_LABELS } from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

/** Seed missing stage rows for a bank (idempotent) */
async function seedStages(bankId: string) {
  const existing = await db
    .select({ stage: bankImplementationProgressTable.stage })
    .from(bankImplementationProgressTable)
    .where(eq(bankImplementationProgressTable.bankId, bankId));

  const existingStages = new Set(existing.map((r) => r.stage));
  const missing = IMPLEMENTATION_STAGES.filter((s) => !existingStages.has(s));

  if (missing.length > 0) {
    await db.insert(bankImplementationProgressTable).values(
      missing.map((stage) => ({ bankId, stage }))
    );
  }
}

/** Compute derived fields for a set of stage rows */
function computeDerived(rows: typeof bankImplementationProgressTable.$inferSelect[]) {
  const ordered = IMPLEMENTATION_STAGES.map((s, idx) => {
    const row = rows.find((r) => r.stage === s);
    if (!row) return null;

    const now = Date.now();
    const updatedAt = new Date(row.updatedAt).getTime();
    const daysInCurrentStage =
      row.status === "in_progress"
        ? Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24))
        : null;

    return {
      ...toPlain(row),
      stageName: IMPLEMENTATION_STAGE_LABELS[s] ?? s,
      stageIndex: idx,
      daysInCurrentStage,
    };
  }).filter(Boolean);

  const completedCount = ordered.filter((r) => r!.completed).length;
  const completionPercentage = Math.round(completedCount * 12.5 * 10) / 10;

  // Current stage: first in_progress, else first not_started
  const currentStageRow =
    ordered.find((r) => r!.status === "in_progress") ||
    ordered.find((r) => r!.status === "not_started");

  const remainingStages = ordered.filter((r) => !r!.completed).length;

  return {
    stages: ordered,
    completionPercentage,
    currentStage: currentStageRow?.stage ?? null,
    currentStageName: currentStageRow
      ? (IMPLEMENTATION_STAGE_LABELS[currentStageRow.stage] ?? currentStageRow.stage)
      : null,
    remainingStages,
    isBlocked: ordered.some((r) => r!.status === "blocked"),
  };
}

// GET /api/banks/:bankId/implementation
router.get("/banks/:bankId/implementation", async (req, res): Promise<void> => {
  const { bankId } = req.params;

  // Verify bank exists
  const [bank] = await db
    .select({ id: banksTable.id })
    .from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));

  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }

  await seedStages(bankId);

  const rows = await db
    .select()
    .from(bankImplementationProgressTable)
    .where(eq(bankImplementationProgressTable.bankId, bankId));

  res.json(computeDerived(rows));
});

// PATCH /api/banks/:bankId/implementation/:stage
router.patch("/banks/:bankId/implementation/:stage", async (req, res): Promise<void> => {
  const { bankId, stage } = req.params;

  if (!(IMPLEMENTATION_STAGES as readonly string[]).includes(stage)) {
    res.status(400).json({ error: "Invalid stage" });
    return;
  }

  // Verify bank exists and is active
  const [bank] = await db
    .select({ id: banksTable.id })
    .from(banksTable)
    .where(and(eq(banksTable.id, bankId), eq(banksTable.isArchived, false)));

  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }

  const VALID_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'blocked']);

  const { status, completed, completedAt, notes, owner } = req.body as {
    status?: string;
    completed?: boolean;
    completedAt?: string | null;
    notes?: string | null;
    owner?: string | null;
  };

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: `Invalid status '${status}'. Allowed: not_started, in_progress, completed, blocked` });
    return;
  }

  // Basic date format validation (YYYY-MM-DD) when provided
  if (completedAt && !/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) {
    res.status(400).json({ error: "Invalid completedAt format. Expected YYYY-MM-DD" });
    return;
  }

  // Fetch current row to detect status transitions
  const [existing] = await db
    .select()
    .from(bankImplementationProgressTable)
    .where(
      and(
        eq(bankImplementationProgressTable.bankId, bankId),
        eq(bankImplementationProgressTable.stage, stage)
      )
    );

  if (!existing) {
    // Auto-seed then retry
    await seedStages(bankId);
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) update.status = status;
  if (completed !== undefined) {
    update.completed = completed;
    if (completed && !completedAt) update.completedAt = new Date().toISOString().split("T")[0];
  }
  if (completedAt !== undefined) update.completedAt = completedAt;
  if (notes !== undefined) update.notes = notes;
  if (owner !== undefined) update.owner = owner;

  const [updated] = await db
    .update(bankImplementationProgressTable)
    .set(update as any)
    .where(
      and(
        eq(bankImplementationProgressTable.bankId, bankId),
        eq(bankImplementationProgressTable.stage, stage)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Stage not found" });
    return;
  }

  await logAudit(req, {
    action: "UPDATE",
    entityType: "implementation_stage",
    entityId: `${bankId}:${stage}`,
    entityLabel: `${IMPLEMENTATION_STAGE_LABELS[stage]} — ${status ?? existing?.status}`,
    details: update,
  });

  // Return the full implementation view
  const allRows = await db
    .select()
    .from(bankImplementationProgressTable)
    .where(eq(bankImplementationProgressTable.bankId, bankId));

  res.json(computeDerived(allRows));
});

// GET /api/implementation/summary — all banks' progress in one call (used by dashboard cards)
router.get("/implementation/summary", async (_req, res): Promise<void> => {
  const activeBanks = await db
    .select({ id: banksTable.id })
    .from(banksTable)
    .where(eq(banksTable.isArchived, false));

  const allRows = await db
    .select()
    .from(bankImplementationProgressTable);

  const rowsByBank = new Map<string, typeof allRows>();
  for (const row of allRows) {
    if (!rowsByBank.has(row.bankId)) rowsByBank.set(row.bankId, []);
    rowsByBank.get(row.bankId)!.push(row);
  }

  const summary = activeBanks.map(({ id }) => {
    const rows = rowsByBank.get(id) ?? [];
    if (rows.length === 0) {
      return {
        bankId: id,
        completionPercentage: 0,
        currentStage: null,
        currentStageName: null,
        remainingStages: 8,
        isBlocked: false,
      };
    }
    const { stages: _, ...derived } = computeDerived(rows);
    return { bankId: id, ...derived };
  });

  res.json(summary);
});

export default router;

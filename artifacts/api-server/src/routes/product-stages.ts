import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, productStagesTable, productPhaseHistoryTable, productsTable, TECHNICAL_STAGE_NAMES } from "@workspace/db";
import { requireAuth, requirePermission, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { z } from "zod/v4";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recompute progress_percent from completed stages and persist it */
async function syncProgress(productId: number) {
  const stages = await db
    .select({ completed: productStagesTable.completed })
    .from(productStagesTable)
    .where(eq(productStagesTable.productId, productId));

  if (stages.length === 0) return;
  const done = stages.filter((s) => s.completed).length;
  const pct = done / stages.length;
  await db
    .update(productsTable)
    .set({ progressPercent: pct, updatedAt: new Date() })
    .where(eq(productsTable.id, productId));
}

// ── List stages for a product ─────────────────────────────────────────────────

router.get("/products/:productId/stages", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  let stages = await db
    .select()
    .from(productStagesTable)
    .where(eq(productStagesTable.productId, productId))
    .orderBy(asc(productStagesTable.displayOrder), asc(productStagesTable.createdAt));

  if (stages.length === 0) {
    await db.insert(productStagesTable).values(
      TECHNICAL_STAGE_NAMES.map((name, displayOrder) => ({
        productId,
        name,
        displayOrder,
        isCurrent: displayOrder === 0,
      })),
    );
    stages = await db.select().from(productStagesTable)
      .where(eq(productStagesTable.productId, productId))
      .orderBy(asc(productStagesTable.displayOrder), asc(productStagesTable.createdAt));
  }

  res.json(stages);
});

router.get("/products/:productId/phase-history", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }
  const history = await db.select().from(productPhaseHistoryTable)
    .where(eq(productPhaseHistoryTable.productId, productId))
    .orderBy(desc(productPhaseHistoryTable.createdAt));
  res.json(history);
});

// ── Create a stage ────────────────────────────────────────────────────────────

const CreateStageBody = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

router.post("/products/:productId/stages", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const parsed = CreateStageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  // Find current max order
  const existing = await db
    .select({ displayOrder: productStagesTable.displayOrder })
    .from(productStagesTable)
    .where(eq(productStagesTable.productId, productId))
    .orderBy(asc(productStagesTable.displayOrder));

  const maxOrder = existing.length > 0 ? existing[existing.length - 1].displayOrder : -1;

  const [stage] = await db
    .insert(productStagesTable)
    .values({ productId, name: parsed.data.name, notes: parsed.data.notes, displayOrder: maxOrder + 1, isCurrent: existing.length === 0 })
    .returning();

  res.status(201).json(stage);
});

// ── Update a stage (name, completed, notes) ───────────────────────────────────

const UpdateStageBody = z.object({
  name: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  notes: z.string().optional(),
});

router.patch("/product-stages/:id", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateStageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.completed !== undefined) {
    updates.completed = parsed.data.completed;
    updates.completedAt = parsed.data.completed ? new Date() : null;
  }

  const [stage] = await db
    .update(productStagesTable)
    .set(updates as any)
    .where(eq(productStagesTable.id, id))
    .returning();

  if (!stage) { res.status(404).json({ error: "Stage not found" }); return; }

  // Auto-sync product progress
  await syncProgress(stage.productId);

  res.json(stage);
});

// ── Delete a stage ────────────────────────────────────────────────────────────

router.delete("/product-stages/:id", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [stage] = await db
    .delete(productStagesTable)
    .where(eq(productStagesTable.id, id))
    .returning();

  if (!stage) { res.status(404).json({ error: "Stage not found" }); return; }

  await syncProgress(stage.productId);
  res.json({ ok: true });
});

router.post("/products/:productId/stages/advance", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) return { error: "Product not found", status: 404 } as const;

    const stages = await tx.select().from(productStagesTable)
      .where(eq(productStagesTable.productId, productId))
      .orderBy(asc(productStagesTable.displayOrder), asc(productStagesTable.createdAt));
    if (stages.length === 0) return { error: "Product has no phases", status: 409 } as const;

    const currentIndex = stages.findIndex((stage) => stage.isCurrent) >= 0
      ? stages.findIndex((stage) => stage.isCurrent)
      : stages.findIndex((stage) => !stage.completed);
    if (currentIndex < 0 || currentIndex >= stages.length - 1) {
      return { error: "Product is already in its final phase", status: 409 } as const;
    }

    const current = stages[currentIndex];
    const next = stages[currentIndex + 1];
    for (let index = 0; index <= currentIndex; index += 1) {
      await tx.update(productStagesTable).set({
        completed: true,
        completedAt: stages[index].completedAt ?? new Date(),
        isCurrent: false,
        updatedAt: new Date(),
      }).where(eq(productStagesTable.id, stages[index].id));
    }
    await tx.update(productStagesTable).set({
      completed: false,
      completedAt: null,
      isCurrent: true,
      updatedAt: new Date(),
    }).where(eq(productStagesTable.id, next.id));

    const completedCount = currentIndex + 1;
    await tx.update(productsTable).set({
      categoryStage: next.name,
      progressPercent: completedCount / stages.length,
      updatedAt: new Date(),
    }).where(eq(productsTable.id, productId));

    const [history] = await tx.insert(productPhaseHistoryTable).values({
      productId,
      fromStageId: current.id,
      fromStageName: current.name,
      toStageId: next.id,
      toStageName: next.name,
      changedById: req.authUser?.id ?? null,
      changedByName: req.authUser?.name ?? null,
    }).returning();
    return { product, current, next, history } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "product_phase",
    entityId: result.product.id,
    entityLabel: result.product.productCode,
    details: { from: result.current.name, to: result.next.name },
  });
  const stages = await db.select().from(productStagesTable)
    .where(eq(productStagesTable.productId, productId))
    .orderBy(asc(productStagesTable.displayOrder), asc(productStagesTable.createdAt));
  res.json({ stages, history: result.history });
});

export default router;

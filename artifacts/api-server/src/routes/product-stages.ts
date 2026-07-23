import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, productStagesTable, productsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";
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

router.get("/api/products/:productId/stages", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const stages = await db
    .select()
    .from(productStagesTable)
    .where(eq(productStagesTable.productId, productId))
    .orderBy(asc(productStagesTable.displayOrder), asc(productStagesTable.createdAt));

  res.json(stages);
});

// ── Create a stage ────────────────────────────────────────────────────────────

const CreateStageBody = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

router.post("/api/products/:productId/stages", async (req, res): Promise<void> => {
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
    .values({ productId, name: parsed.data.name, notes: parsed.data.notes, displayOrder: maxOrder + 1 })
    .returning();

  res.status(201).json(stage);
});

// ── Update a stage (name, completed, notes) ───────────────────────────────────

const UpdateStageBody = z.object({
  name: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  notes: z.string().optional(),
});

router.patch("/api/product-stages/:id", async (req, res): Promise<void> => {
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

router.delete("/api/product-stages/:id", async (req, res): Promise<void> => {
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

export default router;

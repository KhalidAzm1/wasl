import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, actionItemsTable } from "@workspace/db";
import {
  ListActionItemsQueryParams,
  ListActionItemsResponse,
  CreateActionItemBody,
  CreateActionItemResponse,
  UpdateActionItemParams,
  UpdateActionItemBody,
  UpdateActionItemResponse,
  DeleteActionItemParams,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

router.get("/action-items", async (req, res): Promise<void> => {
  const query = ListActionItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.bankId
    ? await db
        .select()
        .from(actionItemsTable)
        .where(eq(actionItemsTable.bankId, query.data.bankId))
    : await db.select().from(actionItemsTable);
  res.json(ListActionItemsResponse.parse(toPlain(rows)));
});

router.post("/action-items", async (req, res): Promise<void> => {
  const parsed = CreateActionItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(actionItemsTable)
    .values(parsed.data)
    .returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "actionItem",
    entityId: String(row.id),
    entityLabel: row.description,
  });
  res.status(201).json(CreateActionItemResponse.parse(toPlain(row)));
});

router.patch("/action-items/:id", async (req, res): Promise<void> => {
  const params = UpdateActionItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateActionItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(actionItemsTable)
    .set(parsed.data)
    .where(eq(actionItemsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Action item not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "actionItem",
    entityId: String(row.id),
    entityLabel: row.description,
    details: parsed.data,
  });
  res.json(UpdateActionItemResponse.parse(toPlain(row)));
});

router.delete("/action-items/:id", async (req, res): Promise<void> => {
  const params = DeleteActionItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(actionItemsTable)
    .where(eq(actionItemsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Action item not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "actionItem",
    entityId: String(row.id),
    entityLabel: row.description,
  });
  res.sendStatus(204);
});

export default router;

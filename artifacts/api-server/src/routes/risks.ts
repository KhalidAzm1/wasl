import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, risksTable } from "@workspace/db";
import {
  ListRisksQueryParams,
  ListRisksResponse,
  CreateRiskBody,
  CreateRiskResponse,
  UpdateRiskParams,
  UpdateRiskBody,
  UpdateRiskResponse,
  DeleteRiskParams,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/risks", async (req, res): Promise<void> => {
  const query = ListRisksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.bankId
    ? await db.select().from(risksTable).where(eq(risksTable.bankId, query.data.bankId))
    : await db.select().from(risksTable);
  res.json(ListRisksResponse.parse(toPlain(rows)));
});

router.post("/risks", async (req, res): Promise<void> => {
  const parsed = CreateRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(risksTable).values(parsed.data).returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "risk",
    entityId: String(row.id),
    entityLabel: row.description,
  });
  res.status(201).json(CreateRiskResponse.parse(toPlain(row)));
});

router.patch("/risks/:id", async (req, res): Promise<void> => {
  const params = UpdateRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(risksTable)
    .set(parsed.data)
    .where(eq(risksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Risk not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "risk",
    entityId: String(row.id),
    entityLabel: row.description,
    details: parsed.data,
  });
  res.json(UpdateRiskResponse.parse(toPlain(row)));
});

router.delete("/risks/:id", async (req, res): Promise<void> => {
  const params = DeleteRiskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(risksTable)
    .where(eq(risksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Risk not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "risk",
    entityId: String(row.id),
    entityLabel: row.description,
  });
  res.sendStatus(204);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  ListMeetingsQueryParams,
  ListMeetingsResponse,
  CreateMeetingBody,
  CreateMeetingResponse,
  UpdateMeetingParams,
  UpdateMeetingBody,
  UpdateMeetingResponse,
  DeleteMeetingParams,
  RestoreMeetingParams,
  RestoreMeetingResponse,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("meetings"));

router.get("/meetings", async (req, res): Promise<void> => {
  const query = ListMeetingsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.bankId
    ? await db
        .select()
        .from(meetingsTable)
        .where(and(eq(meetingsTable.bankId, query.data.bankId), eq(meetingsTable.isArchived, false)))
    : await db.select().from(meetingsTable).where(eq(meetingsTable.isArchived, false));
  res.json(ListMeetingsResponse.parse(toPlain(rows)));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(meetingsTable)
    .values({ ...parsed.data, updatedBy: req.authUser?.name ?? null })
    .returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "meeting",
    entityId: row.id,
    entityLabel: row.topic,
  });
  res.status(201).json(CreateMeetingResponse.parse(toPlain(row)));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(meetingsTable)
    .set({ ...parsed.data, updatedBy: req.authUser?.name ?? null })
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "meeting",
    entityId: row.id,
    entityLabel: row.topic,
    details: parsed.data,
  });
  res.json(UpdateMeetingResponse.parse(toPlain(row)));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(meetingsTable)
    .set({ isArchived: true, archivedAt: new Date(), archivedBy: req.authUser?.name ?? null })
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "meeting",
    entityId: row.id,
    entityLabel: row.topic,
  });
  res.sendStatus(204);
});

router.post("/meetings/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(meetingsTable)
    .set({ isArchived: false, archivedAt: null, archivedBy: null })
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  await logAudit(req, {
    action: "RESTORE",
    entityType: "meeting",
    entityId: row.id,
    entityLabel: row.topic,
  });
  res.json(RestoreMeetingResponse.parse(toPlain(row)));
});

export default router;

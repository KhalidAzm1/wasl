import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

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
        .where(eq(meetingsTable.bankId, query.data.bankId))
    : await db.select().from(meetingsTable);
  res.json(ListMeetingsResponse.parse(toPlain(rows)));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(meetingsTable).values(parsed.data).returning();
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
    .set(parsed.data)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(UpdateMeetingResponse.parse(toPlain(row)));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

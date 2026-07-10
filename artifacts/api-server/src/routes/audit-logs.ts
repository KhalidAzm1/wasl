import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams, ListAuditLogsResponse } from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/audit-logs", async (req, res): Promise<void> => {
  const query = ListAuditLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { entityType, entityId, limit, offset } = query.data;
  const conditions = [
    entityType ? eq(auditLogsTable.entityType, entityType) : undefined,
    entityId ? eq(auditLogsTable.entityId, entityId) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const pageSize = Math.min(limit ?? 50, 200);
  const pageOffset = offset ?? 0;

  const [items, [{ count }]] = await Promise.all([
    db
      .select()
      .from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(pageSize)
      .offset(pageOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .where(where),
  ]);

  res.json(ListAuditLogsResponse.parse(toPlain({ items, total: count })));
});

export default router;

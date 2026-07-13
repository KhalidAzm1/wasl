import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("user_management"));

/** GET /api/admin/performance-stats — DB table sizes and row counts */
router.get("/admin/performance-stats", async (_req, res): Promise<void> => {
  try {
    const tables = await db.execute(sql`
      SELECT
        relname          AS "table",
        n_live_tup       AS "rowCount",
        pg_size_pretty(pg_total_relation_size(relid)) AS "size",
        pg_total_relation_size(relid) AS "sizeBytes"
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    res.json({
      tables: (tables.rows as any[]).map((r) => ({
        table:    r.table,
        rowCount: Number(r.rowCount),
        size:     r.size,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch performance stats" });
  }
});

export default router;

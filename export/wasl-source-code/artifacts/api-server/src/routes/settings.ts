import { Router, type IRouter } from "express";
import { db, lookupsTable } from "@workspace/db";
import { GetLookupsResponse, UpdateLookupsBody, UpdateLookupsResponse } from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

const KEYS = [
  "statuses",
  "stages",
  "products",
  "responsiblePersons",
  "categories",
] as const;

async function readLookups() {
  const rows = await db.select().from(lookupsTable);
  const map = new Map(rows.map((r) => [r.key, r.values]));
  return {
    statuses: map.get("statuses") ?? [],
    stages: map.get("stages") ?? [],
    products: map.get("products") ?? [],
    responsiblePersons: map.get("responsiblePersons") ?? [],
    categories: map.get("categories") ?? [],
  };
}

router.get("/settings/lookups", async (_req, res): Promise<void> => {
  res.json(GetLookupsResponse.parse(await readLookups()));
});

router.patch("/settings/lookups", async (req, res): Promise<void> => {
  const parsed = UpdateLookupsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  for (const key of KEYS) {
    const values = parsed.data[key];
    if (values === undefined) continue;
    await db
      .insert(lookupsTable)
      .values({ key, values })
      .onConflictDoUpdate({ target: lookupsTable.key, set: { values } });
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "settings",
    entityId: "lookups",
    entityLabel: "Lookups configuration",
    details: parsed.data,
  });
  res.json(UpdateLookupsResponse.parse(await readLookups()));
});

export default router;

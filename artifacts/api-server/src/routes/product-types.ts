import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productTypesTable } from "@workspace/db";
import {
  ListProductTypesQueryParams,
  ListProductTypesResponse,
  CreateProductTypeBody,
  CreateProductTypeResponse,
  UpdateProductTypeParams,
  UpdateProductTypeBody,
  UpdateProductTypeResponse,
  DeactivateProductTypeParams,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/product-types", async (req, res): Promise<void> => {
  const query = ListProductTypesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select().from(productTypesTable).orderBy(productTypesTable.name);
  const filtered = query.data.includeInactive ? rows : rows.filter((row) => row.isActive);
  res.json(ListProductTypesResponse.parse(toPlain(filtered)));
});

router.post("/product-types", requireRole("super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateProductTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(productTypesTable).values(parsed.data).returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "productType",
    entityId: row.id,
    entityLabel: row.name,
  });
  res.status(201).json(CreateProductTypeResponse.parse(toPlain(row)));
});

router.patch("/product-types/:id", requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = UpdateProductTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(productTypesTable)
    .set(parsed.data)
    .where(eq(productTypesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Product type not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "productType",
    entityId: row.id,
    entityLabel: row.name,
    details: parsed.data,
  });
  res.json(UpdateProductTypeResponse.parse(toPlain(row)));
});

router.delete("/product-types/:id", requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = DeactivateProductTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(productTypesTable)
    .set({ isActive: false })
    .where(eq(productTypesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Product type not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "productType",
    entityId: row.id,
    entityLabel: row.name,
  });
  res.sendStatus(204);
});

export default router;

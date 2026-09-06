import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, productStagesTable, TECHNICAL_STAGE_NAMES } from "@workspace/db";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  CreateProductBody,
  CreateProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { z } from "zod/v4";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.bankId
    ? await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.bankId, query.data.bankId))
    : await db.select().from(productsTable);
  res.json(ListProductsResponse.parse(toPlain(rows)));
});

router.post("/products", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(productsTable).values(parsed.data).returning();
  await db.insert(productStagesTable).values(
    TECHNICAL_STAGE_NAMES.map((name, displayOrder) => ({
      productId: row.id,
      name,
      displayOrder,
      isCurrent: displayOrder === 0,
    })),
  );
  await logAudit(req, {
    action: "CREATE",
    entityType: "product",
    entityId: String(row.id),
    entityLabel: row.productCode,
  });
  res.status(201).json(CreateProductResponse.parse(toPlain(row)));
});

router.patch("/products/:id", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.extend({
    trackType: z.enum(["business", "technical"]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "product",
    entityId: String(row.id),
    entityLabel: row.productCode,
    details: parsed.data,
  });
  res.json(UpdateProductResponse.parse(toPlain(row)));
});

router.delete("/products/:id", requireRole("super_admin", "admin", "manager"), async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "product",
    entityId: String(row.id),
    entityLabel: row.productCode,
  });
  res.sendStatus(204);
});

export default router;

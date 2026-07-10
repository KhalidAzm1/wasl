import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  banksTable,
  productsTable,
  meetingsTable,
  risksTable,
  actionItemsTable,
  filesTable,
  bankProductTypesTable,
} from "@workspace/db";
import {
  CreateBankBody,
  UpdateBankParams,
  UpdateBankBody,
  DeleteBankParams,
  RestoreBankParams,
  GetBankParams,
  GetBankResponse,
  ListBanksResponse,
  CreateBankResponse,
  UpdateBankResponse,
  RestoreBankResponse,
  SetBankLogoParams,
  SetBankLogoBody,
  SetBankLogoResponse,
  SetBankHeroImageParams,
  SetBankHeroImageBody,
  SetBankHeroImageResponse,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { uploadFileToOneDrive } from "../lib/onedrive";
import { resignFileUrl } from "../lib/file-tokens";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(dataUrl: string): string | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return "Image must be a base64 data URL (png, jpg, webp, gif, or svg)";
  }
  const base64Length = match[2].length;
  const approxBytes = Math.floor((base64Length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return "Image exceeds the 8MB size limit";
  }
  return null;
}

/**
 * Uploads a base64 logo/hero image to OneDrive (never stored as base64 in
 * Postgres) and records the metadata in the generic `files` table. Returns
 * the stable proxy URL to store on the bank row, or null on failure.
 */
async function uploadBankImage(
  bankId: string,
  kind: "logo" | "hero",
  dataUrl: string,
  uploadedBy: string | null,
): Promise<string | null> {
  const safeFileName = `${bankId}_${kind}_${Date.now()}`;
  let uploadResult;
  try {
    uploadResult = await uploadFileToOneDrive("Banks", safeFileName, dataUrl);
  } catch {
    return null;
  }
  const onedriveUrl = `/api/files/content/${encodeURIComponent(uploadResult.itemId)}`;
  await db.insert(filesTable).values({
    // A distinct entityType from "bank" (used for actual bank documents) so
    // logo/hero uploads never show up in document lists, bank-detail
    // document tabs, or the dashboard activity feed -- they're metadata
    // rows purely for OneDrive audit/archive tracking, not user documents.
    entityType: "bank_image",
    entityId: bankId,
    title: kind === "logo" ? "Logo" : "Hero image",
    docType: kind,
    folder: "Banks",
    fileName: safeFileName,
    fileType: uploadResult.contentType,
    fileSize: uploadResult.size,
    onedriveFileId: uploadResult.itemId,
    onedriveUrl,
    uploadedBy,
    uploadedAt: new Date(),
  });
  return onedriveUrl;
}

async function getProductTypeIds(bankId: string): Promise<number[]> {
  const rows = await db
    .select({ productTypeId: bankProductTypesTable.productTypeId })
    .from(bankProductTypesTable)
    .where(eq(bankProductTypesTable.bankId, bankId));
  return rows.map((row) => row.productTypeId);
}

function withResignedImages<T extends { logoUrl: string | null; heroImageUrl: string | null }>(bank: T): T {
  return { ...bank, logoUrl: resignFileUrl(bank.logoUrl) ?? null, heroImageUrl: resignFileUrl(bank.heroImageUrl) ?? null };
}

async function syncProductTypes(bankId: string, productTypeIds: number[]): Promise<void> {
  await db.delete(bankProductTypesTable).where(eq(bankProductTypesTable.bankId, bankId));
  if (productTypeIds.length > 0) {
    await db
      .insert(bankProductTypesTable)
      .values(productTypeIds.map((productTypeId) => ({ bankId, productTypeId })));
  }
}

router.get("/banks", async (_req, res): Promise<void> => {
  const banks = await db
    .select()
    .from(banksTable)
    .where(eq(banksTable.isArchived, false))
    .orderBy(banksTable.nameEn);
  const withProductTypes = await Promise.all(
    banks.map(async (bank) => withResignedImages({ ...bank, productTypeIds: await getProductTypeIds(bank.id) })),
  );
  res.json(ListBanksResponse.parse(toPlain(withProductTypes)));
});

router.post("/banks", async (req, res): Promise<void> => {
  const parsed = CreateBankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productTypeIds, ...bankInput } = parsed.data;
  const id = `BANK-${Date.now()}`;
  const [bank] = await db
    .insert(banksTable)
    .values({ id, ...bankInput, updatedBy: req.authUser?.name ?? null })
    .returning();
  if (productTypeIds && productTypeIds.length > 0) {
    await syncProductTypes(bank.id, productTypeIds);
  }
  await logAudit(req, {
    action: "CREATE",
    entityType: "bank",
    entityId: bank.id,
    entityLabel: bank.nameEn,
  });
  res.status(201).json(
    CreateBankResponse.parse(toPlain(withResignedImages({ ...bank, productTypeIds: productTypeIds ?? [] }))),
  );
});

router.get("/banks/:id", async (req, res): Promise<void> => {
  const params = GetBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .select()
    .from(banksTable)
    .where(and(eq(banksTable.id, params.data.id), eq(banksTable.isArchived, false)));
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  const [products, meetings, risks, actionItems, documents, productTypeIds] =
    await Promise.all([
      db
        .select()
        .from(productsTable)
        .where(eq(productsTable.bankId, bank.id)),
      db
        .select()
        .from(meetingsTable)
        .where(and(eq(meetingsTable.bankId, bank.id), eq(meetingsTable.isArchived, false))),
      db.select().from(risksTable).where(eq(risksTable.bankId, bank.id)),
      db
        .select()
        .from(actionItemsTable)
        .where(eq(actionItemsTable.bankId, bank.id)),
      db
        .select()
        .from(filesTable)
        .where(and(eq(filesTable.entityType, "bank"), eq(filesTable.entityId, bank.id), eq(filesTable.isArchived, false))),
      getProductTypeIds(bank.id),
    ]);
  const documentsWire = documents.map((row) => ({
    ...row,
    bankId: row.entityId,
    oneDriveItemId: row.onedriveFileId,
    oneDriveWebUrl: resignFileUrl(row.onedriveUrl),
  }));
  res.json(
    GetBankResponse.parse(
      toPlain(
        withResignedImages({
          ...bank,
          productTypeIds,
          products,
          meetings,
          risks,
          actionItems,
          documents: documentsWire,
        }),
      ),
    ),
  );
});

router.patch("/banks/:id", async (req, res): Promise<void> => {
  const params = UpdateBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.logoUrl) {
    const imageError = validateImageDataUrl(parsed.data.logoUrl);
    if (imageError) {
      res.status(400).json({ error: imageError });
      return;
    }
  }
  if (parsed.data.heroImageUrl) {
    const imageError = validateImageDataUrl(parsed.data.heroImageUrl);
    if (imageError) {
      res.status(400).json({ error: imageError });
      return;
    }
  }
  const { productTypeIds, ...bankUpdate } = parsed.data;
  const [bank] = await db
    .update(banksTable)
    .set({ ...bankUpdate, updatedBy: req.authUser?.name ?? null })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  if (productTypeIds !== undefined) {
    await syncProductTypes(bank.id, productTypeIds);
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "bank",
    entityId: bank.id,
    entityLabel: bank.nameEn,
    details: parsed.data,
  });
  const finalProductTypeIds = productTypeIds ?? (await getProductTypeIds(bank.id));
  res.json(UpdateBankResponse.parse(toPlain(withResignedImages({ ...bank, productTypeIds: finalProductTypeIds }))));
});

router.delete("/banks/:id", async (req, res): Promise<void> => {
  const params = DeleteBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: req.authUser?.name ?? null,
    })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "bank",
    entityId: bank.id,
    entityLabel: bank.nameEn,
  });
  res.sendStatus(204);
});

router.post("/banks/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ isArchived: false, archivedAt: null, archivedBy: null })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  await logAudit(req, {
    action: "RESTORE",
    entityType: "bank",
    entityId: bank.id,
    entityLabel: bank.nameEn,
  });
  res.json(RestoreBankResponse.parse(toPlain(withResignedImages({ ...bank, productTypeIds: await getProductTypeIds(bank.id) }))));
});

router.put("/banks/:id/logo", async (req, res): Promise<void> => {
  const params = SetBankLogoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetBankLogoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const [existingBank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, params.data.id));
  if (!existingBank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  const logoUrl = await uploadBankImage(params.data.id, "logo", parsed.data.dataUrl, req.authUser?.name ?? null);
  if (!logoUrl) {
    res.status(400).json({ error: "Failed to upload logo to OneDrive" });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ logoUrl, updatedBy: req.authUser?.name ?? null })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.json(
    SetBankLogoResponse.parse(
      toPlain({ ...bank, logoUrl: resignFileUrl(bank.logoUrl), heroImageUrl: resignFileUrl(bank.heroImageUrl), productTypeIds: await getProductTypeIds(bank.id) }),
    ),
  );
});

router.put("/banks/:id/hero", async (req, res): Promise<void> => {
  const params = SetBankHeroImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetBankHeroImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const [existingBank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, params.data.id));
  if (!existingBank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  const heroImageUrl = await uploadBankImage(params.data.id, "hero", parsed.data.dataUrl, req.authUser?.name ?? null);
  if (!heroImageUrl) {
    res.status(400).json({ error: "Failed to upload hero image to OneDrive" });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ heroImageUrl, updatedBy: req.authUser?.name ?? null })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.json(
    SetBankHeroImageResponse.parse(
      toPlain({ ...bank, logoUrl: resignFileUrl(bank.logoUrl), heroImageUrl: resignFileUrl(bank.heroImageUrl), productTypeIds: await getProductTypeIds(bank.id) }),
    ),
  );
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
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
import { requireAuth, requirePermission, requireBankEditAccess } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { eventBus } from "../lib/event-bus";
import { getSignedUrl, resolveStoredUrl } from "../lib/supabase-storage";
import { uploadToOneDrive } from "../lib/onedrive-storage";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(dataUrl: string): string | null {
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);
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
 * Uploads a base64 image data URL to OneDrive under
 * "Wasl Platform/bank-images/<bankId>/<kind>_<timestamp>.<ext>".
 * Records the upload in the `files` table for auditing and returns
 * "onedrive:<itemId>" (to be stored as `logoUrl` / `heroImageUrl`).
 * Returns null on any error.
 */
async function uploadBankImage(
  bankId: string,
  kind: "logo" | "hero",
  dataUrl: string,
  uploadedBy: string | null,
): Promise<string | null> {
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);
  if (!match) return null;
  const ext = match[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const contentType = `image/${match[1]}`;
  const buffer = Buffer.from(match[2], "base64");

  const timestamp = Date.now();
  const folderPath = `bank-images/${bankId}`;
  const fileName = `${kind}_${timestamp}.${ext}`;

  let onedriveItemId: string;
  try {
    onedriveItemId = await uploadToOneDrive(folderPath, fileName, buffer, contentType);
  } catch {
    return null;
  }

  const storagePath = `onedrive:${onedriveItemId}`;

  // Track in the files table for auditing. entityType="bank_image" keeps
  // these rows out of normal document lists.
  await db.insert(filesTable).values({
    entityType: "bank_image",
    entityId: bankId,
    title: kind === "logo" ? "Logo" : "Hero image",
    docType: kind,
    fileName,
    fileType: contentType,
    fileSize: buffer.byteLength,
    storagePath,
    uploadedBy,
    uploadedAt: new Date(),
  });

  return storagePath;
}

async function getProductTypeIds(bankId: string): Promise<number[]> {
  const rows = await db
    .select({ productTypeId: bankProductTypesTable.productTypeId })
    .from(bankProductTypesTable)
    .where(eq(bankProductTypesTable.bankId, bankId));
  return rows.map((row) => row.productTypeId);
}

/** Replaces stored logo/hero paths with fresh Supabase signed URLs. */
async function withSignedImageUrls<T extends { logoUrl: string | null; heroImageUrl: string | null }>(
  bank: T,
): Promise<T> {
  const [logoUrl, heroImageUrl] = await Promise.all([
    resolveStoredUrl(bank.logoUrl),
    resolveStoredUrl(bank.heroImageUrl),
  ]);
  return { ...bank, logoUrl, heroImageUrl };
}

async function syncProductTypes(bankId: string, productTypeIds: number[]): Promise<void> {
  await db.delete(bankProductTypesTable).where(eq(bankProductTypesTable.bankId, bankId));
  if (productTypeIds.length > 0) {
    await db
      .insert(bankProductTypesTable)
      .values(productTypeIds.map((productTypeId) => ({ bankId, productTypeId })));
  }
}

/** Builds the wire representation of a file row for bank document lists. */
async function fileToWire(row: typeof filesTable.$inferSelect) {
  let fileUrl: string | null = null;
  if (row.storagePath) {
    try {
      fileUrl = await getSignedUrl(row.storagePath);
    } catch {
      fileUrl = null;
    }
  }
  return {
    ...row,
    bankId: row.entityId,
    fileUrl,
    oneDriveWebUrl: fileUrl, // backward-compat alias
    oneDriveItemId: row.onedriveFileId ?? null,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// ── In-process cache for lastActivityAt (expensive subquery — 5 min TTL) ──────
let activityCache: { map: Map<string, Date>; expiresAt: number } | null = null;
const ACTIVITY_CACHE_TTL_MS = 5 * 60_000;

async function getActivityMap(): Promise<Map<string, Date>> {
  if (activityCache && activityCache.expiresAt > Date.now()) return activityCache.map;
  const fresh = new Map<string, Date>();
  try {
    const rows = await db.execute<{ bank_id: string; last_activity_at: string | null }>(sql`
      SELECT bank_id, MAX(activity_ts) AS last_activity_at FROM (
        SELECT id AS bank_id, updated_at AS activity_ts FROM banks WHERE is_archived = false
        UNION ALL
        SELECT bank_id, updated_at FROM meetings WHERE bank_id IS NOT NULL
        UNION ALL
        SELECT entity_id AS bank_id, COALESCE(updated_at, uploaded_at) AS activity_ts
          FROM files WHERE entity_type = 'bank' AND entity_id IS NOT NULL AND is_archived = false
        UNION ALL
        SELECT bank_id, updated_at FROM products WHERE bank_id IS NOT NULL
        UNION ALL
        SELECT bank_id, updated_at FROM bank_implementation_progress WHERE bank_id IS NOT NULL
      ) AS activities GROUP BY bank_id
    `);
    for (const row of rows.rows) {
      if (row.bank_id && row.last_activity_at) fresh.set(row.bank_id, new Date(row.last_activity_at));
    }
    activityCache = { map: fresh, expiresAt: Date.now() + ACTIVITY_CACHE_TTL_MS };
  } catch (err) {
    console.warn("[banks] lastActivityAt cache miss, using updatedAt:", err);
  }
  return fresh;
}

/** Invalidate activity cache after any write that changes activity dates */
export function invalidateActivityCache() { activityCache = null; }

router.get("/banks", async (req, res): Promise<void> => {
  // Optional pagination — default 200, max 500 (safe for current scale)
  const rawPage  = parseInt(String(req.query.page  ?? "1"), 10);
  const rawLimit = parseInt(String(req.query.limit ?? "200"), 10);
  const page  = Number.isFinite(rawPage)  && rawPage  > 0 ? rawPage  : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;
  const offset = (page - 1) * limit;

  // Run all three expensive queries in parallel
  const [banks, allMappings, activityMap] = await Promise.all([
    db.select().from(banksTable).where(eq(banksTable.isArchived, false))
      .orderBy(banksTable.nameEn).limit(limit).offset(offset),
    db.select({ bankId: bankProductTypesTable.bankId, productTypeId: bankProductTypesTable.productTypeId })
      .from(bankProductTypesTable),
    getActivityMap(),
  ]);

  const ptByBank = new Map<string, number[]>();
  for (const { bankId, productTypeId } of allMappings) {
    if (!ptByBank.has(bankId)) ptByBank.set(bankId, []);
    ptByBank.get(bankId)!.push(productTypeId);
  }

  // Resolve signed image URLs in parallel across all banks
  const withProductTypes = await Promise.all(
    banks.map((bank) =>
      withSignedImageUrls({
        ...bank,
        productTypeIds: ptByBank.get(bank.id) ?? [],
        lastActivityAt: activityMap.get(bank.id) ?? null,
      }),
    ),
  );
  res.json(ListBanksResponse.parse(toPlain(withProductTypes)));
});

router.post("/banks", requireBankEditAccess, async (req, res): Promise<void> => {
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
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: bank.id });
  res.status(201).json(
    CreateBankResponse.parse(
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: productTypeIds ?? [] })),
    ),
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
  const [products, meetings, risks, actionItems, documents, productTypeIds] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.bankId, bank.id)),
    db
      .select()
      .from(meetingsTable)
      .where(and(eq(meetingsTable.bankId, bank.id), eq(meetingsTable.isArchived, false))),
    db.select().from(risksTable).where(eq(risksTable.bankId, bank.id)),
    db.select().from(actionItemsTable).where(eq(actionItemsTable.bankId, bank.id)),
    db
      .select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.entityType, "bank"),
          eq(filesTable.entityId, bank.id),
          eq(filesTable.isArchived, false),
        ),
      ),
    getProductTypeIds(bank.id),
  ]);
  const documentsWire = await Promise.all(documents.map(fileToWire));
  res.json(
    GetBankResponse.parse(
      toPlain(
        await withSignedImageUrls({
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

router.patch("/banks/:id", requireBankEditAccess, async (req, res): Promise<void> => {
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

  // When a logo/hero is provided as a base64 data URL, upload it to Supabase
  // Storage and replace the base64 with the storage path before saving to DB.
  const { productTypeIds, logoUrl: rawLogoUrl, heroImageUrl: rawHeroImageUrl, ...restUpdate } = parsed.data;
  const bankUpdate: Record<string, unknown> = { ...restUpdate };

  if (rawLogoUrl) {
    if (rawLogoUrl.startsWith("data:")) {
      const imageError = validateImageDataUrl(rawLogoUrl);
      if (imageError) {
        res.status(400).json({ error: imageError });
        return;
      }
      const storagePath = await uploadBankImage(params.data.id, "logo", rawLogoUrl, req.authUser?.name ?? null);
      if (!storagePath) {
        res.status(502).json({ error: "Failed to upload logo — please try again" });
        return;
      }
      bankUpdate.logoUrl = storagePath;
    } else {
      bankUpdate.logoUrl = rawLogoUrl; // already a storage path
    }
  }

  if (rawHeroImageUrl) {
    if (rawHeroImageUrl.startsWith("data:")) {
      const imageError = validateImageDataUrl(rawHeroImageUrl);
      if (imageError) {
        res.status(400).json({ error: imageError });
        return;
      }
      const storagePath = await uploadBankImage(params.data.id, "hero", rawHeroImageUrl, req.authUser?.name ?? null);
      if (!storagePath) {
        res.status(502).json({ error: "Failed to upload hero image — please try again" });
        return;
      }
      bankUpdate.heroImageUrl = storagePath;
    } else {
      bankUpdate.heroImageUrl = rawHeroImageUrl;
    }
  }

  const [bank] = await db
    .update(banksTable)
    .set({ ...bankUpdate, updatedBy: req.authUser?.name ?? null } as any)
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
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: bank.id });
  const finalProductTypeIds = productTypeIds ?? (await getProductTypeIds(bank.id));
  res.json(
    UpdateBankResponse.parse(
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: finalProductTypeIds })),
    ),
  );
});

router.delete("/banks/:id", requireBankEditAccess, async (req, res): Promise<void> => {
  const params = DeleteBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ isArchived: true, archivedAt: new Date(), archivedBy: req.authUser?.name ?? null })
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
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: bank.id });
  res.sendStatus(204);
});

router.post("/banks/:id/restore", requireBankEditAccess, async (req, res): Promise<void> => {
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
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: bank.id });
  res.json(
    RestoreBankResponse.parse(
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: await getProductTypeIds(bank.id) })),
    ),
  );
});

router.put("/banks/:id/logo", requireBankEditAccess, async (req, res): Promise<void> => {
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
    res.status(400).json({ error: "Failed to upload logo" });
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
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: await getProductTypeIds(bank.id) })),
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
    res.status(400).json({ error: "Failed to upload hero image" });
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
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: await getProductTypeIds(bank.id) })),
    ),
  );
});

export default router;

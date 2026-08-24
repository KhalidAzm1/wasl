import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  db,
  banksTable,
  productsTable,
  meetingsTable,
  risksTable,
  actionItemsTable,
  filesTable,
  bankProductTypesTable,
  auditLogsTable,
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
import { requireAuth, requirePermission, requireBankEditAccess, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { eventBus } from "../lib/event-bus";
import { getSignedUrl, resolveStoredUrl, uploadToStorage, parseDataUrl } from "../lib/supabase-storage";

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
 * Uploads a base64 image data URL to Supabase Storage under
 * "bank-images/<bankId>/<kind>_<timestamp>.<ext>".
 * Records the upload in the `files` table for auditing and returns
 * the storage path (to be stored as `logoUrl` / `heroImageUrl`).
 * Returns null on any error.
 */
async function uploadBankImage(
  bankId: string,
  kind: "logo" | "hero",
  dataUrl: string,
  uploadedBy: string | null,
): Promise<string | null> {
  let parsed: { contentType: string; buffer: Buffer };
  try {
    parsed = parseDataUrl(dataUrl);
  } catch {
    return null;
  }

  const { contentType, buffer } = parsed;
  const ext = contentType.replace("image/", "").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const timestamp = Date.now();
  const storagePath = `bank-images/${bankId}/${kind}_${timestamp}.${ext}`;
  const fileName = `${kind}_${timestamp}.${ext}`;

  try {
    await uploadToStorage(storagePath, buffer, contentType);
  } catch {
    return null;
  }

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

type StoredResponsiblePerson = { name?: unknown; storagePath?: unknown };

function legacyResponsibleNames(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(";").map((name) => name.trim()).filter(Boolean)
    : [];
}

/**
 * Converts legacy photo-only records into the current person shape. Older
 * uploads stored just `storagePath`; their matching name remains available in
 * the semicolon-separated legacy field in the same order.
 */
export function normalizeResponsiblePersons(value: unknown, legacyNameSource: unknown) {
  const rawPersons = Array.isArray(value) ? value : [];
  const legacyNames = legacyResponsibleNames(legacyNameSource);

  return rawPersons.flatMap((person, index) => {
    if (!person || typeof person !== "object" || Array.isArray(person)) return [];
    const stored = person as StoredResponsiblePerson;
    const explicitName = typeof stored.name === "string" ? stored.name.trim() : "";
    const name = explicitName || legacyNames[index] || "";
    if (!name) return [];

    return [{
      name,
      storagePath: typeof stored.storagePath === "string" && stored.storagePath.trim()
        ? stored.storagePath
        : null,
    }];
  });
}

/** Replaces stored image paths with fresh Supabase signed URLs. */
async function withSignedImageUrls<T extends {
  logoUrl: string | null;
  heroImageUrl: string | null;
  responsiblePerson?: string | null;
  responsiblePersonPhoto?: string | null;
  responsiblePersons?: unknown;
  orgChart?: Array<{ photoUrl?: string | null; photoStoragePath?: string | null }> | null;
}>(
  bank: T,
): Promise<T & {
  responsiblePersons: Array<{ name: string; storagePath: string | null; photoUrl: string | null }>;
  orgChart: Array<{ photoUrl: string | null; photoStoragePath: string | null }>;
}> {
  const [logoUrl, heroImageUrl, responsiblePersonPhoto] = await Promise.all([
    resolveStoredUrl(bank.logoUrl),
    resolveStoredUrl(bank.heroImageUrl),
    resolveStoredUrl(bank.responsiblePersonPhoto ?? null),
  ]);
  const storedPersons = normalizeResponsiblePersons(bank.responsiblePersons, bank.responsiblePerson);
  const resolvedPhotos = await Promise.all(storedPersons.map((person) => resolveStoredUrl(person.storagePath)));
  const responsiblePersons = storedPersons.map((person, i) => ({
    ...person,
    photoUrl: resolvedPhotos[i],
  }));
  const rawOrgChart = bank.orgChart ?? [];
  const resolvedOrgPhotos = await Promise.all(
    rawOrgChart.map((node) => node.photoStoragePath
      ? resolveStoredUrl(node.photoStoragePath)
      : node.photoUrl ?? null),
  );
  const orgChart = rawOrgChart.map((node, i) => ({
    ...node,
    photoStoragePath: node.photoStoragePath ?? null,
    photoUrl: resolvedOrgPhotos[i] ?? null,
  }));
  return { ...bank, logoUrl, heroImageUrl, responsiblePersonPhoto, responsiblePersons, orgChart } as T & {
    responsiblePersons: Array<{ name: string; storagePath: string | null; photoUrl: string | null }>;
    orgChart: Array<{ photoUrl: string | null; photoStoragePath: string | null }>;
  };
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
        UNION ALL
        SELECT bank_id, updated_at FROM implementation_stages WHERE bank_id IS NOT NULL
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

  // Per-bank scoping: non-admin users with assigned banks see only their own
  const user = req.authUser!;
  const restrictedBankIds =
    user.role !== "super_admin" && user.role !== "admin" && user.assignedBankIds.length > 0
      ? user.assignedBankIds
      : null;

  // Run all three expensive queries in parallel
  const [banks, allMappings, activityMap] = await Promise.all([
    db.select().from(banksTable)
      .where(restrictedBankIds
        ? and(eq(banksTable.isArchived, false), inArray(banksTable.id, restrictedBankIds))
        : eq(banksTable.isArchived, false))
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

router.post("/banks", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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
  // Per-bank access check for restricted users
  const reqUser = req.authUser!;
  if (reqUser.role !== "super_admin" && reqUser.role !== "admin" && reqUser.assignedBankIds.length > 0) {
    if (!reqUser.assignedBankIds.includes(params.data.id)) {
      res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذا البنك" });
      return;
    }
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
  const [documentsWire, activityMap] = await Promise.all([
    Promise.all(documents.map(fileToWire)),
    getActivityMap(),
  ]);
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
          lastActivityAt: activityMap.get(bank.id) ?? null,
        }),
      ),
    ),
  );
});

router.patch("/banks/:id", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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

router.delete("/banks/:id", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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

router.post("/banks/:id/restore", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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

router.put("/banks/:id/logo", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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

/** PUT /banks/:id/responsible-person-photo — upload / replace the responsible-person avatar */
router.put("/banks/:id/responsible-person-photo", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
  const bankId = String(req.params.id);
  const parsed = SetBankLogoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) { res.status(400).json({ error: imageError }); return; }

  const [existingBank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, bankId));
  if (!existingBank) { res.status(404).json({ error: "Bank not found" }); return; }

  let parsed2: { contentType: string; buffer: Buffer };
  try { parsed2 = parseDataUrl(parsed.data.dataUrl); } catch (e: any) { res.status(400).json({ error: e.message }); return; }

  const { contentType, buffer } = parsed2;
  const ext = contentType.replace("image/", "").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const storagePath = `responsible-person/${bankId}/photo.${ext}`;
  try {
    await uploadToStorage(storagePath, buffer, contentType);
  } catch (e: any) {
    req.log.error({ storagePath, err: e?.message ?? String(e) }, "responsible-person-photo upload failed");
    res.status(502).json({ error: "Failed to upload photo — please try again", detail: e?.message }); return;
  }

  const [bank] = await db
    .update(banksTable)
    .set({ responsiblePersonPhoto: storagePath, updatedBy: req.authUser?.name ?? null } as any)
    .where(eq(banksTable.id, bankId))
    .returning();
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }

  const photoUrl = await getSignedUrl(storagePath).catch(() => null);
  res.json({ photoUrl, storagePath });
});

/** PUT /banks/:id/responsible-persons — replace the ordered list of responsible persons (names only; photos handled separately) */
router.put("/banks/:id/responsible-persons", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
  const bankId = String(req.params.id);
  const { persons } = req.body as { persons?: Array<{ name: string; storagePath?: string | null }> };
  if (!Array.isArray(persons)) { res.status(400).json({ error: "persons must be an array" }); return; }

  const [existing] = await db
    .select({ id: banksTable.id, responsiblePersons: banksTable.responsiblePersons })
    .from(banksTable)
    .where(eq(banksTable.id, bankId));
  if (!existing) { res.status(404).json({ error: "Bank not found" }); return; }

  const existingPersons: Array<{ name?: string; storagePath?: string | null }> =
    Array.isArray(existing.responsiblePersons) ? existing.responsiblePersons : [];
  const existingByName = new Map(
    existingPersons
      .filter((person) => typeof person.name === "string" && person.name.trim())
      .map((person) => [person.name!.trim().toLocaleLowerCase(), person.storagePath ?? null]),
  );
  const ownedPathPrefix = `responsible-person/${bankId}/`;

  // Preserve paths that the server already knows about. This keeps uploads from
  // disappearing for both the older names-only client and the newer client that
  // returns the uploaded storagePath with its save request.
  const newPersons = persons.flatMap((person, index) => {
    if (typeof person.name !== "string" || !person.name.trim()) return [];

    const requestedPath = typeof person.storagePath === "string" && person.storagePath.startsWith(ownedPathPrefix)
      ? person.storagePath
      : null;
    const matchedPath = existingByName.get(person.name.trim().toLocaleLowerCase()) ?? null;
    const indexPath = existingPersons[index]?.storagePath ?? null;

    return [{
      name: person.name.trim(),
      storagePath: requestedPath ?? matchedPath ?? indexPath,
    }];
  });

  const [updated] = await db
    .update(banksTable)
    .set({
      responsiblePerson: newPersons.map(p => p.name).join('; ') || null,
      responsiblePersonPhoto: newPersons[0]?.storagePath ?? null,
      updatedBy: req.authUser?.name ?? null,
    } as any)
    .where(eq(banksTable.id, bankId))
    .returning();
  // Also store structured data
  await db.execute(sql`UPDATE banks SET responsible_persons = ${JSON.stringify(newPersons)}::jsonb WHERE id = ${bankId}`);

  res.json({ ok: true, persons: newPersons });
});

/** PUT /banks/:id/responsible-person/:index/photo — upload / replace photo for one person */
router.put("/banks/:id/responsible-person/:index/photo", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
  const bankId = String(req.params.id);
  const idx = parseInt(String(req.params.index), 10);
  const parsed = SetBankLogoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) { res.status(400).json({ error: imageError }); return; }

  const [existing] = await db.select({
    id: banksTable.id,
    responsiblePersons: banksTable.responsiblePersons,
    responsiblePerson: banksTable.responsiblePerson,
  }).from(banksTable).where(eq(banksTable.id, bankId));
  if (!existing) { res.status(404).json({ error: "Bank not found" }); return; }

  const existingPersons: Array<StoredResponsiblePerson> = Array.isArray(existing.responsiblePersons)
    ? existing.responsiblePersons
    : [];
  const currentName = existingPersons[idx]?.name;
  const personName = (typeof currentName === "string" ? currentName.trim() : "")
    || legacyResponsibleNames(existing.responsiblePerson)[idx]
    || "";
  if (!personName) {
    res.status(400).json({ error: "Add the person's name before uploading a photo" });
    return;
  }

  let parsed2: { contentType: string; buffer: Buffer };
  try { parsed2 = parseDataUrl(parsed.data.dataUrl); } catch (e: any) { res.status(400).json({ error: e.message }); return; }

  const { contentType, buffer } = parsed2;
  const ext = contentType.replace("image/", "").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const storagePath = `responsible-person/${bankId}/${idx}_photo_${Date.now()}.${ext}`;
  try { await uploadToStorage(storagePath, buffer, contentType); } catch (e: any) {
    res.status(502).json({ error: "Failed to upload photo", detail: e?.message }); return;
  }

  try {
    const persons: Array<Record<string, unknown>> = existingPersons
      .map((person) => ({ ...person }));
    while (persons.length <= idx) persons.push({});
    persons[idx] = { ...persons[idx], name: personName, storagePath };
    await db.update(banksTable)
      .set({ responsiblePersons: persons } as any)
      .where(eq(banksTable.id, bankId));
  } catch (e: any) {
    req.log.error({ err: e?.message ?? String(e) }, "responsible-person photo DB update failed");
    res.status(500).json({ error: "Photo upload failed", detail: "Could not update person photo in database" });
    return;
  }

  // Keep first person's photo synced with legacy field
  if (idx === 0) {
    await db.update(banksTable).set({ responsiblePersonPhoto: storagePath } as any).where(eq(banksTable.id, bankId));
  }

  const photoUrl = await getSignedUrl(storagePath).catch(() => null);
  res.json({ photoUrl, storagePath });
});

router.put("/banks/:id/org-chart-photo/:nodeId", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
  const bankId = String(req.params.id);
  const nodeId = String(req.params.nodeId);
  if (!bankId || !nodeId) { res.status(400).json({ error: "Missing bankId or nodeId" }); return; }

  const parsed = SetBankLogoBody.safeParse(req.body); // reuse same { dataUrl } shape
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) { res.status(400).json({ error: imageError }); return; }

  const [existingBank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, bankId));
  if (!existingBank) { res.status(404).json({ error: "Bank not found" }); return; }

  let parsed2: { contentType: string; buffer: Buffer };
  try { parsed2 = parseDataUrl(parsed.data.dataUrl); } catch (e: any) { res.status(400).json({ error: e.message }); return; }

  const { contentType, buffer } = parsed2;
  const ext = contentType.replace("image/", "").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const storagePath = `org-chart/${bankId}/${nodeId}.${ext}`;
  try {
    await uploadToStorage(storagePath, buffer, contentType);
  } catch (e: any) {
    req.log.error({ storagePath, err: e?.message ?? String(e) }, "org-chart-photo upload failed");
    res.status(502).json({ error: "Failed to upload photo — please try again", detail: e?.message }); return;
  }

  let photoUrl: string;
  try { photoUrl = await getSignedUrl(storagePath); } catch (e: any) {
    req.log.error({ storagePath, err: e?.message ?? String(e) }, "org-chart-photo sign-url failed");
    res.status(502).json({ error: "Uploaded but could not sign URL", detail: e?.message }); return;
  }

  res.json({ photoUrl, storagePath });
});

/**
 * Restores the most recent chart version in the audit trail that still contains
 * profile photos. The action is explicit in the UI rather than automatic.
 */
router.post("/banks/:id/org-chart/restore-latest-photo-snapshot", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
  const bankId = String(req.params.id);
  const [existingBank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, bankId));
  if (!existingBank) { res.status(404).json({ error: "Bank not found" }); return; }

  const auditRows = await db
    .select({ id: auditLogsTable.id, details: auditLogsTable.details })
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.entityType, "bank"), eq(auditLogsTable.entityId, bankId)))
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(100);

  const snapshot = auditRows.find((row) => {
    const chart = (row.details as { orgChart?: unknown } | null)?.orgChart;
    return Array.isArray(chart) && chart.some((node) =>
      typeof node === "object" && node !== null && typeof (node as { photoUrl?: unknown }).photoUrl === "string",
    );
  });
  const sourceChart = (snapshot?.details as { orgChart?: unknown } | null)?.orgChart;
  if (!snapshot || !Array.isArray(sourceChart)) {
    res.status(404).json({ error: "No saved organization chart with photos was found" });
    return;
  }

  const storagePathFromLegacyUrl = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const marker = "/object/sign/wasl-documents/";
    try {
      const path = new URL(value).pathname;
      const markerIndex = path.indexOf(marker);
      return markerIndex >= 0 ? decodeURIComponent(path.slice(markerIndex + marker.length)) : null;
    } catch {
      return null;
    }
  };

  const restoredChart = sourceChart
    .filter((node): node is Record<string, unknown> => typeof node === "object" && node !== null)
    .map((node) => ({
      ...node,
      photoStoragePath: typeof node.photoStoragePath === "string"
        ? node.photoStoragePath
        : storagePathFromLegacyUrl(node.photoUrl),
      // Legacy signed URLs expire. The response creates a fresh URL from the path.
      photoUrl: null,
    }));

  const [bank] = await db
    .update(banksTable)
    .set({ orgChart: restoredChart as any, updatedBy: req.authUser?.name ?? null })
    .where(eq(banksTable.id, bankId))
    .returning();

  await logAudit(req, {
    action: "UPDATE",
    entityType: "bank",
    entityId: bankId,
    entityLabel: bank.nameEn,
    details: { source: "org-chart-photo-snapshot-recovery", snapshotAuditLogId: snapshot.id },
  });
  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId });
  res.json(
    UpdateBankResponse.parse(
      toPlain(await withSignedImageUrls({ ...bank, productTypeIds: await getProductTypeIds(bank.id) })),
    ),
  );
});

router.put("/banks/:id/hero", requireRole("super_admin", "admin"), requireBankEditAccess, async (req, res): Promise<void> => {
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

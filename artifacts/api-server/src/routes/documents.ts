import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, filesTable, banksTable, productsTable, meetingsTable, productStagesTable } from "@workspace/db";
import {
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  CreateDocumentBody,
  CreateDocumentResponse,
  UploadDocumentBody,
  UploadDocumentResponse,
  UpdateDocumentParams,
  UpdateDocumentBody,
  UpdateDocumentResponse,
  DeleteDocumentParams,
  RestoreDocumentParams,
  RestoreDocumentResponse,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { getSignedUrl, parseDataUrl } from "../lib/supabase-storage";
import { uploadToOneDrive } from "../lib/onedrive-storage";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("documents"));

// entityType -> the DB table/column used to verify the parent record exists
// before writing a files row. No longer maps to OneDrive folders.
const ENTITY_CONFIG = {
  bank: { table: banksTable, idColumn: banksTable.id },
  product: { table: productsTable, idColumn: productsTable.id },
  meeting: { table: meetingsTable, idColumn: meetingsTable.id },
  product_stage: { table: productStagesTable, idColumn: productStagesTable.id },
} as const;
type EntityType = keyof typeof ENTITY_CONFIG;

function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && value in ENTITY_CONFIG;
}

async function resolveEntity(
  entityType: string | undefined,
  entityId: string | undefined,
  bankId: string | undefined,
): Promise<{ entityType: EntityType; entityId: string } | { error: string }> {
  // bankId is a deprecated alias kept for older clients.
  const resolvedType = entityType ?? (bankId ? "bank" : undefined);
  const resolvedId = entityId ?? bankId;
  if (!resolvedType || !resolvedId) {
    return { error: "entityType and entityId are required" };
  }
  if (!isEntityType(resolvedType)) {
    return { error: `Unsupported entityType "${resolvedType}"` };
  }
  const config = ENTITY_CONFIG[resolvedType];
  const idValue = resolvedType === "bank" ? resolvedId : Number(resolvedId);
  if (resolvedType !== "bank" && Number.isNaN(idValue as number)) {
    return { error: `Invalid entityId for entityType "${resolvedType}"` };
  }
  const [record] = await db
    .select({ id: config.idColumn })
    .from(config.table as any)
    .where(eq(config.idColumn as any, idValue as any));
  if (!record) {
    return { error: `${resolvedType} not found` };
  }
  return { entityType: resolvedType, entityId: String(resolvedId) };
}

/**
 * Builds the wire representation of a file row for API responses.
 * storagePath can be a Supabase path, an "onedrive:<itemId>" value, or null.
 * resolveStoredUrl handles all three cases transparently.
 */
async function toWire(row: typeof filesTable.$inferSelect) {
  let fileUrl: string | null = null;

  if (row.storagePath) {
    try {
      // resolveStoredUrl handles both Supabase paths and "onedrive:<id>" values
      const { resolveStoredUrl } = await import("../lib/supabase-storage");
      fileUrl = await resolveStoredUrl(row.storagePath);
    } catch {
      fileUrl = null;
    }
  }

  return {
    ...row,
    bankId: row.entityType === "bank" ? row.entityId : null,
    fileUrl,
    // Backward-compat alias still expected by older client code.
    oneDriveWebUrl: fileUrl,
    oneDriveItemId: row.onedriveFileId ?? null,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

router.get("/documents", async (req, res): Promise<void> => {
  const query = ListDocumentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const entityType = query.data.entityType ?? (query.data.bankId ? "bank" : undefined);
  const entityId = query.data.entityId ?? query.data.bankId;
  const conditions = [eq(filesTable.isArchived, false)];
  if (entityType) conditions.push(eq(filesTable.entityType, entityType));
  if (entityId) conditions.push(eq(filesTable.entityId, entityId));
  const rows = await db
    .select()
    .from(filesTable)
    .where(and(...conditions));
  const wired = await Promise.all(rows.map(toWire));
  res.json(ListDocumentsResponse.parse(toPlain(wired)));
});

// ─── Create link-only record ──────────────────────────────────────────────────

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const resolved = await resolveEntity(parsed.data.entityType, parsed.data.entityId, parsed.data.bankId);
  if ("error" in resolved) {
    res.status(404).json({ error: resolved.error });
    return;
  }
  const [row] = await db
    .insert(filesTable)
    .values({
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      title: parsed.data.title,
      link: parsed.data.link,
      docType: parsed.data.docType,
      uploadedBy: req.authUser?.name ?? null,
      uploadedAt: new Date(),
    })
    .returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.status(201).json(CreateDocumentResponse.parse(toPlain(await toWire(row))));
});

// ─── Upload file to Supabase Storage ─────────────────────────────────────────

router.post("/documents/upload", async (req, res): Promise<void> => {
  const parsed = UploadDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const resolved = await resolveEntity(parsed.data.entityType, parsed.data.entityId, parsed.data.bankId);
  if ("error" in resolved) {
    res.status(404).json({ error: resolved.error });
    return;
  }

  // Parse the base64 data URL into a buffer + MIME type.
  let contentType: string;
  let buffer: Buffer;
  try {
    ({ contentType, buffer } = parseDataUrl(parsed.data.fileDataBase64));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid file data" });
    return;
  }

  // Enforce maximum file size (20 MB).
  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
  if (buffer.byteLength > MAX_FILE_BYTES) {
    res.status(400).json({ error: `حجم الملف (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB) يتجاوز الحد المسموح (20 MB). يرجى ضغط الملف أو تقسيمه.` });
    return;
  }

  // Build a safe filename for OneDrive (keep original for display, sanitise for path).
  const rawName = parsed.data.fileName ?? "file";
  const ext = rawName.includes(".") ? rawName.slice(rawName.lastIndexOf(".")) : "";
  const safeName = rawName
    .replace(/[^\x00-\x7F]/g, "")     // strip non-ASCII
    .replace(/[^a-zA-Z0-9._-]/g, "_") // replace special chars
    .replace(/^_+|_+$/g, "")          // trim underscores
    || `file${ext}`;

  // Folder inside OneDrive: documents/<entityType>/<entityId>/
  const folderPath = `documents/${resolved.entityType}/${resolved.entityId}`;
  const fileName = `${Date.now()}_${safeName}`;

  let onedriveItemId: string;
  try {
    onedriveItemId = await uploadToOneDrive(folderPath, fileName, buffer, contentType);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    return;
  }

  // Store as "onedrive:<itemId>" so resolveStoredUrl routes it correctly.
  const storagePath = `onedrive:${onedriveItemId}`;

  const [row] = await db
    .insert(filesTable)
    .values({
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      title: parsed.data.title,
      docType: parsed.data.docType,
      fileName: parsed.data.fileName,
      fileType: contentType,
      fileSize: buffer.byteLength,
      storagePath,
      uploadedBy: req.authUser?.name ?? null,
      uploadedAt: new Date(),
    })
    .returning();

  await logAudit(req, {
    action: "CREATE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
    details: { source: "onedrive-upload", onedriveItemId, folderPath },
  });
  res.status(201).json(UploadDocumentResponse.parse(toPlain(await toWire(row))));
});

// ─── Update metadata ──────────────────────────────────────────────────────────

router.patch("/documents/:id", async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(filesTable)
    .set({ ...parsed.data, updatedBy: req.authUser?.name ?? null })
    .where(eq(filesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await logAudit(req, {
    action: "UPDATE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
    details: parsed.data,
  });
  res.json(UpdateDocumentResponse.parse(toPlain(await toWire(row))));
});

// ─── Archive (soft delete) ────────────────────────────────────────────────────

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Archive = set isArchived flag only. The Supabase Storage object is NOT
  // removed so the file can be restored later. A separate hard-delete /
  // cleanup job would call deleteFromStorage() if permanent removal is needed.
  const [row] = await db
    .update(filesTable)
    .set({ isArchived: true, archivedAt: new Date(), archivedBy: req.authUser?.name ?? null })
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.isArchived, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found or already archived" });
    return;
  }
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.sendStatus(204);
});

// ─── Restore ──────────────────────────────────────────────────────────────────

router.post("/documents/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Restore = un-archive. No storage operation needed — the Supabase Storage
  // object was never removed during archive.
  const [row] = await db
    .update(filesTable)
    .set({ isArchived: false, archivedAt: null, archivedBy: null })
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.isArchived, true)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found or not archived" });
    return;
  }
  await logAudit(req, {
    action: "RESTORE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.json(RestoreDocumentResponse.parse(toPlain(await toWire(row))));
});

export default router;

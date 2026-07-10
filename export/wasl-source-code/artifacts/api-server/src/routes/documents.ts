import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, filesTable, banksTable, productsTable, meetingsTable } from "@workspace/db";
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
import { uploadFileToOneDrive, moveOneDriveItem, type OneDriveFolder } from "../lib/onedrive";
import { resignFileUrl } from "../lib/file-tokens";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("documents"));

const DEFAULT_FOLDER: OneDriveFolder = "Banks";

// entityType -> OneDrive subfolder + the DB table/column used to verify the
// parent record exists before we ever touch OneDrive or write a files row.
const ENTITY_CONFIG = {
  bank: { folder: "Banks" as OneDriveFolder, table: banksTable, idColumn: banksTable.id },
  product: { folder: "Products" as OneDriveFolder, table: productsTable, idColumn: productsTable.id },
  meeting: { folder: "Meetings" as OneDriveFolder, table: meetingsTable, idColumn: meetingsTable.id },
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
  // bankId is a deprecated alias kept for older clients -- treat it as
  // entityType="bank" when no explicit entityType/entityId is given.
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

// Bank documents were the only "entity type" with an upload UI originally,
// so the wire format keeps exposing `bankId` (only populated for bank docs)
// for backward compatibility, alongside the generic entityType/entityId.
function toWire(row: typeof filesTable.$inferSelect) {
  return {
    ...row,
    bankId: row.entityType === "bank" ? row.entityId : null,
    oneDriveItemId: row.onedriveFileId,
    oneDriveWebUrl: resignFileUrl(row.onedriveUrl),
  };
}

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
  res.json(ListDocumentsResponse.parse(toPlain(rows.map(toWire))));
});

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
  res.status(201).json(CreateDocumentResponse.parse(toPlain(toWire(row))));
});

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
  const folder = ENTITY_CONFIG[resolved.entityType].folder;
  // Files live directly under /Wasl Documents/<folder> (not per-entity
  // folders); prefix with the entity type + id so identically-named uploads
  // across different banks/products/meetings never collide.
  const safeFileName = `${resolved.entityType}-${resolved.entityId}_${Date.now()}_${parsed.data.fileName}`;
  let uploadResult;
  try {
    uploadResult = await uploadFileToOneDrive(folder, safeFileName, parsed.data.fileDataBase64);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    return;
  }
  const [row] = await db
    .insert(filesTable)
    .values({
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      title: parsed.data.title,
      docType: parsed.data.docType,
      folder,
      fileName: parsed.data.fileName,
      fileType: uploadResult.contentType,
      fileSize: uploadResult.size,
      onedriveFileId: uploadResult.itemId,
      onedriveUrl: `/api/files/content/${encodeURIComponent(uploadResult.itemId)}`,
      uploadedBy: req.authUser?.name ?? null,
      uploadedAt: new Date(),
    })
    .returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
    details: { source: "onedrive-upload" },
  });
  res.status(201).json(UploadDocumentResponse.parse(toPlain(toWire(row))));
});

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
  res.json(UpdateDocumentResponse.parse(toPlain(toWire(row))));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (existing.onedriveFileId) {
    try {
      await moveOneDriveItem(existing.onedriveFileId, "Archive");
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Failed to archive OneDrive file" });
      return;
    }
  }
  const [row] = await db
    .update(filesTable)
    .set({ isArchived: true, archivedAt: new Date(), archivedBy: req.authUser?.name ?? null })
    .where(eq(filesTable.id, params.data.id))
    .returning();
  await logAudit(req, {
    action: "ARCHIVE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.sendStatus(204);
});

router.post("/documents/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (existing.onedriveFileId) {
    // Legacy rows migrated from the old per-bank-folder `documents` table
    // never had a `folder` value -- fall back to the fixed Banks folder so
    // restore always has somewhere valid to move the item back to.
    const targetFolder = (existing.folder as OneDriveFolder) || DEFAULT_FOLDER;
    try {
      await moveOneDriveItem(existing.onedriveFileId, targetFolder);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Failed to restore OneDrive file" });
      return;
    }
  }
  const [row] = await db
    .update(filesTable)
    .set({ isArchived: false, archivedAt: null, archivedBy: null, folder: existing.folder || DEFAULT_FOLDER })
    .where(eq(filesTable.id, params.data.id))
    .returning();
  await logAudit(req, {
    action: "RESTORE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.json(RestoreDocumentResponse.parse(toPlain(toWire(row))));
});

export default router;

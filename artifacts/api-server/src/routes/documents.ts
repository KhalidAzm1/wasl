import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, filesTable, banksTable } from "@workspace/db";
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
import { requireAuth } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { uploadFileToOneDrive, moveOneDriveItem, type OneDriveFolder } from "../lib/onedrive";
import { resignFileUrl } from "../lib/file-tokens";

const router: IRouter = Router();
router.use(requireAuth);

const DEFAULT_FOLDER: OneDriveFolder = "Banks";

// Bank documents are the only "entity type" with an upload UI today, so this
// router keeps talking about `bankId` on the wire -- underneath, rows are
// stored in the generic `files` table as entityType="bank".
function toWire(row: typeof filesTable.$inferSelect) {
  return {
    ...row,
    bankId: row.entityId,
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
  const rows = query.data.bankId
    ? await db
        .select()
        .from(filesTable)
        .where(
          and(
            eq(filesTable.entityType, "bank"),
            eq(filesTable.entityId, query.data.bankId),
            eq(filesTable.isArchived, false),
          ),
        )
    : await db
        .select()
        .from(filesTable)
        .where(and(eq(filesTable.entityType, "bank"), eq(filesTable.isArchived, false)));
  res.json(ListDocumentsResponse.parse(toPlain(rows.map(toWire))));
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [bank] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, parsed.data.bankId));
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  const [row] = await db
    .insert(filesTable)
    .values({
      entityType: "bank",
      entityId: parsed.data.bankId,
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
  const [bank] = await db.select().from(banksTable).where(eq(banksTable.id, parsed.data.bankId));
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  // Files live directly under /Wasl Documents/Banks (not per-bank folders);
  // (bank existence is checked above, before we ever touch OneDrive)
  // prefix with the bank id so identically-named uploads never collide.
  const safeFileName = `${bank.id}_${Date.now()}_${parsed.data.fileName}`;
  let uploadResult;
  try {
    uploadResult = await uploadFileToOneDrive("Banks", safeFileName, parsed.data.fileDataBase64);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    return;
  }
  const [row] = await db
    .insert(filesTable)
    .values({
      entityType: "bank",
      entityId: parsed.data.bankId,
      title: parsed.data.title,
      docType: parsed.data.docType,
      folder: "Banks",
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

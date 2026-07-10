import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, documentsTable, banksTable } from "@workspace/db";
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
import { uploadFileToOneDrive } from "../lib/onedrive";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/documents", async (req, res): Promise<void> => {
  const query = ListDocumentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.bankId
    ? await db
        .select()
        .from(documentsTable)
        .where(and(eq(documentsTable.bankId, query.data.bankId), eq(documentsTable.isArchived, false)))
    : await db.select().from(documentsTable).where(eq(documentsTable.isArchived, false));
  res.json(ListDocumentsResponse.parse(toPlain(rows)));
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(documentsTable)
    .values({ ...parsed.data, uploadedBy: req.authUser?.name ?? null, uploadedAt: new Date() })
    .returning();
  await logAudit(req, {
    action: "CREATE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.status(201).json(CreateDocumentResponse.parse(toPlain(row)));
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
  let uploadResult;
  try {
    uploadResult = await uploadFileToOneDrive(bank.nameEn, parsed.data.fileName, parsed.data.fileDataBase64);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    return;
  }
  const [row] = await db
    .insert(documentsTable)
    .values({
      bankId: parsed.data.bankId,
      title: parsed.data.title,
      docType: parsed.data.docType,
      oneDriveItemId: uploadResult.itemId,
      oneDriveWebUrl: uploadResult.webUrl,
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
  res.status(201).json(UploadDocumentResponse.parse(toPlain(row)));
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
    .update(documentsTable)
    .set({ ...parsed.data, updatedBy: req.authUser?.name ?? null })
    .where(eq(documentsTable.id, params.data.id))
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
  res.json(UpdateDocumentResponse.parse(toPlain(row)));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(documentsTable)
    .set({ isArchived: true, archivedAt: new Date(), archivedBy: req.authUser?.name ?? null })
    .where(eq(documentsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
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

router.post("/documents/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(documentsTable)
    .set({ isArchived: false, archivedAt: null, archivedBy: null })
    .where(eq(documentsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await logAudit(req, {
    action: "RESTORE",
    entityType: "document",
    entityId: row.id,
    entityLabel: row.title,
  });
  res.json(RestoreDocumentResponse.parse(toPlain(row)));
});

export default router;

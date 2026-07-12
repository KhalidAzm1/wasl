import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Generic file/attachment metadata table. The actual file bytes are stored in
// Supabase Storage (bucket: wasl-documents); only metadata lives here.
// `entityType` + `entityId` link a file to a bank, product, or meeting.
export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'bank' | 'product' | 'meeting'
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  docType: text("doc_type"),
  link: text("link"), // for link-only records registered without a file upload
  folder: text("folder"), // legacy: OneDrive subfolder (kept for old rows; unused for new uploads)
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  // Supabase Storage path (e.g. bank/42/1720700000_report.pdf).
  // Null for link-only records and pre-migration legacy rows.
  storagePath: text("storage_path"),
  // Legacy OneDrive fields — kept so old rows remain readable. Not populated
  // for new uploads. Will be dropped in a future migration once all legacy
  // rows have been cleaned up.
  onedriveFileId: text("onedrive_file_id"),
  onedriveUrl: text("onedrive_url"),
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: text("archived_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type WaslFile = typeof filesTable.$inferSelect;

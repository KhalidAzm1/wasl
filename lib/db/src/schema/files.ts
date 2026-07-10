import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Generic file/attachment metadata table. Supabase stores ONLY this metadata --
// the actual file bytes always live in Microsoft OneDrive (see lib/onedrive.ts).
// `entityType` + `entityId` let this back bank documents today and product /
// meeting attachments later without further schema churn.
export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'bank' | 'product' | 'meeting'
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  docType: text("doc_type"),
  link: text("link"), // for link-only records registered without a file upload
  folder: text("folder"), // OneDrive subfolder this file's item lives in (Banks/Products/Meetings) -- used to restore from Archive
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
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

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => banksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  link: text("link"),
  docType: text("doc_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

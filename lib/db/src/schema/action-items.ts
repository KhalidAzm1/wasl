import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => banksTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  dueDate: text("due_date"),
  owner: text("owner"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActionItemSchema = createInsertSchema(
  actionItemsTable,
).omit({ id: true, createdAt: true });
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItemsTable.$inferSelect;

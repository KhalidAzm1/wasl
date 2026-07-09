import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => banksTable.id, { onDelete: "cascade" }),
  productCode: text("product_code").notNull(),
  categoryStage: text("category_stage").notNull(),
  status: text("status").notNull(),
  progressPercent: real("progress_percent").notNull().default(0),
  dateType: text("date_type"),
  dateValue: text("date_value"),
  responsiblePerson: text("responsible_person"),
  priorityImpact: text("priority_impact"),
  descriptionNotes: text("description_notes"),
  riskLevel: text("risk_level"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

import { pgTable, serial, text, timestamp, boolean, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const productTypesTable = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductTypeSchema = createInsertSchema(productTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductType = z.infer<typeof insertProductTypeSchema>;
export type ProductType = typeof productTypesTable.$inferSelect;

export const bankProductTypesTable = pgTable(
  "bank_product_types",
  {
    bankId: text("bank_id")
      .notNull()
      .references(() => banksTable.id, { onDelete: "cascade" }),
    productTypeId: integer("product_type_id")
      .notNull()
      .references(() => productTypesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.bankId, table.productTypeId] })],
);

export type BankProductType = typeof bankProductTypesTable.$inferSelect;

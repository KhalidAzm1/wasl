import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const productStagesTable = pgTable("product_stages", {
  id:           serial("id").primaryKey(),
  productId:    integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  completed:    boolean("completed").notNull().default(false),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ProductStage = typeof productStagesTable.$inferSelect;

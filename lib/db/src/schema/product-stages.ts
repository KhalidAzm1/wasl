import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const productStagesTable = pgTable("product_stages", {
  id:           serial("id").primaryKey(),
  productId:    integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  completed:    boolean("completed").notNull().default(false),
  isCurrent:    boolean("is_current").notNull().default(false),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ProductStage = typeof productStagesTable.$inferSelect;

export const productPhaseHistoryTable = pgTable("product_phase_history", {
  id:            serial("id").primaryKey(),
  productId:     integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  fromStageId:   integer("from_stage_id").references(() => productStagesTable.id, { onDelete: "set null" }),
  fromStageName: text("from_stage_name"),
  toStageId:     integer("to_stage_id").references(() => productStagesTable.id, { onDelete: "set null" }),
  toStageName:   text("to_stage_name").notNull(),
  changedById:   text("changed_by_id"),
  changedByName: text("changed_by_name"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductPhaseHistory = typeof productPhaseHistoryTable.$inferSelect;

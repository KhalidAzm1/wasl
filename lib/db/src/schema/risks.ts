import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { banksTable } from "./banks";

export const risksTable = pgTable("risks", {
  id: serial("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => banksTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  level: text("level").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRiskSchema = createInsertSchema(risksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risksTable.$inferSelect;

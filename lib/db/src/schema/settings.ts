import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lookupsTable = pgTable("lookups", {
  key: text("key").primaryKey(),
  values: text("values").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertLookupSchema = createInsertSchema(lookupsTable).omit({
  updatedAt: true,
});
export type InsertLookup = z.infer<typeof insertLookupSchema>;
export type Lookup = typeof lookupsTable.$inferSelect;

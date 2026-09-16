import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const externalServiceHealthTable = pgTable("external_service_health", {
  serviceKey: text("service_key").primaryKey(),
  serviceName: text("service_name").notNull(),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms"),
  message: text("message"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExternalServiceHealth = typeof externalServiceHealthTable.$inferSelect;
export type NewExternalServiceHealth = typeof externalServiceHealthTable.$inferInsert;

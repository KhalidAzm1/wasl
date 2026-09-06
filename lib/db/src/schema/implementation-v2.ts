import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { banksTable } from "./banks";

// ── Tables ────────────────────────────────────────────────────────────────────

export const implementationStagesTable = pgTable("implementation_stages", {
  id:           serial("id").primaryKey(),
  bankId:       text("bank_id").notNull().references(() => banksTable.id, { onDelete: "cascade" }),
  trackType:    text("track_type").notNull().default("business"),
  name:         text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  percentage:   numeric("percentage", { precision: 5, scale: 2 }),
  status:       text("status").notNull().default("not_started"),
  skipped:      boolean("skipped").notNull().default(false),
  completed:    boolean("completed").notNull().default(false),
  completedAt:  text("completed_at"),
  owner:        text("owner"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const implementationSubStagesTable = pgTable("implementation_sub_stages", {
  id:           serial("id").primaryKey(),
  stageId:      integer("stage_id").notNull().references(() => implementationStagesTable.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  status:       text("status").notNull().default("not_started"),
  skipped:      boolean("skipped").notNull().default(false),
  completed:    boolean("completed").notNull().default(false),
  completedAt:  text("completed_at"),
  owner:        text("owner"),
  notes:        text("notes"),
});

export const implementationSettingsTable = pgTable("implementation_settings", {
  id:        serial("id").primaryKey(),
  key:       text("key").notNull().unique(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImplementationStageV2     = typeof implementationStagesTable.$inferSelect;
export type ImplementationSubStage    = typeof implementationSubStagesTable.$inferSelect;
export type ImplementationSettingRow  = typeof implementationSettingsTable.$inferSelect;

export type ImplementationStatusV2 = "not_started" | "in_progress" | "completed" | "skipped" | "blocked";
export type PercentageMode = "dynamic" | "fixed";
export type ImplementationTrackType = "business" | "technical";

export const DEFAULT_STAGE_NAMES = [
  "Initial Engagement",
  "NDA",
  "Agreement",
  "Business Analysis",
  "Technical Development",
  "Integration Testing (STG)",
  "User Acceptance Testing (UAT)",
  "Penetration Testing & Vulnerability Assessment (PT-AV)",
  "Go-Live Preparation",
  "Production Go-Live",
];

export const TECHNICAL_STAGE_NAMES = [
  "Kick-Off",
  "Analysis",
  "Development and Integration",
  "Testing",
  "Rollout",
];

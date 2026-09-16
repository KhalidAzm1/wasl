import { pgTable, text, integer, bigint, timestamp } from "drizzle-orm/pg-core";

export const backupRunsTable = pgTable("backup_runs", {
  id: text("id").primaryKey(),
  backupType: text("backup_type").notNull().default("manual_full"),
  status: text("status").notNull(),
  provider: text("provider").notNull().default("onedrive"),
  storagePath: text("storage_path"),
  oneDriveItemId: text("onedrive_item_id"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  checksumSha256: text("checksum_sha256"),
  encryption: text("encryption").notNull().default("AES-256-GCM"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  destroyedAt: timestamp("destroyed_at", { withTimezone: true }),
  createdBy: text("created_by"),
});

export const backupRecoveryTestsTable = pgTable("backup_recovery_tests", {
  id: text("id").primaryKey(),
  backupRunId: text("backup_run_id").references(() => backupRunsTable.id),
  status: text("status").notNull(),
  notes: text("notes"),
  testedBy: text("tested_by"),
  testedAt: timestamp("tested_at", { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer("duration_seconds"),
});

export type BackupRun = typeof backupRunsTable.$inferSelect;
export type BackupRecoveryTest = typeof backupRecoveryTestsTable.$inferSelect;

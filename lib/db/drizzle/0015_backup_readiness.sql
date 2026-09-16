CREATE TABLE IF NOT EXISTS "backup_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "backup_type" text DEFAULT 'manual_full' NOT NULL,
  "status" text NOT NULL,
  "provider" text DEFAULT 'onedrive' NOT NULL,
  "storage_path" text,
  "onedrive_item_id" text,
  "size_bytes" bigint,
  "checksum_sha256" text,
  "encryption" text DEFAULT 'AES-256-GCM' NOT NULL,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "destroyed_at" timestamp with time zone,
  "created_by" text,
  CONSTRAINT "backup_runs_status_check" CHECK ("status" IN ('running', 'successful', 'failed')),
  CONSTRAINT "backup_runs_type_check" CHECK ("backup_type" IN ('manual_full', 'weekly_full', 'monthly_full'))
);

CREATE TABLE IF NOT EXISTS "backup_recovery_tests" (
  "id" text PRIMARY KEY NOT NULL,
  "backup_run_id" text REFERENCES "backup_runs"("id"),
  "status" text NOT NULL,
  "notes" text,
  "tested_by" text,
  "tested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "duration_seconds" integer,
  CONSTRAINT "backup_recovery_tests_status_check" CHECK ("status" IN ('passed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "backup_runs_started_at_idx" ON "backup_runs" ("started_at" DESC);
CREATE INDEX IF NOT EXISTS "backup_recovery_tests_tested_at_idx" ON "backup_recovery_tests" ("tested_at" DESC);

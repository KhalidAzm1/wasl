CREATE INDEX IF NOT EXISTS "bip_bank_id_idx" ON "bank_implementation_progress" ("bank_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bip_stage_idx" ON "bank_implementation_progress" ("stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bip_completed_idx" ON "bank_implementation_progress" ("completed");

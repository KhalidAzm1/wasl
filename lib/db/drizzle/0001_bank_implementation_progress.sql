CREATE TABLE "bank_implementation_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" text,
	"notes" text,
	"owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bip_bank_stage_unique" UNIQUE("bank_id","stage")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_implementation_progress" ADD CONSTRAINT "bank_implementation_progress_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "banks" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"logo_url" text,
	"hero_image_url" text,
	"reference_link" text,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_level" text NOT NULL,
	"priority_impact" text NOT NULL,
	"responsible_person" text,
	"relationship_manager" text,
	"email" text,
	"website" text,
	"last_meeting_date" text,
	"last_meeting_summary" text,
	"next_meeting_date" text,
	"next_meeting_topic" text,
	"next_action" text,
	"executive_summary" text,
	"description_notes" text,
	"updated_by" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_id" text NOT NULL,
	"product_code" text NOT NULL,
	"category_stage" text NOT NULL,
	"status" text NOT NULL,
	"progress_percent" real DEFAULT 0 NOT NULL,
	"date_type" text,
	"date_value" text,
	"responsible_person" text,
	"priority_impact" text,
	"description_notes" text,
	"risk_level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_id" text NOT NULL,
	"date" text NOT NULL,
	"topic" text NOT NULL,
	"summary" text,
	"attendees" text,
	"status" text,
	"updated_by" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "risks" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_id" text NOT NULL,
	"description" text NOT NULL,
	"level" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_id" text NOT NULL,
	"description" text NOT NULL,
	"due_date" text,
	"owner" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"doc_type" text,
	"link" text,
	"folder" text,
	"file_name" text,
	"file_type" text,
	"file_size" integer,
	"onedrive_file_id" text,
	"onedrive_url" text,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone,
	"updated_by" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lookups" (
	"key" text PRIMARY KEY NOT NULL,
	"values" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_product_types" (
	"bank_id" text NOT NULL,
	"product_type_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_product_types_bank_id_product_type_id_pk" PRIMARY KEY("bank_id","product_type_id")
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"entity_label" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_product_types" ADD CONSTRAINT "bank_product_types_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_product_types" ADD CONSTRAINT "bank_product_types_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE cascade ON UPDATE no action;
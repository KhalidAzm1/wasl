CREATE TABLE IF NOT EXISTS "external_service_health" (
  "service_key" text PRIMARY KEY NOT NULL,
  "service_name" text NOT NULL,
  "status" text NOT NULL,
  "latency_ms" integer,
  "message" text,
  "last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_successful_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "external_service_health_status_check"
    CHECK ("status" IN ('healthy', 'degraded', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS "external_service_health_status_idx"
  ON "external_service_health" ("status");

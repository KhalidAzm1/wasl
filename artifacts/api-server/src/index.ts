import app from "./app";
import { logger } from "./lib/logger";
import { ensureStorageBucket } from "./lib/supabase-storage";
import { fixLogoPaths } from "./lib/fix-logo-paths";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Best-effort: ensure the Supabase Storage bucket exists so upload routes
  // never fail on a missing bucket. Never blocks server startup.
  ensureStorageBucket().catch((bucketErr) => {
    logger.warn({ err: bucketErr }, "Failed to ensure Supabase Storage bucket");
  });

  // One-time idempotent fix: sync missing/broken logo paths for known banks.
  fixLogoPaths().catch((fixErr) => {
    logger.warn({ err: fixErr }, "fixLogoPaths failed (non-fatal)");
  });

  // Idempotent schema additions — safe to re-run on every startup.
  // This ensures the column exists on both dev and production without
  // requiring a full Drizzle migration run.
  db.execute(sql`
    ALTER TABLE banks ADD COLUMN IF NOT EXISTS responsible_person_photo text;
    ALTER TABLE banks ADD COLUMN IF NOT EXISTS responsible_persons jsonb;
  `)
    .then(() => logger.info("responsible_person_photo + responsible_persons columns ensured"))
    .catch((alterErr) =>
      logger.warn({ err: alterErr }, "bootstrap schema alter failed (non-fatal)"),
    );
});

// --- Graceful shutdown: drain in-flight requests then close DB pool ---
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received — closing server");
  server.close(async () => {
    logger.info("HTTP server closed");
    logger.info("Shutdown complete");
    process.exit(0);
  });
  // Force-kill if graceful close takes > 10 s
  setTimeout(() => {
    logger.warn("Graceful shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Catch unhandled promise rejections so they don't silently crash Node
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

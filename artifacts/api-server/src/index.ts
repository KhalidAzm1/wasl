import app from "./app";
import { logger } from "./lib/logger";
import { ensureStorageBucket } from "./lib/supabase-storage";
import { fixLogoPaths } from "./lib/fix-logo-paths";
import { db } from "@workspace/db";

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
  ensureStorageBucket().catch((err) => {
    logger.warn({ err }, "Failed to ensure Supabase Storage bucket");
  });

  // One-time idempotent fix: sync missing/broken logo paths for known banks.
  fixLogoPaths().catch((err) => {
    logger.warn({ err }, "fixLogoPaths failed (non-fatal)");
  });
});

// --- Graceful shutdown: drain in-flight requests then close DB pool ---
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received — closing server");
  server.close(async () => {
    logger.info("HTTP server closed, draining DB pool");
    try {
      await (db as unknown as { $client?: { end?: () => Promise<void> } }).$client?.end?.();
    } catch {
      // ignore pool close errors
    }
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
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch unhandled promise rejections so they don't silently crash Node
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

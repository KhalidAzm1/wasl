import app from "./app";
import { logger } from "./lib/logger";
import { ensureStorageBucket } from "./lib/supabase-storage";

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

app.listen(port, (err) => {
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
});

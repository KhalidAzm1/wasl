import app from "./app";
import { logger } from "./lib/logger";
import { ensureWaslFolders } from "./lib/onedrive";

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

  // Best-effort: make sure the Wasl Documents/Banks/Products/Meetings/Archive
  // folder structure exists in OneDrive. Never blocks server startup.
  ensureWaslFolders().catch((err) => {
    logger.warn({ err }, "Failed to ensure OneDrive folder structure");
  });
});

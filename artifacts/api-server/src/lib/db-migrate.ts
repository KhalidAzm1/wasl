/**
 * Runs Drizzle migrations against the database before the server starts.
 * This ensures all tables exist in every environment (dev, production, after
 * re-deploy) without requiring a manual `drizzle-kit push` step.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import path from "path";
import { db } from "@workspace/db";
import { logger } from "./logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Relative from artifacts/api-server/src/lib/ → workspace root → lib/db/drizzle
 * Works both with tsx (source) and compiled JS (same relative layout in dist/).
 */
const migrationsFolder = path.resolve(__dirname, "../../../../lib/db/drizzle");

export async function runMigrations(): Promise<void> {
  logger.info({ migrationsFolder }, "Running DB migrations…");
  try {
    await migrate(db, { migrationsFolder });
    logger.info("DB migrations applied successfully");
  } catch (err) {
    logger.error({ err }, "DB migration failed — server will not start");
    throw err;
  }
}

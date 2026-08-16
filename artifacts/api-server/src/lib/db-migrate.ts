/**
 * Runs Drizzle migrations against the database before the server starts.
 * This ensures all tables exist in every environment (dev, production, after
 * re-deploy) without requiring a manual `drizzle-kit push` step.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
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

/**
 * Idempotent column additions that may not yet be in a drizzle migration file.
 * Using IF NOT EXISTS so they are always safe to run on every startup.
 */
async function runBootstrapAlters(): Promise<void> {
  await db.execute(sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS responsible_person_photo text`);
}

export async function runMigrations(): Promise<void> {
  logger.info({ migrationsFolder }, "Running DB migrations…");
  try {
    await migrate(db, { migrationsFolder });
    logger.info("DB migrations applied successfully");
  } catch (err) {
    logger.error({ err }, "DB migration failed — server will not start");
    throw err;
  }
  try {
    await runBootstrapAlters();
    logger.info("Bootstrap column alters applied");
  } catch (err) {
    logger.error({ err }, "Bootstrap alter failed — server will not start");
    throw err;
  }
}

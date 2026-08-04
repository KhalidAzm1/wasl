/**
 * One-time idempotent fix: ensures specific banks have their Supabase Storage
 * logo paths set correctly. Runs at server startup so production picks it up
 * automatically after publish without any manual SQL.
 *
 * Safe to run multiple times — only updates rows whose logo_url is NULL,
 * empty, or still points to OneDrive (onedrive: prefix).
 */
import { db, banksTable } from "@workspace/db";
import { eq, or, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";

const LOGO_FIXES: Record<string, string> = {
  "BANK-023": "bank-images/BANK-023/logo_1784548321334",
  "BANK-027": "bank-images/BANK-027/logo_migrated.svg",
  "BANK-028": "bank-images/BANK-028/logo_migrated.jpg",
  "BANK-029": "bank-images/BANK-029/logo_1784548273985",
};

export async function fixLogoPaths(): Promise<void> {
  try {
    for (const [bankId, storagePath] of Object.entries(LOGO_FIXES)) {
      const [bank] = await db
        .select({ id: banksTable.id, logoUrl: banksTable.logoUrl })
        .from(banksTable)
        .where(eq(banksTable.id, bankId));

      if (!bank) continue;

      const needsFix =
        !bank.logoUrl ||
        bank.logoUrl.trim() === "" ||
        bank.logoUrl.startsWith("onedrive:");

      if (!needsFix) continue;

      await db
        .update(banksTable)
        .set({ logoUrl: storagePath })
        .where(eq(banksTable.id, bankId));

      logger.info({ bankId, storagePath }, "Fixed logo path");
    }
  } catch (err) {
    // Non-fatal — log and continue; logos can be re-uploaded manually
    logger.warn({ err }, "fixLogoPaths: failed (non-fatal)");
  }
}

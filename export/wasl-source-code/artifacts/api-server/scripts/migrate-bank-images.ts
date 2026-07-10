/**
 * One-off migration: moves any legacy base64 logo/hero images stored
 * directly in the `banks` table into OneDrive, rewriting the column to the
 * stable /api/files/content/:itemId proxy URL and recording metadata in the
 * generic `files` table. Safe to re-run -- rows that don't start with
 * "data:" are left untouched.
 */
import { eq } from "drizzle-orm";
import { db, banksTable, filesTable } from "@workspace/db";
import { uploadFileToOneDrive } from "../src/lib/onedrive";

async function migrateColumn(kind: "logo" | "hero") {
  const banks = await db.select().from(banksTable);
  for (const bank of banks) {
    const value = kind === "logo" ? bank.logoUrl : bank.heroImageUrl;
    if (!value || !value.startsWith("data:")) continue;
    const safeFileName = `${bank.id}_${kind}_${Date.now()}`;
    try {
      const result = await uploadFileToOneDrive("Banks", safeFileName, value);
      const onedriveUrl = `/api/files/content/${encodeURIComponent(result.itemId)}`;
      await db
        .update(banksTable)
        .set(kind === "logo" ? { logoUrl: onedriveUrl } : { heroImageUrl: onedriveUrl })
        .where(eq(banksTable.id, bank.id));
      await db.insert(filesTable).values({
        entityType: "bank_image",
        entityId: bank.id,
        title: kind === "logo" ? "Logo" : "Hero image",
        docType: kind,
        folder: "Banks",
        fileName: safeFileName,
        fileType: result.contentType,
        fileSize: result.size,
        onedriveFileId: result.itemId,
        onedriveUrl,
        uploadedBy: "migration",
        uploadedAt: new Date(),
      });
      console.log(`Migrated ${kind} for ${bank.id} -> ${onedriveUrl}`);
    } catch (err) {
      console.error(`Failed to migrate ${kind} for ${bank.id}:`, err);
    }
  }
}

async function main() {
  await migrateColumn("logo");
  await migrateColumn("hero");
  process.exit(0);
}

main();

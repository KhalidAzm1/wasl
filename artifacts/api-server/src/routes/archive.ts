import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, banksTable, filesTable, meetingsTable, bankProductTypesTable } from "@workspace/db";
import { GetArchiveResponse } from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { getSignedUrl, resolveStoredUrl } from "../lib/supabase-storage";

const router: IRouter = Router();
router.use(requireAuth, requirePermission("dashboard_access"));

router.get("/archive", async (_req, res): Promise<void> => {
  const [banks, documents, meetings] = await Promise.all([
    db.select().from(banksTable).where(eq(banksTable.isArchived, true)),
    db.select().from(filesTable).where(eq(filesTable.isArchived, true)),
    db.select().from(meetingsTable).where(eq(meetingsTable.isArchived, true)),
  ]);

  const banksWithProductTypes = await Promise.all(
    banks.map(async (bank) => {
      const rows = await db
        .select({ productTypeId: bankProductTypesTable.productTypeId })
        .from(bankProductTypesTable)
        .where(eq(bankProductTypesTable.bankId, bank.id));
      return { ...bank, productTypeIds: rows.map((row) => row.productTypeId) };
    }),
  );

  const documentsWire = await Promise.all(
    documents.map(async (row) => {
      let fileUrl: string | null = null;
      if (row.storagePath) {
        try {
          fileUrl = await getSignedUrl(row.storagePath);
        } catch {
          fileUrl = null;
        }
      }
      return {
        ...row,
        bankId: row.entityId,
        fileUrl,
        oneDriveWebUrl: fileUrl, // backward-compat alias
        oneDriveItemId: row.onedriveFileId ?? null,
      };
    }),
  );

  const banksWire = await Promise.all(
    banksWithProductTypes.map(async (bank) => {
      const [logoUrl, heroImageUrl] = await Promise.all([
        resolveStoredUrl(bank.logoUrl),
        resolveStoredUrl(bank.heroImageUrl),
      ]);
      return { ...bank, logoUrl, heroImageUrl };
    }),
  );

  res.json(GetArchiveResponse.parse(toPlain({ banks: banksWire, documents: documentsWire, meetings })));
});

export default router;

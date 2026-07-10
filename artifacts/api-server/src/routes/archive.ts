import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, banksTable, filesTable, meetingsTable, bankProductTypesTable } from "@workspace/db";
import { GetArchiveResponse } from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";
import { requireAuth } from "../middlewares/auth";
import { resignFileUrl } from "../lib/file-tokens";

const router: IRouter = Router();
router.use(requireAuth);

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
  const documentsWire = documents.map((row) => ({
    ...row,
    bankId: row.entityId,
    oneDriveItemId: row.onedriveFileId,
    oneDriveWebUrl: resignFileUrl(row.onedriveUrl),
  }));
  const banksWire = banksWithProductTypes.map((bank) => ({
    ...bank,
    logoUrl: resignFileUrl(bank.logoUrl),
    heroImageUrl: resignFileUrl(bank.heroImageUrl),
  }));
  res.json(GetArchiveResponse.parse(toPlain({ banks: banksWire, documents: documentsWire, meetings })));
});

export default router;

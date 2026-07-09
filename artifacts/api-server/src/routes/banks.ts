import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  banksTable,
  productsTable,
  meetingsTable,
  risksTable,
  actionItemsTable,
  documentsTable,
} from "@workspace/db";
import {
  CreateBankBody,
  UpdateBankParams,
  UpdateBankBody,
  DeleteBankParams,
  GetBankParams,
  GetBankResponse,
  ListBanksResponse,
  CreateBankResponse,
  UpdateBankResponse,
  SetBankLogoParams,
  SetBankLogoBody,
  SetBankLogoResponse,
  SetBankHeroImageParams,
  SetBankHeroImageBody,
  SetBankHeroImageResponse,
} from "@workspace/api-zod";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(dataUrl: string): string | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return "Image must be a base64 data URL (png, jpg, webp, gif, or svg)";
  }
  const base64Length = match[2].length;
  const approxBytes = Math.floor((base64Length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return "Image exceeds the 8MB size limit";
  }
  return null;
}

router.get("/banks", async (_req, res): Promise<void> => {
  const banks = await db.select().from(banksTable).orderBy(banksTable.nameEn);
  res.json(ListBanksResponse.parse(toPlain(banks)));
});

router.post("/banks", async (req, res): Promise<void> => {
  const parsed = CreateBankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = `BANK-${Date.now()}`;
  const [bank] = await db
    .insert(banksTable)
    .values({ id, ...parsed.data })
    .returning();
  res.status(201).json(CreateBankResponse.parse(toPlain(bank)));
});

router.get("/banks/:id", async (req, res): Promise<void> => {
  const params = GetBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .select()
    .from(banksTable)
    .where(eq(banksTable.id, params.data.id));
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  const [products, meetings, risks, actionItems, documents] =
    await Promise.all([
      db
        .select()
        .from(productsTable)
        .where(eq(productsTable.bankId, bank.id)),
      db
        .select()
        .from(meetingsTable)
        .where(eq(meetingsTable.bankId, bank.id)),
      db.select().from(risksTable).where(eq(risksTable.bankId, bank.id)),
      db
        .select()
        .from(actionItemsTable)
        .where(eq(actionItemsTable.bankId, bank.id)),
      db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.bankId, bank.id)),
    ]);
  res.json(
    GetBankResponse.parse(
      toPlain({
        ...bank,
        products,
        meetings,
        risks,
        actionItems,
        documents,
      }),
    ),
  );
});

router.patch("/banks/:id", async (req, res): Promise<void> => {
  const params = UpdateBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.logoUrl) {
    const imageError = validateImageDataUrl(parsed.data.logoUrl);
    if (imageError) {
      res.status(400).json({ error: imageError });
      return;
    }
  }
  if (parsed.data.heroImageUrl) {
    const imageError = validateImageDataUrl(parsed.data.heroImageUrl);
    if (imageError) {
      res.status(400).json({ error: imageError });
      return;
    }
  }
  const [bank] = await db
    .update(banksTable)
    .set(parsed.data)
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.json(UpdateBankResponse.parse(toPlain(bank)));
});

router.delete("/banks/:id", async (req, res): Promise<void> => {
  const params = DeleteBankParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bank] = await db
    .delete(banksTable)
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.sendStatus(204);
});

router.put("/banks/:id/logo", async (req, res): Promise<void> => {
  const params = SetBankLogoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetBankLogoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ logoUrl: parsed.data.dataUrl })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.json(SetBankLogoResponse.parse(toPlain(bank)));
});

router.put("/banks/:id/hero", async (req, res): Promise<void> => {
  const params = SetBankHeroImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetBankHeroImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const imageError = validateImageDataUrl(parsed.data.dataUrl);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const [bank] = await db
    .update(banksTable)
    .set({ heroImageUrl: parsed.data.dataUrl })
    .where(eq(banksTable.id, params.data.id))
    .returning();
  if (!bank) {
    res.status(404).json({ error: "Bank not found" });
    return;
  }
  res.json(SetBankHeroImageResponse.parse(toPlain(bank)));
});

export default router;

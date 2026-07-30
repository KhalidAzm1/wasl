/**
 * Quick-update routes — allow bank staff to submit a status update
 * via a signed, time-limited URL (no login required for the submission itself).
 *
 * Flow:
 *   Admin  → POST /api/quick-update/token  { bankId }  → { token, expiresAt }
 *   Public → GET  /api/quick-update/:token             → { bank, expiresAt }
 *   Public → POST /api/quick-update/:token/submit      → { ok }
 */
import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, banksTable, auditLogsTable } from "@workspace/db";
import { toPlain } from "../lib/serialize";
import { requireAuth, requireRole } from "../middlewares/auth";
import { invalidateActivityCache } from "./banks";
import { eventBus } from "../lib/event-bus";

const router: IRouter = Router();

// ── Token helpers ─────────────────────────────────────────────────────────────
const SECRET = process.env.SESSION_SECRET ?? "wasl-qu-fallback-secret";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — long enough for a printed QR

function makeToken(bankId: string, expiresAt: number): string {
  const payload = `${bankId}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function parseToken(raw: string): { bankId: string; expiresAt: number } | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    // sig is the last part; bankId may contain hyphens so re-join the id
    const sig = parts[parts.length - 1];
    const expiresAt = parseInt(parts[parts.length - 2], 10);
    const bankId = parts.slice(0, parts.length - 2).join(":");
    if (!bankId || !sig || isNaN(expiresAt)) return null;
    if (expiresAt < Date.now()) return null;
    const payload = `${bankId}:${expiresAt}`;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    return { bankId, expiresAt };
  } catch {
    return null;
  }
}

// ── Generate token (admin only) ───────────────────────────────────────────────
router.post("/quick-update/token", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const { bankId } = req.body as { bankId?: string };
  if (!bankId) { res.status(400).json({ error: "bankId required" }); return; }

  const [bank] = await db.select({ id: banksTable.id, nameEn: banksTable.nameEn }).from(banksTable).where(eq(banksTable.id, bankId));
  if (!bank) { res.status(404).json({ error: "Bank not found" }); return; }

  const expiresAt = Date.now() + TTL_MS;
  const token = makeToken(bankId, expiresAt);
  res.json({ token, expiresAt, bankId, bankNameEn: bank.nameEn });
});

// ── Verify token → return bank info (public) ──────────────────────────────────
router.get("/quick-update/:token", async (req, res): Promise<void> => {
  const parsed = parseToken(req.params.token);
  if (!parsed) { res.status(401).json({ error: "الرابط غير صالح أو منتهي الصلاحية" }); return; }

  const [bank] = await db
    .select({ id: banksTable.id, nameEn: banksTable.nameEn, nameAr: banksTable.nameAr, status: banksTable.status })
    .from(banksTable)
    .where(eq(banksTable.id, parsed.bankId));
  if (!bank) { res.status(404).json({ error: "البنك غير موجود" }); return; }

  res.json({ bank: toPlain(bank), expiresAt: parsed.expiresAt });
});

// ── Submit quick update (public, no auth needed) ──────────────────────────────
const ALLOWED_STATUSES = ["In Progress", "Completed", "Delayed", "Not Started", "Active - Integration In Progress"];

router.post("/quick-update/:token/submit", async (req, res): Promise<void> => {
  const parsed = parseToken(req.params.token);
  if (!parsed) { res.status(401).json({ error: "الرابط غير صالح أو منتهي الصلاحية" }); return; }

  const { submitterName, status, note } = req.body as {
    submitterName?: string;
    status?: string;
    note?: string;
  };

  if (!submitterName?.trim()) { res.status(400).json({ error: "الاسم مطلوب" }); return; }
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    res.status(400).json({ error: `الحالة غير صالحة. الخيارات: ${ALLOWED_STATUSES.join(" | ")}` });
    return;
  }

  const setFields: Record<string, unknown> = {
    status,
    updatedBy: submitterName.trim(),
  };
  if (note?.trim()) {
    setFields.descriptionNotes = note.trim();
  }

  const [updated] = await db
    .update(banksTable)
    .set(setFields)
    .where(eq(banksTable.id, parsed.bankId))
    .returning({ id: banksTable.id, nameAr: banksTable.nameAr, nameEn: banksTable.nameEn });

  if (!updated) { res.status(404).json({ error: "البنك غير موجود" }); return; }

  await db.insert(auditLogsTable).values({
    userId: null,
    userName: submitterName.trim(),
    userEmail: null,
    action: "UPDATE",
    entityType: "bank",
    entityId: updated.id,
    entityLabel: updated.nameEn,
    details: { source: "quick-update-qr", status, note },
  });

  invalidateActivityCache();
  eventBus.emit("bank_updated", { bankId: updated.id });
  res.json({ ok: true, bankNameAr: updated.nameAr });
});

export default router;

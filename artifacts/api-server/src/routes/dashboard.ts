import { Router, type IRouter } from "express";
import { desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  banksTable,
  meetingsTable,
  risksTable,
  actionItemsTable,
  documentsTable,
  productsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetActivityFeedResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const banks = await db.select().from(banksTable).where(eq(banksTable.isArchived, false));
  const activeBankIds = new Set(banks.map((b) => b.id));
  const risks = (await db.select().from(risksTable)).filter((r) => activeBankIds.has(r.bankId));
  const products = (await db.select().from(productsTable)).filter((p) => activeBankIds.has(p.bankId));

  const normalize = (s: string) => s.toLowerCase();
  const inProgress = banks.filter((b) =>
    normalize(b.status).includes("progress"),
  ).length;
  const completed = banks.filter((b) =>
    normalize(b.status).includes("complet"),
  ).length;
  const delayed = banks.filter((b) =>
    normalize(b.status).includes("delay"),
  ).length;
  const notStarted = banks.filter(
    (b) =>
      normalize(b.status).includes("not") ||
      normalize(b.status).includes("yet"),
  ).length;

  const now = new Date();
  const upcomingMeetings = banks.filter((b) => {
    if (!b.nextMeetingDate) return false;
    const d = new Date(b.nextMeetingDate);
    return !Number.isNaN(d.getTime()) && d.getTime() >= now.getTime();
  }).length;

  const highRisks = risks.filter(
    (r) => normalize(r.level) === "high" && normalize(r.status) !== "closed",
  ).length;

  const averageProgress = products.length
    ? products.reduce((sum, p) => sum + p.progressPercent, 0) /
      products.length
    : 0;

  const countBy = (values: string[]) => {
    const map = new Map<string, number>();
    for (const v of values) {
      map.set(v, (map.get(v) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, count]) => ({
      label,
      count,
    }));
  };

  res.json(
    GetDashboardSummaryResponse.parse({
      totalBanks: banks.length,
      inProgress,
      completed,
      delayed,
      notStarted,
      upcomingMeetings,
      highRisks,
      averageProgress,
      statusBreakdown: countBy(banks.map((b) => b.status)),
      riskBreakdown: countBy(banks.map((b) => b.riskLevel)),
      categoryBreakdown: countBy(banks.map((b) => b.category)),
    }),
  );
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const [meetings, risks, actionItems, documents, products, banks] =
    await Promise.all([
      db
        .select()
        .from(meetingsTable)
        .where(eq(meetingsTable.isArchived, false))
        .orderBy(desc(meetingsTable.createdAt))
        .limit(15),
      db.select().from(risksTable).orderBy(desc(risksTable.createdAt)).limit(15),
      db
        .select()
        .from(actionItemsTable)
        .orderBy(desc(actionItemsTable.createdAt))
        .limit(15),
      db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.isArchived, false))
        .orderBy(desc(documentsTable.createdAt))
        .limit(15),
      db
        .select()
        .from(productsTable)
        .orderBy(desc(productsTable.createdAt))
        .limit(15),
      db.select().from(banksTable).where(eq(banksTable.isArchived, false)),
    ]);

  const bankMap = new Map(banks.map((b) => [b.id, b]));

  const events = [
    ...meetings.map((m) => ({
      id: `meeting-${m.id}`,
      bankId: m.bankId,
      type: "meeting" as const,
      description: m.topic,
      date: m.createdAt.toISOString(),
    })),
    ...risks.map((r) => ({
      id: `risk-${r.id}`,
      bankId: r.bankId,
      type: "risk" as const,
      description: r.description,
      date: r.createdAt.toISOString(),
    })),
    ...actionItems.map((a) => ({
      id: `action-${a.id}`,
      bankId: a.bankId,
      type: "action" as const,
      description: a.description,
      date: a.createdAt.toISOString(),
    })),
    ...documents.map((d) => ({
      id: `document-${d.id}`,
      bankId: d.bankId,
      type: "document" as const,
      description: d.title,
      date: d.createdAt.toISOString(),
    })),
    ...products.map((p) => ({
      id: `product-${p.id}`,
      bankId: p.bankId,
      type: "product" as const,
      description: `${p.productCode} — ${p.status}`,
      date: p.createdAt.toISOString(),
    })),
  ]
    .filter((e) => bankMap.has(e.bankId))
    .map((e) => {
      const bank = bankMap.get(e.bankId)!;
      return {
        ...e,
        bankNameEn: bank.nameEn,
        bankNameAr: bank.nameAr,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 25);

  res.json(GetActivityFeedResponse.parse(events));
});

export default router;

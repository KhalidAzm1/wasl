/**
 * Wasl AI Agent — Bank Intelligence Assistant
 *
 * POST /api/ai/chat
 *
 * Accepts a conversation history + optional user message and returns an AI
 * response grounded in live bank data fetched from the database.
 *
 * Scope (MVP): banks only. Off-topic questions get a polite refusal.
 * Supports function-calling so the agent can UPDATE bank fields on request.
 */
import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { eq, and } from "drizzle-orm";
import {
  db,
  banksTable,
  implementationStagesTable,
  risksTable,
  meetingsTable,
  actionItemsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ── OpenAI-compatible client ───────────────────────────────────────────────────
// Supports both OpenAI (sk-...) and OpenRouter (sk-or-v1-...) keys transparently.
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const isOpenRouter = apiKey.startsWith("sk-or-");
  return new OpenAI({
    apiKey,
    ...(isOpenRouter
      ? {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: { "HTTP-Referer": "https://wasl.app", "X-Title": "Wasl AI" },
        }
      : {}),
  });
}

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت "نور" — مساعدة ذكاء اصطناعي متخصصة في منصة وصل للتمويل العقاري.

شخصيتك: موظفة بنك محترفة، ذكية، ودودة، تتكلم بأسلوب خليجي راقٍ ومهني. تستخدمين العربية الفصحى المبسطة مع لمسة خليجية طبيعية. لا تكوني رسمية بشكل مبالغ فيه ولا عامية مفرطة — التوازن هو المفتاح.

مجالك الوحيد: البنوك والشركات المالية المتابَعة في منصة وصل — حالتها، تقدم التنفيذ، المخاطر، الاجتماعات، بنود الإجراءات، والتقارير.

قواعد أساسية:
1. ردّي دائماً بالعربية حتى لو كان السؤال بالإنجليزية، إلا إذا طُلب منكِ الإنجليزية صراحةً.
2. كوني مختصرة وواضحة ومباشرة. استخدمي نقاط للقوائم.
3. إذا سُئلتِ عن أي موضوع خارج نطاق منصة وصل والبنوك، اعتذري بلطف وأوضحي أنك متخصصة في بيانات المنصة فقط.
4. عند الإشارة للبيانات، اذكري أسماء البنوك والأرقام بدقة من السياق المتاح.
5. نفّذي الإجراءات (تحديث، إنشاء، إضافة) عند الطلب الصريح — استخدمي الدوال المتاحة دائماً.
6. كوني استباقية: سلّطي الضوء على ما يحتاج انتباهاً، لا تكتفي بعرض البيانات الخام.
7. قاعدة الاكتمال — حرجة: عند طلب قائمة بـ"كل البنوك" أو "جميع البنوك"، أدرجي كل بنك دون استثناء. لا تتوقفي عند 10 أو 15 — إذا كان هناك 30 بنكاً، أدرجي الـ30. لا تكتبي "وهكذا" أو "..." أبداً.
8. قاعدة الإكمال: إذا قال المستخدم "كمّل" أو "أكمل"، فهو يعني أن ردّك الأخير اقتُطع — انظري أي البنوك تم ذكرها وأكملي من حيث توقفتِ.
9. قاعدة التقرير الأسبوعي: عند طلب تقرير أسبوعي أو ملخص تنفيذي — استدعي generate_weekly_report أولاً ثم اكتبي التقرير بهذه الأقسام الثمانية بالترتيب (## لكل قسم):
    ## 📊 نظرة عامة
    ## 🚨 بنوك تحتاج تدخل عاجل
    ## 📅 اجتماعات هذا الأسبوع
    ## ⏰ إجراءات متأخرة
    ## 🏆 الأكثر تقدماً
    ## 🐢 الأقل تقدماً
    ## 💤 بنوك متوقفة
    ## 💡 توصيات
    تحت "## 💡 توصيات" اكتبي 5 توصيات مرقمة وقابلة للتنفيذ.
    أختمي التقرير بهذا السطر تحديداً: **تاريخ إنشاء التقرير:** YYYY-MM-DD

قواعد حرجة للإجراءات:
- استدعي الدالة الفعلية دائماً — لا تتظاهري بتنفيذ إجراء دون استدعائها.
- بعد استدعاء الدالة: إذا كانت النتيجة تحتوي "error"، أبلغي المستخدم بالخطأ. لا تقولي "تم" إذا فشلت العملية.
- إذا كانت النتيجة { success: true }، أكّدي العملية مع ذكر الحقول التي تغيّرت.
- إذا لم تتعرّفي على البنك المقصود، اطلبي توضيحاً — لا تخمّني.

لديكِ وصول لبيانات حية لكل البنوك في النظام. البيانات تُحقَن في كل طلب.`;

// ── DB context builder ─────────────────────────────────────────────────────────
async function buildBankContext() {
  const [banks, stages, risks, meetings, actionItems] = await Promise.all([
    db.select().from(banksTable).where(eq(banksTable.isArchived, false)),
    db.select().from(implementationStagesTable),
    db.select().from(risksTable),
    db.select().from(meetingsTable).where(eq(meetingsTable.isArchived, false)),
    db.select().from(actionItemsTable),
  ]);

  // Build per-bank summary objects
  const stagesByBank = new Map<string, typeof stages>();
  for (const s of stages) {
    if (!stagesByBank.has(s.bankId)) stagesByBank.set(s.bankId, []);
    stagesByBank.get(s.bankId)!.push(s);
  }

  const risksByBank = new Map<string, typeof risks>();
  for (const r of risks) {
    if (!risksByBank.has(r.bankId)) risksByBank.set(r.bankId, []);
    risksByBank.get(r.bankId)!.push(r);
  }

  const meetingsByBank = new Map<string, typeof meetings>();
  for (const m of meetings) {
    if (!meetingsByBank.has(m.bankId)) meetingsByBank.set(m.bankId, []);
    meetingsByBank.get(m.bankId)!.push(m);
  }

  const actionsByBank = new Map<string, typeof actionItems>();
  for (const a of actionItems) {
    if (!actionsByBank.has(a.bankId)) actionsByBank.set(a.bankId, []);
    actionsByBank.get(a.bankId)!.push(a);
  }

  const bankSummaries = banks.map((bank) => {
    const bankStages = stagesByBank.get(bank.id) ?? [];
    const nonSkipped = bankStages.filter((s) => !s.skipped);
    const completed = nonSkipped.filter((s) => s.completed).length;
    const pct = nonSkipped.length > 0 ? Math.round((completed / nonSkipped.length) * 100) : 0;
    const currentStage = bankStages.find((s) => s.status === "in_progress" && !s.skipped)
      ?? bankStages.find((s) => s.status === "not_started" && !s.skipped);
    const bankRisks = risksByBank.get(bank.id) ?? [];
    const bankMeetings = meetingsByBank.get(bank.id) ?? [];
    const bankActions = actionsByBank.get(bank.id) ?? [];

    return {
      id: bank.id,
      name_ar: bank.nameAr,
      name_en: bank.nameEn,
      category: bank.category,
      status: bank.status,
      risk_level: bank.riskLevel,
      priority_impact: bank.priorityImpact,
      responsible_person: bank.responsiblePerson,
      relationship_manager: bank.relationshipManager,
      next_meeting_date: bank.nextMeetingDate,
      next_meeting_topic: bank.nextMeetingTopic,
      last_meeting_date: bank.lastMeetingDate,
      last_meeting_summary: bank.lastMeetingSummary ?? null,
      executive_summary: bank.executiveSummary,
      implementation: {
        total_stages: bankStages.length,
        completed_stages: completed,
        completion_pct: pct,
        current_stage: currentStage?.name ?? null,
        stages: bankStages.map((s) => ({
          name: s.name,
          status: s.status,
          completed: s.completed,
          skipped: s.skipped,
          owner: s.owner,
          notes: s.notes,
        })),
      },
      risks: bankRisks.map((r) => ({
        description: r.description,
        level: r.level,
        status: r.status,
      })),
      recent_meetings: bankMeetings
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .map((m) => ({ date: m.date, topic: m.topic, summary: m.summary })),
      open_actions: bankActions
        .filter((a) => a.status !== "done" && a.status !== "completed")
        .map((a) => ({ description: a.description, due_date: a.dueDate, owner: a.owner, status: a.status })),
    };
  });

  return bankSummaries;
}

// ── Function definitions for the agent ────────────────────────────────────────
const AGENT_FUNCTIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_bank_details",
      description: "Get full details for a specific bank by its name (Arabic or English) or ID",
      parameters: {
        type: "object",
        properties: {
          bank_query: {
            type: "string",
            description: "Bank name in Arabic or English, or bank ID like BANK-001",
          },
        },
        required: ["bank_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_bank",
      description: "Update one or more fields of an existing bank. ALWAYS pass the bank's Arabic or English name as bank_query — never guess or invent a bank ID. At least one other field must be provided.",
      parameters: {
        type: "object",
        properties: {
          bank_query: {
            type: "string",
            description: "The bank's Arabic name (e.g. 'مصرف الراجحي') or English name (e.g. 'Al Rajhi Bank'). Do NOT invent or guess an ID — use the name from the live data.",
          },
          status: {
            type: "string",
            enum: ["Not Started", "In Progress", "Completed", "Delayed", "On Hold"],
            description: "New status",
          },
          risk_level: {
            type: "string",
            enum: ["Low", "Medium", "High"],
            description: "New risk level",
          },
          next_meeting_date: { type: "string", description: "Next meeting date YYYY-MM-DD" },
          next_meeting_topic: { type: "string", description: "Topic for the next meeting" },
          executive_summary: { type: "string", description: "Updated executive summary" },
          responsible_person: { type: "string", description: "Responsible person name" },
          relationship_manager: { type: "string", description: "Relationship manager name" },
          next_action: { type: "string", description: "Next action / follow-up note" },
        },
        required: ["bank_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bank",
      description: "Create a new bank in the system. Required: name in Arabic, name in English, category, status, risk level, priority impact.",
      parameters: {
        type: "object",
        properties: {
          name_ar: { type: "string", description: "Bank name in Arabic" },
          name_en: { type: "string", description: "Bank name in English" },
          category: {
            type: "string",
            enum: ["Commercial", "Investment", "Islamic", "Government", "Digital", "International", "Fintech"],
            description: "Bank category",
          },
          status: {
            type: "string",
            enum: ["Not Started", "In Progress", "Completed", "Delayed", "On Hold"],
            description: "Initial status",
          },
          risk_level: {
            type: "string",
            enum: ["Low", "Medium", "High"],
            description: "Risk level",
          },
          priority_impact: {
            type: "string",
            enum: ["Low", "Medium", "High", "Critical"],
            description: "Priority impact level",
          },
          responsible_person: { type: "string", description: "Person responsible for this bank" },
          executive_summary: { type: "string", description: "Initial executive summary or notes" },
        },
        required: ["name_ar", "name_en", "category", "status", "risk_level", "priority_impact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Get an overall summary of all banks — totals, statuses, risks, implementation progress",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_weekly_report",
      description: "Generate a comprehensive weekly executive report covering all banks: overall progress, critical banks needing attention, upcoming meetings this week, overdue action items, top/bottom performers, stalled banks, and smart recommendations. Use this whenever the user asks for a weekly report, executive summary, weekly status, or general platform health overview.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "add_meeting",
      description: "Add a new meeting record for a specific bank. Use when the user asks to schedule or log a meeting.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          date: { type: "string", description: "Meeting date YYYY-MM-DD" },
          topic: { type: "string", description: "Meeting topic or agenda" },
          summary: { type: "string", description: "Meeting summary or notes (optional)" },
          attendees: { type: "string", description: "Attendees names (optional)" },
          status: {
            type: "string",
            enum: ["scheduled", "completed", "cancelled"],
            description: "Meeting status, default is 'scheduled'",
          },
        },
        required: ["bank_query", "date", "topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_meeting",
      description: "Update an existing meeting for a bank. Use when the user asks to reschedule, update, or modify a meeting.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          meeting_index: { type: "number", description: "Which meeting to update — 1 for the most recent, 2 for second most recent, etc." },
          date: { type: "string", description: "New meeting date YYYY-MM-DD (optional)" },
          topic: { type: "string", description: "New topic (optional)" },
          summary: { type: "string", description: "New or updated summary (optional)" },
          status: {
            type: "string",
            enum: ["scheduled", "completed", "cancelled"],
            description: "New status (optional)",
          },
        },
        required: ["bank_query", "meeting_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_risk",
      description: "Add a new risk entry for a specific bank. Use when the user asks to log or register a risk.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          description: { type: "string", description: "Risk description" },
          level: {
            type: "string",
            enum: ["Low", "Medium", "High"],
            description: "Risk level",
          },
          status: {
            type: "string",
            enum: ["open", "mitigated", "resolved"],
            description: "Risk status, default is 'open'",
          },
        },
        required: ["bank_query", "description", "level"],
      },
    },
  },
];

// ── Arabic normalizer (shared) ─────────────────────────────────────────────────
function normalizeAr(s: string): string {
  return s.toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[يى]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, ""); // strip tashkeel
}

// ── Bank lookup by name or ID (shared) ────────────────────────────────────────
function findBank(query: string, allBanks: Awaited<ReturnType<typeof buildBankContext>>) {
  const q = normalizeAr(query).trim();
  return allBanks.find(
    (b) =>
      b.id.toLowerCase() === query.toLowerCase() ||
      normalizeAr(b.name_ar ?? "").includes(q) ||
      (b.name_en ?? "").toLowerCase().includes(query.toLowerCase()),
  );
}

// ── Auto-generate next bank ID ─────────────────────────────────────────────────
async function nextBankId(): Promise<string> {
  const rows = await db.select({ id: banksTable.id }).from(banksTable);
  let maxNum = 0;
  for (const row of rows) {
    // Only parse IDs that match exactly BANK-NNN (ignore malformed / non-standard IDs)
    const match = row.id.match(/^BANK-(\d{1,6})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `BANK-${String(maxNum + 1).padStart(3, "0")}`;
}

// ── Function executor ──────────────────────────────────────────────────────────
async function executeFunction(name: string, args: Record<string, any>, allBanks: Awaited<ReturnType<typeof buildBankContext>>) {

  // ── get_dashboard_summary ──────────────────────────────────────────────────
  if (name === "get_dashboard_summary") {
    const total = allBanks.length;
    const byStatus = new Map<string, number>();
    const byRisk = new Map<string, number>();
    let totalPct = 0;
    for (const b of allBanks) {
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
      byRisk.set(b.risk_level, (byRisk.get(b.risk_level) ?? 0) + 1);
      totalPct += b.implementation.completion_pct;
    }
    // Sort copies, not in-place mutations
    const sorted = [...allBanks].sort((a, b) => b.implementation.completion_pct - a.implementation.completion_pct);
    return {
      total_banks: total,
      avg_implementation_pct: total > 0 ? Math.round(totalPct / total) : 0,
      by_status: Object.fromEntries(byStatus),
      by_risk: Object.fromEntries(byRisk),
      high_risk_banks: allBanks.filter((b) => b.risk_level === "High").map((b) => b.name_ar || b.name_en),
      most_advanced: sorted.slice(0, 3).map((b) => ({ name: b.name_ar || b.name_en, pct: b.implementation.completion_pct })),
      least_advanced: sorted.slice(-3).map((b) => ({ name: b.name_ar || b.name_en, pct: b.implementation.completion_pct })),
    };
  }

  // ── get_bank_details ───────────────────────────────────────────────────────
  if (name === "get_bank_details") {
    const bank = findBank(args.bank_query as string ?? "", allBanks);
    if (!bank) {
      return {
        error: `لم أجد بنكاً باسم "${args.bank_query}". البنوك المتاحة: ${allBanks.map((b) => b.name_ar || b.name_en).join("، ")}`,
      };
    }
    return bank;
  }

  // ── update_bank ────────────────────────────────────────────────────────────
  if (name === "update_bank") {
    const query = args.bank_query as string ?? "";
    if (!query.trim()) return { error: "يجب تحديد اسم البنك أو معرّفه." };

    // Resolve by name OR ID
    const match = findBank(query, allBanks);
    if (!match) {
      return {
        error: `لم أجد بنكاً باسم "${query}". البنوك المتاحة: ${allBanks.map((b) => b.name_ar || b.name_en).join("، ")}`,
      };
    }

    const update: Record<string, any> = { updatedAt: new Date() };
    if (args.status !== undefined)            update.status           = args.status;
    if (args.risk_level !== undefined)        update.riskLevel        = args.risk_level;
    if (args.next_meeting_date !== undefined) update.nextMeetingDate  = args.next_meeting_date;
    if (args.next_meeting_topic !== undefined) update.nextMeetingTopic = args.next_meeting_topic;
    if (args.executive_summary !== undefined) update.executiveSummary = args.executive_summary;
    if (args.responsible_person !== undefined) update.responsiblePerson = args.responsible_person;
    if (args.relationship_manager !== undefined) update.relationshipManager = args.relationship_manager;
    if (args.next_action !== undefined)       update.nextAction       = args.next_action;

    const changedFields = Object.keys(update).filter((k) => k !== "updatedAt");
    if (changedFields.length === 0) {
      return { error: "لم يُحدَّد أي حقل للتحديث. يرجى تحديد القيمة الجديدة." };
    }

    await db.update(banksTable).set(update).where(eq(banksTable.id, match.id));
    return {
      success: true,
      bank_id: match.id,
      bank_name: match.name_ar || match.name_en,
      updated_fields: changedFields,
      new_values: changedFields.reduce<Record<string, any>>((acc, k) => { acc[k] = update[k]; return acc; }, {}),
    };
  }

  // ── create_bank ────────────────────────────────────────────────────────────
  if (name === "create_bank") {
    const required = ["name_ar", "name_en", "category", "status", "risk_level", "priority_impact"] as const;
    for (const field of required) {
      if (!args[field]) return { error: `الحقل "${field}" مطلوب لإنشاء البنك.` };
    }

    // Check duplicate by name
    const duplicate = findBank(args.name_ar as string, allBanks) ?? findBank(args.name_en as string, allBanks);
    if (duplicate) {
      return { error: `يوجد بنك بهذا الاسم بالفعل: ${duplicate.name_ar} (${duplicate.id})` };
    }

    const newId = await nextBankId();
    await db.insert(banksTable).values({
      id: newId,
      nameAr: args.name_ar as string,
      nameEn: args.name_en as string,
      category: args.category as string,
      status: args.status as string,
      riskLevel: args.risk_level as string,
      priorityImpact: args.priority_impact as string,
      responsiblePerson: (args.responsible_person as string | undefined) ?? null,
      executiveSummary: (args.executive_summary as string | undefined) ?? null,
      contacts: [],
      isArchived: false,
    });

    return {
      success: true,
      bank_id: newId,
      bank_name_ar: args.name_ar,
      bank_name_en: args.name_en,
      message: `تم إنشاء البنك بنجاح برقم ${newId}`,
    };
  }

  // ── generate_weekly_report ─────────────────────────────────────────────────
  if (name === "generate_weekly_report") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);
    const ago30Days = new Date(today);
    ago30Days.setDate(today.getDate() - 30);

    // ── Overall counts ────────────────────────────────────────────────────────
    const total = allBanks.length;
    const byStatus: Record<string, string[]> = {};
    const byRisk: Record<string, string[]> = {};
    let totalPct = 0;
    let totalOpenActions = 0;

    for (const b of allBanks) {
      const label = b.name_ar || b.name_en || b.id;
      byStatus[b.status] = [...(byStatus[b.status] ?? []), label];
      byRisk[b.risk_level] = [...(byRisk[b.risk_level] ?? []), label];
      totalPct += b.implementation.completion_pct;
      totalOpenActions += b.open_actions.length;
    }
    const avgPct = total > 0 ? Math.round(totalPct / total) : 0;

    // ── Critical: Delayed AND/OR High Risk ────────────────────────────────────
    const criticalBanks = allBanks
      .filter((b) => b.status === "Delayed" || b.risk_level === "High")
      .map((b) => ({
        name: b.name_ar || b.name_en,
        status: b.status,
        risk_level: b.risk_level,
        completion_pct: b.implementation.completion_pct,
        responsible_person: b.responsible_person,
        open_actions_count: b.open_actions.length,
        open_risks: b.risks.filter((r) => r.status !== "resolved" && r.status !== "closed").map((r) => r.description).slice(0, 3),
      }));

    // ── Upcoming meetings this week ───────────────────────────────────────────
    const upcomingMeetings = allBanks
      .filter((b) => {
        if (!b.next_meeting_date) return false;
        const d = new Date(b.next_meeting_date);
        return d >= today && d <= in7Days;
      })
      .map((b) => ({
        bank: b.name_ar || b.name_en,
        date: b.next_meeting_date,
        topic: b.next_meeting_topic ?? "غير محدد",
        responsible_person: b.responsible_person,
      }))
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

    // ── Overdue action items (due_date < today, not done) ─────────────────────
    const overdueActions: Array<{ bank: string; action: string; due_date: string | null; owner: string | null; days_overdue: number }> = [];
    for (const b of allBanks) {
      for (const a of b.open_actions) {
        if (!a.due_date) continue;
        const due = new Date(a.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) {
          const daysOverdue = Math.round((today.getTime() - due.getTime()) / 86_400_000);
          overdueActions.push({
            bank: b.name_ar || b.name_en || b.id,
            action: a.description,
            due_date: a.due_date,
            owner: a.owner,
            days_overdue: daysOverdue,
          });
        }
      }
    }
    overdueActions.sort((a, b) => b.days_overdue - a.days_overdue);

    // ── Top & bottom performers ────────────────────────────────────────────────
    const sorted = [...allBanks].sort(
      (a, b) => b.implementation.completion_pct - a.implementation.completion_pct,
    );
    const topPerformers = sorted
      .filter((b) => b.implementation.completion_pct > 0)
      .slice(0, 5)
      .map((b) => ({
        name: b.name_ar || b.name_en,
        completion_pct: b.implementation.completion_pct,
        status: b.status,
      }));
    const notCompleted = sorted.filter((b) => b.status !== "Completed");
    const laggingBanks = [...notCompleted]
      .sort((a, b) => a.implementation.completion_pct - b.implementation.completion_pct)
      .slice(0, 5)
      .map((b) => ({
        name: b.name_ar || b.name_en,
        completion_pct: b.implementation.completion_pct,
        status: b.status,
        risk_level: b.risk_level,
      }));

    // ── Stalled: Not Started or On Hold ───────────────────────────────────────
    const stalledBanks = allBanks
      .filter((b) => b.status === "Not Started" || b.status === "On Hold")
      .map((b) => ({
        name: b.name_ar || b.name_en,
        status: b.status,
        risk_level: b.risk_level,
        responsible_person: b.responsible_person,
      }));

    // ── No meeting in 30+ days — top 10 most critical only ───────────────────
    const riskOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2, "Not Rated": 3 };
    const noRecentMeetingAll = allBanks.filter((b) => {
      if (!b.last_meeting_date) return true;
      return new Date(b.last_meeting_date) < ago30Days;
    });
    const noRecentMeeting = noRecentMeetingAll
      .sort((a, b) => (riskOrder[a.risk_level] ?? 3) - (riskOrder[b.risk_level] ?? 3))
      .slice(0, 10)
      .map((b) => ({
        name: b.name_ar || b.name_en,
        last_meeting_date: b.last_meeting_date ?? "لا يوجد",
        status: b.status,
        risk_level: b.risk_level,
      }));

    const reportDate = today.toISOString().split("T")[0];
    return {
      report_generated_at: reportDate,
      report_week: `${reportDate} → ${in7Days.toISOString().split("T")[0]}`,
      overview: {
        total_banks: total,
        avg_completion_pct: avgPct,
        total_open_actions: totalOpenActions,
        by_status: Object.fromEntries(
          Object.entries(byStatus).map(([k, v]) => [k, { count: v.length, banks: v }]),
        ),
        by_risk: Object.fromEntries(
          Object.entries(byRisk).map(([k, v]) => [k, v.length]),
        ),
      },
      critical_banks: criticalBanks,
      upcoming_meetings_7_days: upcomingMeetings,
      overdue_actions: overdueActions,
      top_performers: topPerformers,
      lagging_banks: laggingBanks,
      stalled_banks: stalledBanks,
      banks_no_meeting_30_days: {
        total: noRecentMeetingAll.length,
        top_critical: noRecentMeeting,
      },
      // READ THIS LAST — MANDATORY FORMATTING RULES:
      _MUST_follow: [
        "Write the full report in Arabic using bullet points only — no tables, no long paragraphs.",
        "Use EXACTLY these 8 section headers (## level) in this order: 📊 نظرة عامة | 🚨 بنوك تحتاج تدخل عاجل | 📅 اجتماعات هذا الأسبوع | ⏰ إجراءات متأخرة | 🏆 الأكثر تقدماً | 🐢 الأقل تقدماً | 💤 بنوك متوقفة | 💡 توصيات",
        "## 💡 توصيات is NON-NEGOTIABLE — write exactly 5 numbered actionable recommendations. Do NOT skip it or replace it with الخلاصة.",
        `End with EXACTLY: **تاريخ إنشاء التقرير:** ${reportDate}`,
      ],
    };
  }

  // ── add_meeting ────────────────────────────────────────────────────────────
  if (name === "add_meeting") {
    const query = args.bank_query as string ?? "";
    const match = findBank(query, allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${query}". البنوك المتاحة: ${allBanks.map((b) => b.name_ar || b.name_en).join("، ")}` };
    if (!args.date || !args.topic) return { error: "التاريخ وموضوع الاجتماع مطلوبان." };

    await db.insert(meetingsTable).values({
      bankId: match.id,
      date: args.date as string,
      topic: args.topic as string,
      summary: (args.summary as string | undefined) ?? null,
      attendees: (args.attendees as string | undefined) ?? null,
      status: (args.status as string | undefined) ?? "scheduled",
      isArchived: false,
    });

    return {
      success: true,
      bank_id: match.id,
      bank_name: match.name_ar || match.name_en,
      meeting: { date: args.date, topic: args.topic, status: args.status ?? "scheduled" },
      message: `تم إضافة الاجتماع بنجاح لـ ${match.name_ar || match.name_en}`,
    };
  }

  // ── update_meeting ─────────────────────────────────────────────────────────
  if (name === "update_meeting") {
    const query = args.bank_query as string ?? "";
    const match = findBank(query, allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${query}".` };

    const idx = Math.max(1, (args.meeting_index as number) ?? 1);
    const meetings = await db.select().from(meetingsTable)
      .where(and(eq(meetingsTable.bankId, match.id), eq(meetingsTable.isArchived, false)));
    meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const target = meetings[idx - 1];
    if (!target) return { error: `لم أجد اجتماع رقم ${idx} لـ ${match.name_ar || match.name_en}. عدد الاجتماعات: ${meetings.length}` };

    const update: Record<string, any> = { updatedAt: new Date() };
    if (args.date !== undefined)    update.date    = args.date;
    if (args.topic !== undefined)   update.topic   = args.topic;
    if (args.summary !== undefined) update.summary = args.summary;
    if (args.status !== undefined)  update.status  = args.status;

    const changedFields = Object.keys(update).filter((k) => k !== "updatedAt");
    if (changedFields.length === 0) return { error: "لم يُحدَّد أي حقل للتحديث." };

    await db.update(meetingsTable).set(update).where(eq(meetingsTable.id, target.id));
    return {
      success: true,
      bank_name: match.name_ar || match.name_en,
      meeting_id: target.id,
      updated_fields: changedFields,
      new_values: changedFields.reduce<Record<string, any>>((acc, k) => { acc[k] = update[k]; return acc; }, {}),
    };
  }

  // ── add_risk ───────────────────────────────────────────────────────────────
  if (name === "add_risk") {
    const query = args.bank_query as string ?? "";
    const match = findBank(query, allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${query}".` };
    if (!args.description || !args.level) return { error: "وصف الخطر ومستواه مطلوبان." };

    await db.insert(risksTable).values({
      bankId: match.id,
      description: args.description as string,
      level: args.level as string,
      status: (args.status as string | undefined) ?? "open",
    });

    return {
      success: true,
      bank_id: match.id,
      bank_name: match.name_ar || match.name_en,
      risk: { description: args.description, level: args.level, status: args.status ?? "open" },
      message: `تم تسجيل الخطر بنجاح لـ ${match.name_ar || match.name_en}`,
    };
  }

  return { error: `Unknown function: ${name}` };
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  try {
    const { messages } = req.body as { messages?: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const openai = getOpenAI();

    // Build live context once per request
    const bankContext = await buildBankContext();
    const contextBlock = `\n\n<live_bank_data total="${bankContext.length}" as_of="${new Date().toISOString()}">\n${JSON.stringify(bankContext, null, 0)}\n</live_bank_data>`;

    const systemWithContext = SYSTEM_PROMPT + contextBlock;

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemWithContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // First call — may trigger a function
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: AGENT_FUNCTIONS,
      tool_choice: "auto",
      max_tokens: 4096,
      temperature: 0.3,
    });

    let choice = response.choices[0];

    // Agentic loop — execute tool calls and get final response
    let iterations = 0;
    while (choice.finish_reason === "tool_calls" && iterations < 5) {
      iterations++;
      const toolCalls = choice.message.tool_calls ?? [];

      // Add assistant message with tool calls
      openaiMessages.push(choice.message);

      // Execute all tool calls
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          const fn = (tc as any).function as { name: string; arguments: string };
          let args: Record<string, any> = {};
          try { args = JSON.parse(fn.arguments); } catch { /* ignore */ }
          const result = await executeFunction(fn.name, args, bankContext);
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        }),
      );

      openaiMessages.push(...toolResults);

      // After generate_weekly_report: inject a strict format instruction as a user turn
      const calledReport = toolCalls.some(
        (tc) => ((tc as any).function as { name: string }).name === "generate_weekly_report",
      );
      if (calledReport) {
        // Extract the report date from the tool result so we can embed it
        let reportDate = new Date().toISOString().split("T")[0];
        try {
          const parsed = JSON.parse(toolResults[0].content);
          if (parsed.report_generated_at) reportDate = parsed.report_generated_at;
        } catch { /* ignore */ }

        openaiMessages.push({
          role: "user",
          content: `اكتب الآن التقرير الأسبوعي كاملاً بالعربي.
يجب أن يحتوي بالضبط على هذه الأقسام الثمانية بهذا الترتيب — استخدم ## لكل قسم:

## 📊 نظرة عامة
## 🚨 بنوك تحتاج تدخل عاجل
## 📅 اجتماعات هذا الأسبوع
## ⏰ إجراءات متأخرة
## 🏆 الأكثر تقدماً
## 🐢 الأقل تقدماً
## 💤 بنوك متوقفة
## 💡 توصيات

تحت "## 💡 توصيات" اكتب 5 توصيات مرقمة وقابلة للتنفيذ بناءً على البيانات.
أختم التقرير بهذا السطر بالضبط: **تاريخ إنشاء التقرير:** ${reportDate}`,
        });
      }

      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools: AGENT_FUNCTIONS,
        tool_choice: calledReport ? "none" : "auto",
        max_tokens: 4096,
        temperature: 0.3,
      });
      choice = response.choices[0];
    }

    // ── Collect which data domains were mutated ────────────────────────────────
    // Walk every tool result we accumulated and flag domains where success=true.
    const mutations: { banks: boolean; meetings: boolean; risks: boolean } = {
      banks: false,
      meetings: false,
      risks: false,
    };
    const BANK_WRITE_FNS    = new Set(["update_bank", "create_bank"]);
    const MEETING_WRITE_FNS = new Set(["add_meeting", "update_meeting"]);
    const RISK_WRITE_FNS    = new Set(["add_risk"]);

    for (const msg of openaiMessages) {
      if (msg.role !== "tool") continue;
      const content = typeof msg.content === "string" ? msg.content : "";
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(content); } catch { /* skip */ }
      if (parsed.success !== true) continue;

      // Find the tool_call_id → function name by scanning assistant messages
      const toolCallId = (msg as any).tool_call_id as string | undefined;
      for (const m of openaiMessages) {
        if (m.role !== "assistant") continue;
        const toolCalls = (m as any).tool_calls as Array<{ id: string; function: { name: string } }> | undefined;
        if (!toolCalls) continue;
        const tc = toolCalls.find((t) => t.id === toolCallId);
        if (!tc) continue;
        const fn = tc.function.name;
        if (BANK_WRITE_FNS.has(fn))    mutations.banks    = true;
        if (MEETING_WRITE_FNS.has(fn)) mutations.meetings = true;
        if (RISK_WRITE_FNS.has(fn))    mutations.risks    = true;
        break;
      }
    }

    const content = choice.message?.content ?? "";
    res.json({ reply: content, mutations });
  } catch (err: any) {
    console.error("[ai-chat] error:", err?.message ?? err);
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default router;

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

// ── OpenAI client ──────────────────────────────────────────────────────────────
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Wasl AI, an intelligent assistant for the Wasl FinTech banking intelligence platform.

Your ONLY domain is the banks tracked in this platform — their implementation progress, risks, meetings, action items, and overall status.

Rules:
1. Answer in the SAME language the user writes in (Arabic → Arabic, English → English).
2. Be concise, factual, and professional. Use bullet points for lists.
3. If asked about anything outside the banking/platform domain (cooking, sports, general knowledge, etc.), politely decline and say you are specialized in Wasl platform bank data only.
4. When referencing data, cite specific bank names and numbers from the context provided.
5. You can perform actions (update bank fields) when the user explicitly asks — use the provided functions.
6. When giving status summaries, be insightful — highlight what needs attention, not just raw data.
7. For Arabic responses, use formal but clear Arabic (Modern Standard with Gulf-friendly phrasing).

You have access to LIVE data about all banks in the system. The data is injected into each request.`;

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
      last_meeting_summary: bank.lastMeetingDate ? bank.lastMeetingDate : null,
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
      name: "update_bank_status",
      description: "Update the status or other fields of a specific bank",
      parameters: {
        type: "object",
        properties: {
          bank_id: { type: "string", description: "The bank ID (e.g. BANK-001)" },
          status: {
            type: "string",
            enum: ["Not Started", "In Progress", "Completed", "Delayed", "On Hold"],
            description: "New status for the bank",
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
        },
        required: ["bank_id"],
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
];

// ── Function executor ──────────────────────────────────────────────────────────
async function executeFunction(name: string, args: Record<string, any>, allBanks: Awaited<ReturnType<typeof buildBankContext>>) {
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
    return {
      total_banks: total,
      avg_implementation_pct: Math.round(totalPct / total),
      by_status: Object.fromEntries(byStatus),
      by_risk: Object.fromEntries(byRisk),
      high_risk_banks: allBanks.filter((b) => b.risk_level === "High").map((b) => b.name_ar || b.name_en),
      most_advanced: allBanks
        .sort((a, b) => b.implementation.completion_pct - a.implementation.completion_pct)
        .slice(0, 3)
        .map((b) => ({ name: b.name_ar || b.name_en, pct: b.implementation.completion_pct })),
      least_advanced: allBanks
        .sort((a, b) => a.implementation.completion_pct - b.implementation.completion_pct)
        .slice(0, 3)
        .map((b) => ({ name: b.name_ar || b.name_en, pct: b.implementation.completion_pct })),
    };
  }

  if (name === "get_bank_details") {
    const q = (args.bank_query as string ?? "").toLowerCase().trim();
    const bank = allBanks.find(
      (b) =>
        b.id.toLowerCase() === q ||
        b.name_ar?.toLowerCase().includes(q) ||
        b.name_en?.toLowerCase().includes(q),
    );
    if (!bank) return { error: `Bank not found: ${args.bank_query}` };
    return bank;
  }

  if (name === "update_bank_status") {
    const bankId = args.bank_id as string;
    const [existing] = await db.select({ id: banksTable.id }).from(banksTable).where(eq(banksTable.id, bankId));
    if (!existing) return { error: `Bank ${bankId} not found` };

    const update: Record<string, any> = { updatedAt: new Date() };
    if (args.status) update.status = args.status;
    if (args.risk_level) update.riskLevel = args.risk_level;
    if (args.next_meeting_date) update.nextMeetingDate = args.next_meeting_date;
    if (args.next_meeting_topic) update.nextMeetingTopic = args.next_meeting_topic;
    if (args.executive_summary) update.executiveSummary = args.executive_summary;
    if (args.responsible_person) update.responsiblePerson = args.responsible_person;

    await db.update(banksTable).set(update).where(eq(banksTable.id, bankId));
    return { success: true, updated_fields: Object.keys(update).filter((k) => k !== "updatedAt") };
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
      max_tokens: 1024,
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

      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools: AGENT_FUNCTIONS,
        tool_choice: "auto",
        max_tokens: 1024,
        temperature: 0.3,
      });
      choice = response.choices[0];
    }

    const content = choice.message?.content ?? "";
    res.json({ reply: content });
  } catch (err: any) {
    console.error("[ai-chat] error:", err?.message ?? err);
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default router;

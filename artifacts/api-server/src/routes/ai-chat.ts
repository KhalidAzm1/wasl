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
const SYSTEM_PROMPT = `You are Wasl AI, an intelligent assistant for the Wasl FinTech banking intelligence platform.

Your ONLY domain is the banks tracked in this platform — their implementation progress, risks, meetings, action items, and overall status.

Rules:
1. Answer in the SAME language the user writes in (Arabic → Arabic, English → English).
2. Be concise, factual, and professional. Use bullet points for lists.
3. If asked about anything outside the banking/platform domain (cooking, sports, general knowledge, etc.), politely decline and say you are specialized in Wasl platform bank data only.
4. When referencing data, cite specific bank names and numbers from the context provided.
5. You can perform actions (create banks, update bank fields) when the user explicitly asks — use the provided functions.
6. When giving status summaries, be insightful — highlight what needs attention, not just raw data.
7. For Arabic responses, use formal but clear Arabic (Modern Standard with Gulf-friendly phrasing).
8. COMPLETENESS RULE — CRITICAL: When asked to list ALL banks (حالة جميع البنوك, all banks, كل البنوك, etc.), you MUST include EVERY SINGLE bank in the live data — no exceptions. Do NOT stop at 10, 15, or 20. If there are 30 banks, list all 30. Never say "وهكذا" or "..." or trail off — finish the complete list.
9. CONTINUE RULE: If the user says "كمل" or "continue" or "أكمل", they mean your previous response was cut short. Look at which banks were already listed and continue from where you left off, covering ALL remaining banks.

CRITICAL RULES FOR ACTIONS (create/update):
- ALWAYS call the actual function — never pretend an action was done without calling it.
- After calling a function, check the result: if it contains "error", report the error clearly to the user. NEVER say "تم" or "done" if the function returned an error.
- If the function returns { success: true }, confirm the action with the exact fields that were changed.
- If you cannot identify which bank the user means, ask for clarification — do NOT guess.

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

      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools: AGENT_FUNCTIONS,
        tool_choice: "auto",
        max_tokens: 4096,
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

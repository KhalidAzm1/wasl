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
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);
// Noor AI agent — super_admin only
router.use(requireRole("super_admin"));

// ── AI client ─────────────────────────────────────────────────────────────────
// Uses Replit AI Integrations proxy for OpenAI — keys auto-provisioned.
const AI_MODEL = "gpt-4o-mini";

function getOpenAI() {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL or key is not set");
  return new OpenAI({ apiKey, baseURL });
}

/** Call the model with up to 3 retries on empty-choices responses. */
async function callWithRetry(
  openai: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  maxAttempts = 3,
): Promise<OpenAI.Chat.ChatCompletion> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await openai.chat.completions.create(params);
    if (response.choices && response.choices.length > 0) return response;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error("النموذج لم يرجع أي رد بعد عدة محاولات. حاولي مرة أخرى.");
}

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are "Wasalawi" — an AI data assistant for Wasl, a platform that tracks banking product implementation in Saudi Arabia.

Your personality: professional, smart, and friendly. You communicate in clear, concise English. Not overly formal, not casual — balanced and confident.

Your domain is strictly: banks and financial institutions tracked in Wasl — their status, implementation progress, risks, meetings, action items, and reports.

Core rules:
1. Always reply in English, even if the question is in Arabic.
2. Be concise, clear, and direct.
3. If asked about anything outside Wasl's platform scope, politely decline and clarify you specialize in platform data only.
4. When referencing data, use exact bank names and numbers from the available context.
5. Execute actions (update, create, add) when explicitly requested — always use the available functions.
6. Be proactive: highlight what needs attention, don't just dump raw data.
7. Completeness rule — critical: when asked for "all banks", list every single one. Never stop at 10 or 15 — if there are 30 banks, list all 30. Never write "etc." or "...".
8. Continuation rule: if the user says "continue" or "keep going", it means your last reply was cut off — check which banks were already listed and continue from where you stopped.

Formatting rules — follow in every reply:
• Short reply (one question about one bank): one or two direct sentences, no section headers.
• Simple lists (one property for multiple banks): bullet points with bank name then value.
• Comparison or more than two properties for multiple banks: always use a Markdown table.
  Correct example:
  | Bank | Status | Progress | Owner |
  |---|---|---|---|
  | Riyad Bank | In Progress | 45% | Ahmed |
• Long replies and reports: use ## for each section, then bullets or tables underneath depending on data type.
• Don't mix bullet and table styles in the same section — choose one.
• **Bold** important numbers and names in regular text.
• No long prose paragraphs — numeric data is always formatted.
9. Weekly report rule: when asked for a weekly report or executive summary — call generate_weekly_report first, then write the report with these eight sections in order (## for each):
    ## 📊 Overview
    ## 🚨 Banks Needing Urgent Attention
    ## 📅 Meetings This Week
    ## ⏰ Overdue Action Items
    ## 🏆 Top Performers
    ## 🐢 Low Performers
    ## 💤 Stalled Banks
    ## 💡 Recommendations
    Under "## 💡 Recommendations" write 5 numbered, actionable recommendations.
    End the report with exactly this line: **Report generated on:** YYYY-MM-DD

Full actions you can execute now:
• Read: any bank's status, dashboard summary, meetings, risks, action items
• Update banks: status, risk level, owner, next meeting, executive summary
• Create a new bank / archive / restore
• Manage meetings: add, edit, delete
• Manage risks: add, update status (open/mitigated/resolved)
• Manage action items: add, update, close

Critical action rules:
- Always call the actual function — never pretend to execute an action without calling it.
- After calling a function: if the result contains "error", inform the user of the error. Never say "done" if the operation failed.
- If the result is { success: true }, confirm the operation and mention which fields changed.
- If you don't recognize the bank being referred to, ask for clarification — never guess.
- For archive/delete actions: ask the user to confirm before executing if the request isn't explicit.

You have live access to all bank data in the system. Data is injected on every request.`;

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
        .map((a) => ({ id: a.id, description: a.description, due_date: a.dueDate, owner: a.owner, status: a.status })),
      contacts: ((bank.contacts ?? []) as Array<{ name: string; title?: string | null; phone?: string | null; email?: string | null }>)
        .map((c) => ({ name: c.name, phone: c.phone ?? null })),
      isArchived: bank.isArchived,
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
          level: { type: "string", enum: ["Low", "Medium", "High"], description: "Risk level" },
          status: { type: "string", enum: ["open", "mitigated", "resolved"], description: "Risk status, default is 'open'" },
        },
        required: ["bank_query", "description", "level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bank_contacts",
      description: "Get the full contact list for a bank including names, titles, phone/mobile numbers, and emails. Use when the user asks about who is responsible, mobile numbers, or contact details.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
        },
        required: ["bank_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_contact",
      description: "Add or remove a contact from a bank. Use when the user wants to add a person or delete an existing contact.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          action: { type: "string", enum: ["add", "remove"], description: "add to add a new contact, remove to delete one" },
          name: { type: "string", description: "Contact full name (required for add; used to identify for remove)" },
          title: { type: "string", description: "Job title / position (optional)" },
          phone: { type: "string", description: "Mobile or phone number (optional)" },
          email: { type: "string", description: "Email address (optional)" },
        },
        required: ["bank_query", "action", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_implementation_stage",
      description: "Mark an implementation stage as completed, in_progress, not_started, or skipped for a specific bank. Use when the user wants to advance or reset a stage.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          stage_name: { type: "string", description: "Partial or full stage name to match (e.g. 'NDA', 'Go-Live', 'UAT')" },
          status: { type: "string", enum: ["not_started", "in_progress", "completed", "skipped", "blocked"], description: "New status for the stage" },
          completed: { type: "boolean", description: "true to mark as done, false to unmark (auto-derived from status if omitted)" },
          notes: { type: "string", description: "Optional notes to attach to this stage" },
        },
        required: ["bank_query", "stage_name", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_banks",
      description: "Search and filter banks by one or more criteria. Use when the user asks to list banks matching certain conditions.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["Not Started", "In Progress", "Completed", "Delayed", "On Hold"], description: "Filter by status (optional)" },
          risk_level: { type: "string", enum: ["Low", "Medium", "High"], description: "Filter by risk level (optional)" },
          category: { type: "string", description: "Filter by category (optional)" },
          responsible_person: { type: "string", description: "Filter by responsible person name (optional)" },
          min_completion_pct: { type: "number", description: "Minimum implementation completion % (optional)" },
          max_completion_pct: { type: "number", description: "Maximum implementation completion % (optional)" },
          has_overdue_actions: { type: "boolean", description: "Only banks with overdue action items (optional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_banks",
      description: "Compare two banks side by side — status, risk, implementation progress, meetings, open actions. Use when the user asks to compare two specific banks.",
      parameters: {
        type: "object",
        properties: {
          bank_query_1: { type: "string", description: "First bank name in Arabic or English" },
          bank_query_2: { type: "string", description: "Second bank name in Arabic or English" },
        },
        required: ["bank_query_1", "bank_query_2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_action_item",
      description: "Permanently delete an action item from a bank. Use only when the user explicitly asks to delete (not just close) a task.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          item_index: { type: "number", description: "Which action item to delete — 1 for most recent, 2 for second, etc." },
        },
        required: ["bank_query", "item_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_risk",
      description: "Update the status or level of an existing risk for a bank. Use when the user wants to resolve, mitigate, or change a risk.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          risk_index: { type: "number", description: "Which risk to update — 1 for most recent, 2 for second, etc." },
          status: { type: "string", enum: ["open", "mitigated", "resolved"], description: "New status" },
          level: { type: "string", enum: ["Low", "Medium", "High"], description: "New level (optional)" },
          description: { type: "string", description: "Updated description (optional)" },
        },
        required: ["bank_query", "risk_index", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archive_bank",
      description: "Archive (soft-delete) a bank. Use only when the user explicitly asks to archive or remove a bank from active tracking. This is reversible.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          reason: { type: "string", description: "Reason for archiving (optional)" },
        },
        required: ["bank_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restore_bank",
      description: "Restore a previously archived bank back to active status.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
        },
        required: ["bank_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_meeting",
      description: "Cancel or delete a meeting for a bank. Use when the user asks to cancel, remove, or delete a meeting.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          meeting_index: { type: "number", description: "Which meeting — 1 for most recent, 2 for second, etc." },
        },
        required: ["bank_query", "meeting_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_action_item",
      description: "Add a new action item (task) for a bank. Use when the user wants to log a follow-up task or responsibility.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          description: { type: "string", description: "What needs to be done" },
          owner: { type: "string", description: "Person responsible (optional)" },
          due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          status: { type: "string", enum: ["open", "in_progress", "done"], description: "Status, default is 'open'" },
        },
        required: ["bank_query", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_action_item",
      description: "Update or close an existing action item for a bank.",
      parameters: {
        type: "object",
        properties: {
          bank_query: { type: "string", description: "Bank name in Arabic or English, or bank ID" },
          item_index: { type: "number", description: "Which action item — 1 for most recent, 2 for second, etc." },
          status: { type: "string", enum: ["open", "in_progress", "done"], description: "New status" },
          description: { type: "string", description: "Updated description (optional)" },
          owner: { type: "string", description: "Updated owner (optional)" },
          due_date: { type: "string", description: "Updated due date YYYY-MM-DD (optional)" },
        },
        required: ["bank_query", "item_index", "status"],
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
        "Write the full report in English only. Do NOT use Arabic anywhere in the report body.",
        "Use EXACTLY these 8 section headers (## level) in this order: 📊 Overview | 🚨 Critical Banks | 📅 This Week's Meetings | ⏰ Overdue Actions | 🏆 Top Performers | 🐢 Lowest Progress | 💤 Stalled Banks | 💡 Recommendations",
        "For sections listing multiple banks with multiple attributes (name, status, progress, risk…) use a Markdown table. Example: | Bank | Status | Progress | Risk |\\n|---|---|---|---|\\n| Bank X | In Progress | 60% | High |",
        "For simple single-attribute lists (e.g. upcoming meetings: date + bank) use bullet points.",
        "## 💡 Recommendations is NON-NEGOTIABLE — write exactly 5 numbered actionable recommendations. Do NOT skip it.",
        `End with EXACTLY: **Report generated on:** ${reportDate}`,
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

  // ── get_bank_contacts ──────────────────────────────────────────────────────
  if (name === "get_bank_contacts") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const contacts = (match as any).contacts ?? [];
    if (contacts.length === 0) return { bank_name: match.name_ar || match.name_en, contacts: [], message: "لا توجد جهات اتصال مسجّلة لهذا البنك." };
    return {
      bank_name: match.name_ar || match.name_en,
      responsible_person: match.responsible_person,
      relationship_manager: match.relationship_manager,
      contacts,
    };
  }

  // ── manage_contact ─────────────────────────────────────────────────────────
  if (name === "manage_contact") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const bankRow = await db.select().from(banksTable).where(eq(banksTable.id, match.id)).then(r => r[0]);
    const contacts: Array<{ name: string; title?: string | null; phone?: string | null; email?: string | null }> =
      (bankRow?.contacts as any[]) ?? [];

    if (args.action === "add") {
      const exists = contacts.some(c => normalizeAr(c.name).includes(normalizeAr(args.name as string)));
      if (exists) return { error: `جهة الاتصال "${args.name}" موجودة بالفعل.` };
      const newContact = { name: args.name as string, title: args.title ?? null, phone: args.phone ?? null, email: args.email ?? null };
      const updated = [...contacts, newContact];
      await db.update(banksTable).set({ contacts: updated as any }).where(eq(banksTable.id, match.id));
      return { success: true, bank_name: match.name_ar || match.name_en, action: "added", contact: newContact, total_contacts: updated.length };
    }

    if (args.action === "remove") {
      const idx = contacts.findIndex(c => normalizeAr(c.name).includes(normalizeAr(args.name as string)));
      if (idx === -1) return { error: `لم أجد جهة اتصال باسم "${args.name}".` };
      const removed = contacts[idx];
      const updated = contacts.filter((_, i) => i !== idx);
      await db.update(banksTable).set({ contacts: updated as any }).where(eq(banksTable.id, match.id));
      return { success: true, bank_name: match.name_ar || match.name_en, action: "removed", removed_contact: removed, total_contacts: updated.length };
    }

    return { error: "الإجراء يجب أن يكون add أو remove." };
  }

  // ── update_implementation_stage ────────────────────────────────────────────
  if (name === "update_implementation_stage") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const stages = await db.select().from(implementationStagesTable).where(eq(implementationStagesTable.bankId, match.id));
    const q = (args.stage_name as string ?? "").toLowerCase();
    const target = stages.find((s: any) => s.name.toLowerCase().includes(q));
    if (!target) {
      return { error: `لم أجد مرحلة باسم "${args.stage_name}" لـ ${match.name_ar || match.name_en}. المراحل المتاحة: ${stages.map(s => s.name).join("، ")}` };
    }
    const newStatus = args.status as string;
    const isCompleted = args.completed !== undefined ? (args.completed as boolean) : newStatus === "completed";
    const update: Record<string, any> = {
      status: newStatus,
      completed: isCompleted,
      completedAt: isCompleted ? new Date().toISOString().split("T")[0] : null,
      updatedAt: new Date(),
    };
    if (args.notes !== undefined) update.notes = args.notes;
    await db.update(implementationStagesTable).set(update).where(eq(implementationStagesTable.id, target.id));
    return {
      success: true,
      bank_name: match.name_ar || match.name_en,
      stage: target.name,
      new_status: newStatus,
      completed: isCompleted,
    };
  }

  // ── search_banks ───────────────────────────────────────────────────────────
  if (name === "search_banks") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let results = [...allBanks];
    if (args.status)           results = results.filter(b => b.status === args.status);
    if (args.risk_level)       results = results.filter(b => b.risk_level === args.risk_level);
    if (args.category)         results = results.filter(b => (b.category ?? "").toLowerCase().includes((args.category as string).toLowerCase()));
    if (args.responsible_person) results = results.filter(b => (b.responsible_person ?? "").toLowerCase().includes((args.responsible_person as string).toLowerCase()));
    if (args.min_completion_pct !== undefined) results = results.filter(b => b.implementation.completion_pct >= (args.min_completion_pct as number));
    if (args.max_completion_pct !== undefined) results = results.filter(b => b.implementation.completion_pct <= (args.max_completion_pct as number));
    if (args.has_overdue_actions) {
      results = results.filter(b => (b as any).open_actions.some((a: any) => {
        if (!a.due_date) return false;
        return new Date(a.due_date) < today;
      }));
    }
    return {
      count: results.length,
      banks: results.map(b => ({
        name: b.name_ar || b.name_en,
        id: b.id,
        status: b.status,
        risk_level: b.risk_level,
        completion_pct: b.implementation.completion_pct,
        responsible_person: b.responsible_person,
        open_actions_count: (b as any).open_actions.length,
      })),
    };
  }

  // ── compare_banks ──────────────────────────────────────────────────────────
  if (name === "compare_banks") {
    const b1 = findBank(args.bank_query_1 as string ?? "", allBanks);
    const b2 = findBank(args.bank_query_2 as string ?? "", allBanks);
    if (!b1) return { error: `لم أجد البنك الأول "${args.bank_query_1}".` };
    if (!b2) return { error: `لم أجد البنك الثاني "${args.bank_query_2}".` };
    const summarize = (b: typeof b1) => ({
      name: b!.name_ar || b!.name_en,
      status: b!.status,
      risk_level: b!.risk_level,
      completion_pct: b!.implementation.completion_pct,
      completed_stages: b!.implementation.completed_stages,
      total_stages: b!.implementation.total_stages,
      current_stage: b!.implementation.current_stage,
      open_risks: b!.risks.filter(r => r.status !== "resolved").length,
      open_actions: (b as any).open_actions.length,
      responsible_person: b!.responsible_person,
      next_meeting: b!.next_meeting_date ?? "غير محدد",
    });
    return { bank_1: summarize(b1), bank_2: summarize(b2) };
  }

  // ── delete_action_item ─────────────────────────────────────────────────────
  if (name === "delete_action_item") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const idx = Math.max(1, (args.item_index as number) ?? 1);
    const items = await db.select().from(actionItemsTable).where(eq(actionItemsTable.bankId, match.id));
    items.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const target = items[idx - 1];
    if (!target) return { error: `لم أجد بند إجراء رقم ${idx} لـ ${match.name_ar || match.name_en}.` };
    await db.delete(actionItemsTable).where(eq(actionItemsTable.id, target.id));
    return { success: true, bank_name: match.name_ar || match.name_en, deleted_item: { description: target.description, status: target.status } };
  }

  // ── update_risk ────────────────────────────────────────────────────────────
  if (name === "update_risk") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const idx = Math.max(1, (args.risk_index as number) ?? 1);
    const risks = await db.select().from(risksTable).where(eq(risksTable.bankId, match.id));
    risks.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const target = risks[idx - 1];
    if (!target) return { error: `لم أجد مخاطرة رقم ${idx} لـ ${match.name_ar || match.name_en}.` };
    const update: Record<string, any> = {};
    if (args.status !== undefined)      update.status      = args.status;
    if (args.level !== undefined)       update.level       = args.level;
    if (args.description !== undefined) update.description = args.description;
    if (Object.keys(update).length === 0) return { error: "لم يُحدَّد أي حقل للتحديث." };
    await db.update(risksTable).set(update).where(eq(risksTable.id, target.id));
    return { success: true, bank_name: match.name_ar || match.name_en, risk_id: target.id, updated: update };
  }

  // ── archive_bank ───────────────────────────────────────────────────────────
  if (name === "archive_bank") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    if (match.isArchived) return { error: `البنك "${match.name_ar || match.name_en}" مؤرشف بالفعل.` };
    await db.update(banksTable).set({
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: args.reason ? `AI Agent: ${args.reason}` : "AI Agent",
    }).where(eq(banksTable.id, match.id));
    return { success: true, bank_id: match.id, bank_name: match.name_ar || match.name_en, message: `تم أرشفة البنك بنجاح.` };
  }

  // ── restore_bank ───────────────────────────────────────────────────────────
  if (name === "restore_bank") {
    // Need to find archived banks too — query DB directly
    const allBanksRaw = await db.select().from(banksTable);
    const q = (args.bank_query as string ?? "").toLowerCase().trim();
    const target = allBanksRaw.find(b =>
      b.id.toLowerCase() === q ||
      normalizeAr(b.nameAr ?? "").includes(normalizeAr(q)) ||
      (b.nameEn ?? "").toLowerCase().includes(q)
    );
    if (!target) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    if (!target.isArchived) return { error: `البنك "${target.nameAr || target.nameEn}" غير مؤرشف أصلاً.` };
    await db.update(banksTable).set({ isArchived: false, archivedAt: null, archivedBy: null }).where(eq(banksTable.id, target.id));
    return { success: true, bank_id: target.id, bank_name: target.nameAr || target.nameEn, message: `تم استعادة البنك بنجاح.` };
  }

  // ── delete_meeting ─────────────────────────────────────────────────────────
  if (name === "delete_meeting") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const idx = Math.max(1, (args.meeting_index as number) ?? 1);
    const meetings = await db.select().from(meetingsTable)
      .where(and(eq(meetingsTable.bankId, match.id), eq(meetingsTable.isArchived, false)));
    meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const target = meetings[idx - 1];
    if (!target) return { error: `لم أجد اجتماع رقم ${idx} لـ ${match.name_ar || match.name_en}.` };
    await db.update(meetingsTable).set({ isArchived: true }).where(eq(meetingsTable.id, target.id));
    return { success: true, bank_name: match.name_ar || match.name_en, deleted_meeting: { date: target.date, topic: target.topic } };
  }

  // ── add_action_item ────────────────────────────────────────────────────────
  if (name === "add_action_item") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    if (!args.description) return { error: "وصف بند الإجراء مطلوب." };
    await db.insert(actionItemsTable).values({
      bankId: match.id,
      description: args.description as string,
      owner: (args.owner as string | undefined) ?? null,
      dueDate: (args.due_date as string | undefined) ?? null,
      status: (args.status as string | undefined) ?? "open",
    });
    return { success: true, bank_name: match.name_ar || match.name_en, action_item: { description: args.description, status: args.status ?? "open" } };
  }

  // ── update_action_item ─────────────────────────────────────────────────────
  if (name === "update_action_item") {
    const match = findBank(args.bank_query as string ?? "", allBanks);
    if (!match) return { error: `لم أجد بنكاً باسم "${args.bank_query}".` };
    const idx = Math.max(1, (args.item_index as number) ?? 1);
    const items = await db.select().from(actionItemsTable).where(eq(actionItemsTable.bankId, match.id));
    items.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const target = items[idx - 1];
    if (!target) return { error: `لم أجد بند إجراء رقم ${idx} لـ ${match.name_ar || match.name_en}.` };
    const update: Record<string, any> = {};
    if (args.status !== undefined)      update.status      = args.status;
    if (args.description !== undefined) update.description = args.description;
    if (args.owner !== undefined)       update.owner       = args.owner;
    if (args.due_date !== undefined)    update.dueDate     = args.due_date;
    if (Object.keys(update).length === 0) return { error: "لم يُحدَّد أي حقل للتحديث." };
    await db.update(actionItemsTable).set(update).where(eq(actionItemsTable.id, target.id));
    return { success: true, bank_name: match.name_ar || match.name_en, item_id: target.id, updated: update };
  }

  return { error: `Unknown function: ${name}` };
}

// ── collectMutations — exported for unit tests ────────────────────────────────
export type AnyOAIMessage = {
  role: string;
  content?: unknown;
  tool_calls?: Array<{ id: string; function: { name: string } }>;
  tool_call_id?: string;
};

export type MutationResult = {
  banks: boolean;
  meetings: boolean;
  risks: boolean;
  mutatedBankIds: string[];
};

const BANK_WRITE_FNS_SET    = new Set(["update_bank", "create_bank"]);
const MEETING_WRITE_FNS_SET = new Set(["add_meeting", "update_meeting"]);
const RISK_WRITE_FNS_SET    = new Set(["add_risk"]);

/**
 * Walk the accumulated OpenAI messages and flag which data domains were mutated.
 * Pure function — no I/O — exported so it can be unit-tested in isolation.
 */
export function collectMutations(openaiMessages: AnyOAIMessage[]): MutationResult {
  const mutations: MutationResult = {
    banks: false,
    meetings: false,
    risks: false,
    mutatedBankIds: [],
  };

  for (const msg of openaiMessages) {
    if (msg.role !== "tool") continue;
    const content = typeof msg.content === "string" ? msg.content : "";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { /* skip */ }
    if (parsed.success !== true) continue;

    // Find the tool_call_id → function name by scanning assistant messages
    const toolCallId = msg.tool_call_id;
    for (const m of openaiMessages) {
      if (m.role !== "assistant") continue;
      const toolCalls = m.tool_calls;
      if (!toolCalls) continue;
      const tc = toolCalls.find((t) => t.id === toolCallId);
      if (!tc) continue;
      const fn = tc.function.name;
      if (BANK_WRITE_FNS_SET.has(fn)) {
        mutations.banks = true;
        const bankId = parsed.bank_id as string | undefined;
        if (bankId && !mutations.mutatedBankIds.includes(bankId)) {
          mutations.mutatedBankIds.push(bankId);
        }
      }
      if (MEETING_WRITE_FNS_SET.has(fn)) mutations.meetings = true;
      if (RISK_WRITE_FNS_SET.has(fn))    mutations.risks    = true;
      break;
    }
  }

  return mutations;
}

// ── Token budget helpers ──────────────────────────────────────────────────────
// Rough estimate: 1 token ≈ 4 chars (good enough for budget checks)
function estimateTokens(text: string) { return Math.ceil(text.length / 4); }

// Trim bank summaries progressively until they fit within a char budget.
// Budget = (model_limit - system_prompt - history - output_reserve) × 4
// nemotron-3-ultra-550b context: 1 000 000 tokens — no budget constraints needed.
// We target 18K tokens for the context block = 72,000 chars.
function trimBankContext(
  banks: Awaited<ReturnType<typeof buildBankContext>>,
  budgetChars = 72_000,
): [trimmed: typeof banks, pass: number] {
  const raw = JSON.stringify(banks, null, 0);
  if (raw.length <= budgetChars) return [banks, 0];

  // Pass 1 – drop open_actions details, keep count only
  const p1 = banks.map((b) => ({
    ...b,
    open_actions: (b as any).open_actions?.length ?? 0,
  }));
  const r1 = JSON.stringify(p1, null, 0);
  if (r1.length <= budgetChars) return [p1 as any, 1];

  // Pass 2 – also drop recent_meetings details
  const p2 = p1.map((b) => ({
    ...b,
    recent_meetings: (b as any).recent_meetings?.length ?? 0,
  }));
  const r2 = JSON.stringify(p2, null, 0);
  if (r2.length <= budgetChars) return [p2 as any, 2];

  // Pass 3 – drop risks details, keep count + high-risk count
  const p3 = p2.map((b) => ({
    ...b,
    risks: {
      total: (b as any).risks?.length ?? 0,
      high: (b as any).risks?.filter((r: any) => r.level === "High").length ?? 0,
    },
    contacts: undefined,
  }));
  const r3 = JSON.stringify(p3, null, 0);
  if (r3.length <= budgetChars) return [p3 as any, 3];

  // Pass 4 – ultra-minimal: one-line summary per bank
  const p4 = banks.map((b) => ({
    id: b.id, name: b.name_ar || b.name_en,
    status: b.status, risk_level: b.risk_level,
    completion_pct: b.implementation.completion_pct,
    responsible: b.responsible_person,
  }));
  return [p4 as any, 4];
}

// ── English error messages for known failure modes ────────────────────────────
function toArabicError(err: any): string {
  const msg: string = err?.message ?? String(err);
  const status: number | undefined = err?.status ?? err?.response?.status;

  if (status === 402 || msg.includes("Prompt tokens limit") || msg.includes("tokens limit"))
    return "Sorry, the data volume exceeds the current limit. Try a more specific question or start a new conversation.";
  if (status === 429 || msg.includes("rate limit") || msg.includes("Too Many Requests"))
    return "Wasalawi is busy right now — please wait a moment and try again.";
  if (status === 401 || msg.includes("Incorrect API key") || msg.includes("No auth"))
    return "There's an issue with the AI key configuration — please notify the tech team.";
  if (status === 503 || msg.includes("overloaded") || msg.includes("unavailable"))
    return "The AI service is overloaded right now — try again in a few seconds.";
  if (status === 400 && msg.includes("context"))
    return "The message exceeds the supported limit. Try a new conversation or ask about a narrower scope.";
  return "Could not process the request. If the error persists, please contact technical support.";
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

    // Build full context once — always passed to tools unchanged
    const rawContext = await buildBankContext();

    // Detect report / aggregate requests: skip injecting full JSON into system prompt
    // (the generate_weekly_report tool already computes everything it needs from rawContext)
    const lastMsg = (messages[messages.length - 1]?.content ?? "").toLowerCase();
    const isAggregateRequest = /تقرير|أسبوعي|weekly|report|ملخص.{0,6}تنفيذي|executive.{0,6}summary/i.test(lastMsg);

    // ── Token budget ───────────────────────────────────────────────────────────
    // gpt-4o-mini: 128k context. Fixed overhead ≈ 8k tokens (system+tools+msgs+response).
    // That leaves ~120k tokens (~480k chars) for bank data — we cap lower to stay snappy.
    //   FULL_CONTEXT_BUDGET: all banks summary (general questions)
    //   SINGLE_BANK_BUDGET:  one bank in full detail
    const FULL_CONTEXT_BUDGET = 40_000;   // ~10k tokens — all banks with good detail
    const SINGLE_BANK_BUDGET  = 80_000;   // ~20k tokens — one bank, very detailed

    // If the user is asking about a specific bank, narrow the context to that bank
    // only — this dramatically reduces prompt size and prevents 402 token-limit errors.
    // Use the same findBank logic already used by tool execution (handles Arabic
    // normalization, partial matches, bank ID matching).
    const singleBankContext = (() => {
      if (isAggregateRequest || rawContext.length <= 1) return null;
      // Tokenise the last message: try every 2–5 word window as a potential query.
      const words = lastMsg.trim().split(/\s+/).filter((w) => w.length >= 2);
      const candidates = new Set<typeof rawContext[0]>();
      for (let start = 0; start < words.length; start++) {
        for (let len = 1; len <= 5 && start + len <= words.length; len++) {
          const phrase = words.slice(start, start + len).join(" ");
          const hit = findBank(phrase, rawContext);
          if (hit) candidates.add(hit);
        }
      }
      return candidates.size === 1 ? [...candidates] : null;
    })();

    let contextBlock: string;
    if (isAggregateRequest) {
      // Minimal metadata only — tool will supply all detail
      const byStatus = rawContext.reduce<Record<string, number>>((acc, b) => {
        acc[b.status] = (acc[b.status] ?? 0) + 1; return acc;
      }, {});
      const avgPct = rawContext.length
        ? Math.round(rawContext.reduce((s, b) => s + b.implementation.completion_pct, 0) / rawContext.length)
        : 0;
      contextBlock = `\n\n<live_bank_data total="${rawContext.length}" as_of="${new Date().toISOString()}" mode="aggregate_request">\n` +
        `summary: avg_completion=${avgPct}%, statuses=${JSON.stringify(byStatus)}\n` +
        `Use generate_weekly_report or get_dashboard_summary tool for full detail.\n</live_bank_data>`;
    } else {
      // Normal queries — inject trimmed bank JSON.
      // Single-bank: use full detail with a generous budget.
      // General (all banks): use a tight budget to stay under the proxy token limit.
      const contextToTrim = singleBankContext ?? rawContext;
      const budget = singleBankContext ? SINGLE_BANK_BUDGET : FULL_CONTEXT_BUDGET;
      const [bankContext, trimPass] = trimBankContext(contextToTrim, budget);
      if (trimPass > 0) {
        req.log?.warn({ trimPass, banks: bankContext.length }, "[ai-chat] context trimmed to fit token budget");
      }
      contextBlock = `\n\n<live_bank_data total="${bankContext.length}" as_of="${new Date().toISOString()}"${trimPass > 0 ? ` detail_level="${4 - trimPass}"` : ""}>\n${JSON.stringify(bankContext, null, 0)}\n</live_bank_data>`;
    }

    const systemWithContext = SYSTEM_PROMPT + contextBlock;

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemWithContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // First call — may trigger a function
    let response = await callWithRetry(openai, {
      model: AI_MODEL,
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
      // Tool results are capped at 10 000 chars each so that the follow-up API
      // call (which includes system + tools + all messages + these results)
      // stays well under the Replit proxy token limit (~16 384 tokens).
      const TOOL_RESULT_MAX_CHARS = 10_000;
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          const fn = (tc as any).function as { name: string; arguments: string };
          let args: Record<string, any> = {};
          try { args = JSON.parse(fn.arguments); } catch { /* ignore */ }
          const result = await executeFunction(fn.name, args, rawContext);
          let content = JSON.stringify(result);
          if (content.length > TOOL_RESULT_MAX_CHARS) {
            // For structured objects, try to keep top-level keys and truncate arrays
            if (typeof result === "object" && result !== null && !Array.isArray(result)) {
              const compact = Object.fromEntries(
                Object.entries(result as Record<string, unknown>).map(([k, v]) => {
                  if (Array.isArray(v) && v.length > 10) return [k, [...v.slice(0, 10), `…(${v.length - 10} more)`]];
                  return [k, v];
                }),
              );
              const compactStr = JSON.stringify(compact);
              content = compactStr.length <= TOOL_RESULT_MAX_CHARS
                ? compactStr
                : compactStr.slice(0, TOOL_RESULT_MAX_CHARS) + "…[truncated]";
            } else {
              content = content.slice(0, TOOL_RESULT_MAX_CHARS) + "…[truncated]";
            }
          }
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content,
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
          content: `Write the full weekly report now — entirely in English. Do NOT use Arabic anywhere.

The report must contain EXACTLY these 8 sections in this order, using ## for each:

## 📊 Overview
## 🚨 Critical Banks
## 📅 This Week's Meetings
## ⏰ Overdue Actions
## 🏆 Top Performers
## 🐢 Lowest Progress
## 💤 Stalled Banks
## 💡 Recommendations

Under "## 💡 Recommendations" write exactly 5 numbered actionable recommendations based on the data.
End with EXACTLY this line: **Report generated on:** ${reportDate}`,
        });
      }

      // Get next response
      response = await callWithRetry(openai, {
        model: AI_MODEL,
        messages: openaiMessages,
        tools: AGENT_FUNCTIONS,
        tool_choice: calledReport ? "none" : "auto",
        max_tokens: 4096,
        temperature: 0.3,
      });
      choice = response.choices[0];
    }

    // ── Collect which data domains were mutated ────────────────────────────────
    const mutations = collectMutations(openaiMessages as AnyOAIMessage[]);

    const content = choice.message?.content ?? "";
    res.json({ reply: content, mutations });
  } catch (err: any) {
    req.log?.error({ err: err?.message ?? String(err) }, "[ai-chat] error");
    const arabicMsg = toArabicError(err);
    const status = (err?.status === 400 || err?.status === 402 || err?.status === 429) ? err.status : 500;
    res.status(status).json({ error: arabicMsg });
  }
});

export default router;

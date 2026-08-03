/**
 * Unit tests for collectMutations() — the pure function that walks the
 * accumulated OpenAI messages and determines which data domains were written.
 *
 * These tests guard against regressions where:
 *  - mutatedBankIds stops being populated after update_bank
 *  - a failed tool call incorrectly marks a domain as mutated
 *  - the same bank ID is duplicated in mutatedBankIds
 */
import { describe, it, expect } from "vitest";
import { collectMutations } from "./ai-chat.js";

// ── helpers ────────────────────────────────────────────────────────────────────

function assistantWithCall(id: string, fnName: string, argsJson = "{}") {
  return {
    role: "assistant" as const,
    content: null as unknown as string,
    tool_calls: [{ id, function: { name: fnName, arguments: argsJson } }],
  };
}

function toolResult(toolCallId: string, result: Record<string, unknown>) {
  return {
    role: "tool" as const,
    tool_call_id: toolCallId,
    content: JSON.stringify(result),
  };
}

// ── update_bank ────────────────────────────────────────────────────────────────

describe("collectMutations — update_bank", () => {
  it("sets banks=true and captures mutatedBankIds when update_bank succeeds", () => {
    const messages = [
      assistantWithCall("call_1", "update_bank", '{"bank_query":"الأهلي","status":"Completed"}'),
      toolResult("call_1", {
        success: true,
        bank_id: "BANK-001",
        bank_name: "البنك الأهلي",
        updated_fields: ["status"],
      }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(true);
    expect(result.mutatedBankIds).toContain("BANK-001");
    expect(result.meetings).toBe(false);
    expect(result.risks).toBe(false);
  });

  it("does NOT set banks=true when update_bank returns an error", () => {
    const messages = [
      assistantWithCall("call_err", "update_bank"),
      toolResult("call_err", { error: "لم أجد بنكاً باسم كذا" }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(false);
    expect(result.mutatedBankIds).toHaveLength(0);
  });

  it("collects mutatedBankIds from multiple parallel update_bank calls", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: null as unknown as string,
        tool_calls: [
          { id: "call_a", function: { name: "update_bank", arguments: "{}" } },
          { id: "call_b", function: { name: "update_bank", arguments: "{}" } },
        ],
      },
      toolResult("call_a", { success: true, bank_id: "BANK-001" }),
      toolResult("call_b", { success: true, bank_id: "BANK-002" }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(true);
    expect(result.mutatedBankIds).toContain("BANK-001");
    expect(result.mutatedBankIds).toContain("BANK-002");
    expect(result.mutatedBankIds).toHaveLength(2);
  });

  it("deduplicates mutatedBankIds when the same bank is updated twice", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: null as unknown as string,
        tool_calls: [
          { id: "call_x", function: { name: "update_bank", arguments: "{}" } },
          { id: "call_y", function: { name: "update_bank", arguments: "{}" } },
        ],
      },
      toolResult("call_x", { success: true, bank_id: "BANK-001" }),
      toolResult("call_y", { success: true, bank_id: "BANK-001" }), // same bank
    ];

    const result = collectMutations(messages);

    expect(result.mutatedBankIds).toHaveLength(1);
    expect(result.mutatedBankIds[0]).toBe("BANK-001");
  });

  it("handles a mix of successful and failed update_bank calls in one turn", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: null as unknown as string,
        tool_calls: [
          { id: "call_ok", function: { name: "update_bank", arguments: "{}" } },
          { id: "call_fail", function: { name: "update_bank", arguments: "{}" } },
        ],
      },
      toolResult("call_ok",   { success: true,  bank_id: "BANK-007" }),
      toolResult("call_fail", { error: "not found" }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(true);
    expect(result.mutatedBankIds).toEqual(["BANK-007"]);
  });
});

// ── create_bank ────────────────────────────────────────────────────────────────

describe("collectMutations — create_bank", () => {
  it("sets banks=true and captures the new bank_id", () => {
    const messages = [
      assistantWithCall("call_new", "create_bank"),
      toolResult("call_new", {
        success: true,
        bank_id: "BANK-099",
        bank_name_ar: "بنك جديد",
      }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(true);
    expect(result.mutatedBankIds).toContain("BANK-099");
  });
});

// ── meeting / risk mutations ────────────────────────────────────────────────────

describe("collectMutations — meetings", () => {
  it("sets meetings=true when add_meeting succeeds (banks remains false)", () => {
    const messages = [
      assistantWithCall("call_m", "add_meeting"),
      toolResult("call_m", { success: true, bank_id: "BANK-003" }),
    ];

    const result = collectMutations(messages);

    expect(result.meetings).toBe(true);
    expect(result.banks).toBe(false);
    // mutatedBankIds is NOT populated for meeting writes
    expect(result.mutatedBankIds).toHaveLength(0);
  });

  it("sets meetings=true when update_meeting succeeds", () => {
    const messages = [
      assistantWithCall("call_um", "update_meeting"),
      toolResult("call_um", { success: true }),
    ];

    const result = collectMutations(messages);

    expect(result.meetings).toBe(true);
  });
});

describe("collectMutations — risks", () => {
  it("sets risks=true when add_risk succeeds", () => {
    const messages = [
      assistantWithCall("call_r", "add_risk"),
      toolResult("call_r", { success: true, bank_id: "BANK-005" }),
    ];

    const result = collectMutations(messages);

    expect(result.risks).toBe(true);
    expect(result.banks).toBe(false);
  });
});

// ── read-only functions produce no mutations ────────────────────────────────────

describe("collectMutations — read-only functions", () => {
  it.each([
    "get_bank_details",
    "get_dashboard_summary",
    "generate_weekly_report",
  ])("returns all false for %s", (fnName) => {
    const messages = [
      assistantWithCall("call_ro", fnName),
      toolResult("call_ro", { id: "BANK-001", name_ar: "البنك الأهلي" }),
    ];

    const result = collectMutations(messages);

    expect(result.banks).toBe(false);
    expect(result.meetings).toBe(false);
    expect(result.risks).toBe(false);
    expect(result.mutatedBankIds).toHaveLength(0);
  });
});

// ── edge cases ─────────────────────────────────────────────────────────────────

describe("collectMutations — edge cases", () => {
  it("returns all false for an empty message array", () => {
    const result = collectMutations([]);
    expect(result.banks).toBe(false);
    expect(result.meetings).toBe(false);
    expect(result.risks).toBe(false);
    expect(result.mutatedBankIds).toHaveLength(0);
  });

  it("ignores tool results with malformed JSON content", () => {
    const messages = [
      assistantWithCall("call_bad", "update_bank"),
      { role: "tool" as const, tool_call_id: "call_bad", content: "not-json{{" },
    ];

    const result = collectMutations(messages);
    expect(result.banks).toBe(false);
  });
});

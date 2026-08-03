/**
 * Unit tests for applyMutationInvalidations()
 *
 * These tests verify that when the AI chat endpoint returns a mutations block
 * the frontend correctly calls queryClient.invalidateQueries for:
 *   - getListBanksQueryKey()           — bank list views
 *   - getGetDashboardSummaryQueryKey() — dashboard
 *   - getGetBankQueryKey(id)           — the individual bank detail page
 *   - getListMeetingsQueryKey()        — meetings list
 *   - getListRisksQueryKey()           — risks list
 *
 * Crucially, the per-bank detail invalidation is what prevents the stale-data
 * bug: a user with a bank's detail page open should see updated data after
 * Noor makes a change, without a manual page reload.
 */
import { describe, it, expect, vi, type Mock } from "vitest";
import { applyMutationInvalidations } from "./mutation-invalidations";
import {
  getGetBankQueryKey,
  getListBanksQueryKey,
  getGetDashboardSummaryQueryKey,
  getListMeetingsQueryKey,
  getListRisksQueryKey,
} from "@workspace/api-client-react";

function makeQueryClient() {
  const invalidateQueries: Mock = vi.fn().mockResolvedValue(undefined);
  return { client: { invalidateQueries } as any, invalidateQueries };
}

// ── banks mutations ────────────────────────────────────────────────────────────

describe("applyMutationInvalidations — banks", () => {
  it("invalidates list-banks and dashboard when banks=true", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { banks: true, mutatedBankIds: [] });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListBanksQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetDashboardSummaryQueryKey() });
  });

  it("invalidates the individual bank detail query for each mutatedBankId", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, {
      banks: true,
      mutatedBankIds: ["BANK-042"],
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getGetBankQueryKey("BANK-042"),
    });
  });

  it("invalidates detail queries for every ID in mutatedBankIds", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, {
      banks: true,
      mutatedBankIds: ["BANK-001", "BANK-002", "BANK-003"],
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetBankQueryKey("BANK-001") });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetBankQueryKey("BANK-002") });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetBankQueryKey("BANK-003") });
  });

  it("does NOT call invalidateQueries for bank detail when mutatedBankIds is empty", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { banks: true, mutatedBankIds: [] });

    const calledKeys = invalidateQueries.mock.calls.map(
      ([arg]: [{ queryKey: unknown[] }]) => JSON.stringify(arg.queryKey),
    );
    const bankDetailKey = JSON.stringify(getGetBankQueryKey(""));
    // None of the called keys should look like a per-bank detail key
    // (they should only be list/dashboard keys which have no ID segment)
    const detailCalls = calledKeys.filter((k: string) => {
      // getGetBankQueryKey always includes a non-empty id; if mutatedBankIds is
      // empty the function is never called with any real bank id.
      return !calledKeys.includes(JSON.stringify(getListBanksQueryKey())) ||
             k !== JSON.stringify(getListBanksQueryKey()) &&
             k !== JSON.stringify(getGetDashboardSummaryQueryKey());
    });
    // Only the 2 list/dashboard calls should exist
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("does NOT touch meetings or risks queries when only banks=true", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { banks: true, mutatedBankIds: [] });

    const calledKeys = invalidateQueries.mock.calls.map(
      ([arg]: [{ queryKey: unknown[] }]) => JSON.stringify(arg.queryKey),
    );
    expect(calledKeys).not.toContain(JSON.stringify(getListMeetingsQueryKey()));
    expect(calledKeys).not.toContain(JSON.stringify(getListRisksQueryKey()));
  });
});

// ── meetings mutations ─────────────────────────────────────────────────────────

describe("applyMutationInvalidations — meetings", () => {
  it("invalidates meetings list, banks list, and dashboard when meetings=true", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { meetings: true });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListMeetingsQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListBanksQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetDashboardSummaryQueryKey() });
  });
});

// ── risks mutations ────────────────────────────────────────────────────────────

describe("applyMutationInvalidations — risks", () => {
  it("invalidates risks list when risks=true", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { risks: true });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListRisksQueryKey() });
  });

  it("does NOT touch banks or meetings queries when only risks=true", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, { risks: true });

    const calledKeys = invalidateQueries.mock.calls.map(
      ([arg]: [{ queryKey: unknown[] }]) => JSON.stringify(arg.queryKey),
    );
    expect(calledKeys).not.toContain(JSON.stringify(getListBanksQueryKey()));
    expect(calledKeys).not.toContain(JSON.stringify(getListMeetingsQueryKey()));
  });
});

// ── no-op ─────────────────────────────────────────────────────────────────────

describe("applyMutationInvalidations — no-op", () => {
  it("calls invalidateQueries zero times when all flags are false/undefined", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, {});

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("calls invalidateQueries zero times when mutations object is empty (read-only AI response)", async () => {
    const { client, invalidateQueries } = makeQueryClient();

    await applyMutationInvalidations(client, {
      banks: false,
      meetings: false,
      risks: false,
      mutatedBankIds: [],
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

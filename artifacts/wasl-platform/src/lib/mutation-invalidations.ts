/**
 * mutation-invalidations.ts
 *
 * Pure helper that takes a TanStack QueryClient and the mutations block
 * returned by POST /api/ai/chat and invalidates all stale queries.
 *
 * Extracted from WaslAIChat so it can be unit-tested without a full React
 * component setup.
 */
import type { QueryClient } from '@tanstack/react-query';
import {
  getListBanksQueryKey,
  getGetDashboardSummaryQueryKey,
  getListMeetingsQueryKey,
  getListRisksQueryKey,
  getGetBankQueryKey,
} from '@workspace/api-client-react';

export interface ChatMutations {
  banks?: boolean;
  meetings?: boolean;
  risks?: boolean;
  mutatedBankIds?: string[];
}

/**
 * Invalidate every React Query cache entry touched by Noor's write actions.
 *
 * When `banks` is true the individual bank detail query for every ID listed in
 * `mutatedBankIds` is also invalidated, so a user who has that bank's detail
 * page open sees fresh data without a manual reload.
 */
export async function applyMutationInvalidations(
  queryClient: QueryClient,
  mut: ChatMutations,
): Promise<void> {
  if (mut.banks) {
    await queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    // Invalidate the individual bank detail page so a user with that bank
    // open sees the updated data without a manual refresh.
    for (const bankId of mut.mutatedBankIds ?? []) {
      await queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
    }
  }
  if (mut.meetings) {
    await queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    // meetings also affect bank last-activity views
    await queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }
  if (mut.risks) {
    await queryClient.invalidateQueries({ queryKey: getListRisksQueryKey() });
  }
}

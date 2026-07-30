/**
 * useRealtimeUpdates
 *
 * Opens a persistent SSE connection to /api/events.
 * When the server emits a data-change event, the relevant
 * React-Query caches are invalidated so the UI refreshes automatically —
 * no page reload or manual refresh needed.
 *
 * Mount this once in the authenticated part of the app (e.g. App.tsx).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListBanksQueryKey, getListMeetingsQueryKey } from '@workspace/api-client-react';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2_000; // start at 2 s, back off up to 30 s

    function connect() {
      es = new EventSource('/api/events');

      es.onopen = () => {
        retryDelay = 2_000; // reset back-off on successful connection
      };

      // ── bank_updated ───────────────────────────────────────────────────────
      es.addEventListener('bank_updated', () => {
        // Invalidate the whole bank list and any open bank detail
        queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
        // Also refresh the dashboard summary (status counts, KPIs)
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['summary'] });
      });

      // ── meeting_updated ────────────────────────────────────────────────────
      es.addEventListener('meeting_updated', () => {
        queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      });

      // ── dashboard_changed (catch-all) ──────────────────────────────────────
      es.addEventListener('dashboard_changed', () => {
        queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      });

      es.onerror = () => {
        es?.close();
        es = null;
        // Exponential back-off, cap at 30 s
        retryDelay = Math.min(retryDelay * 1.5, 30_000);
        retryTimeout = setTimeout(connect, retryDelay);
      };
    }

    connect();

    return () => {
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [queryClient]);
}

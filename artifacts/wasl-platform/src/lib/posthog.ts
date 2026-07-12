/**
 * PostHog singleton initializer.
 * Called once from PostHogProvider on first mount.
 * Safe to call multiple times — guards against double-init.
 */
import posthogJs from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (!key || !host) {
    console.warn('[PostHog] VITE_POSTHOG_KEY or VITE_POSTHOG_HOST is missing — analytics disabled.');
    return;
  }

  posthogJs.init(key, {
    api_host: host,

    // ── Product Analytics ──────────────────────────────────────────────────
    autocapture: true,
    capture_pageview: false,    // handled manually in PostHogProvider
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',

    // ── Session Replay ─────────────────────────────────────────────────────
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },

    // ── Performance Monitoring ─────────────────────────────────────────────
    capture_performance: true,

    // ── Error Tracking ─────────────────────────────────────────────────────
    capture_exceptions: true,

    loaded: (ph) => {
      // Verbose debug logs only during local development
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialized = true;
}

// Re-export the singleton so callers import from one place
export { posthogJs as posthog };

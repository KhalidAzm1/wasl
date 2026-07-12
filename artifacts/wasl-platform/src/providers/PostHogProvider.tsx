/**
 * PostHogProvider
 * ───────────────
 * Wraps the app and handles three cross-cutting concerns:
 *  1. PostHog initialisation (once, on first mount)
 *  2. User identification — called whenever session / role resolves
 *  3. Automatic page-view tracking — fires on every Wouter route change
 */
import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { initPostHog, posthog } from '@/lib/posthog';
import { useAuth } from '@/lib/authContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1280) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { session, role, loading } = useAuth();
  const [location] = useLocation();

  // 1. Initialise PostHog once on mount
  useEffect(() => {
    initPostHog();
  }, []);

  // 2. Identify / reset user whenever auth state changes
  useEffect(() => {
    if (loading) return;

    if (session?.user) {
      const user = session.user;
      const userName =
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        user.email ??
        'Unknown';

      posthog.identify(user.id, {
        user_id: user.id,
        user_name: userName,
        user_role: role ?? 'unknown',
        email: user.email,
        device_type: getDeviceType(),
        browser: getBrowser(),
        company: 'Wasl',
      });
    } else {
      // Signed out — wipe any previously identified user
      posthog.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, role, loading]);

  // 3. Automatic page-view on every route change
  useEffect(() => {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return <>{children}</>;
}

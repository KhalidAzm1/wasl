import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Always persist sessions so users stay logged in across page refreshes
    persistSession: true,
    // Automatically refresh the JWT before it expires (every ~50 min)
    autoRefreshToken: true,
    // Detect magic-link / OAuth tokens in the URL on load
    detectSessionInUrl: true,
    // Use localStorage as the default storage (explicit to avoid edge-case
    // where some bundlers or SSR environments swap it out silently)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'editor' | 'viewer';

export interface AppPermissions {
  user_management: boolean;
  documents: boolean;
  meetings: boolean;
  security: boolean;
  dashboard_access: boolean;
}

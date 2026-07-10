import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

export const supabase = createClient(url, anonKey);

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'editor' | 'viewer';

export interface AppPermissions {
  user_management: boolean;
  documents: boolean;
  meetings: boolean;
  security: boolean;
  dashboard_access: boolean;
}

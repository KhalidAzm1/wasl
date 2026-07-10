import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "super_admin" | "admin" | "manager" | "editor" | "viewer";

export interface UserPermissions {
  user_management: boolean;
  documents: boolean;
  meetings: boolean;
  security: boolean;
  dashboard_access: boolean;
}

export const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  "user_management",
  "documents",
  "meetings",
  "security",
  "dashboard_access",
];

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  super_admin: { user_management: true, documents: true, meetings: true, security: true, dashboard_access: true },
  admin: { user_management: true, documents: true, meetings: true, security: true, dashboard_access: true },
  manager: { user_management: false, documents: true, meetings: true, security: false, dashboard_access: true },
  editor: { user_management: false, documents: true, meetings: true, security: false, dashboard_access: true },
  viewer: { user_management: false, documents: false, meetings: false, security: false, dashboard_access: true },
};

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set. Did you forget to configure Supabase?`);
  }
  return value;
}

/**
 * Server-only client authorized with the service role key. Bypasses Row Level
 * Security -- never expose this client or its key to the browser. Do not
 * cache the instance across requests that might run in different contexts;
 * it's cheap to construct.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Anon-key client, safe for use in browser/client contexts. Subject to Row
 * Level Security policies.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey);
}

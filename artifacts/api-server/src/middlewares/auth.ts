import type { NextFunction, Request, Response } from "express";
import { getSupabaseAdmin, type UserRole, type UserPermissions, DEFAULT_PERMISSIONS } from "@workspace/supabase";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        permissions: UserPermissions;
      };
    }
  }
}

// ── Auth cache ────────────────────────────────────────────────────────────────
// Cache the resolved authUser per bearer token for up to 60 seconds.
// This eliminates 2 Supabase network round-trips on every API request.
// The TTL is well below Supabase's 1-hour token expiry so stale sessions
// are detected quickly. Cache is in-process only — cleared on restart.
//
// inflight map: if N concurrent requests arrive with the same token before
// the first lookup completes, they all await the same promise instead of
// each firing their own Supabase calls.
const AUTH_CACHE_TTL_MS = 60_000;
interface CachedAuth {
  authUser: NonNullable<Request["authUser"]>;
  expiresAt: number;
}
const authCache = new Map<string, CachedAuth>();
const authInflight = new Map<string, Promise<CachedAuth | null>>();

// Purge expired entries periodically so the Maps don't grow unboundedly.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of authCache) {
    if (entry.expiresAt <= now) authCache.delete(token);
  }
}, 120_000).unref();

/**
 * Verifies the Supabase-issued bearer token and loads the caller's profile
 * (including role) from the `profiles` table. Rejects deleted/deactivated
 * profiles. Results are cached in-process for 60 s to avoid repeated
 * Supabase round-trips on every API request.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  // Fast path: return cached auth if still valid
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    req.authUser = cached.authUser;
    next();
    return;
  }

  // Dedup: if another request with the same token is already resolving,
  // wait for that promise instead of firing duplicate Supabase calls.
  let inflight = authInflight.get(token);
  if (!inflight) {
    inflight = (async (): Promise<CachedAuth | null> => {
      const supabase = getSupabaseAdmin();
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, name, role, permissions, deleted_at")
        .eq("id", userData.user.id)
        .single();
      if (profileError || !profile || profile.deleted_at) return null;

      const role = profile.role as UserRole;
      const permissions: UserPermissions = {
        ...DEFAULT_PERMISSIONS[role],
        ...(profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {}),
      };
      const authUser = {
        id: profile.id,
        email: profile.email,
        name: profile.name ?? profile.email,
        role,
        permissions,
      };
      const entry: CachedAuth = { authUser, expiresAt: Date.now() + AUTH_CACHE_TTL_MS };
      authCache.set(token, entry);
      return entry;
    })().finally(() => authInflight.delete(token));

    authInflight.set(token, inflight);
  }

  const result = await inflight;
  if (!result) {
    authCache.delete(token);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.authUser = result.authUser;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "Insufficient role" });
      return;
    }
    next();
  };
}

/**
 * Gates a route on a granular permission flag (in addition to/instead of
 * `requireRole`). Must run after `requireAuth`. Fails closed if the flag is
 * missing or false.
 */
export function requirePermission(permission: keyof UserPermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser || !req.authUser.permissions[permission]) {
      res.status(403).json({ error: "Insufficient permission" });
      return;
    }
    next();
  };
}

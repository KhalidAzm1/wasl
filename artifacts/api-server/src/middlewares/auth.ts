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
        assignedBankIds: string[];
      };
    }
  }
}

// ── Auth cache ────────────────────────────────────────────────────────────────
// Cache the resolved authUser per bearer token for 5 minutes.
// Eliminates 2-3 Supabase round-trips on every API request.
// TTL << Supabase 1-hour expiry → stale sessions still detected promptly.
//
// inflight map: N concurrent requests with the same token share one lookup.
const AUTH_CACHE_TTL_MS = 5 * 60_000; // 5 min
const AUTH_STALE_TTL_MS = 10 * 60_000; // keep stale entry for circuit-breaker fallback

// ── Circuit breaker ───────────────────────────────────────────────────────────
// Opens after 3 consecutive Supabase failures; auto-resets after 30 s.
// When open, serves stale cache if available instead of failing outright.
let cbFailures = 0;
let cbOpenUntil = 0;
const CB_THRESHOLD = 3;
const CB_RESET_MS = 30_000;
function cbIsOpen() { return cbOpenUntil > Date.now(); }
function cbSuccess() { cbFailures = 0; cbOpenUntil = 0; }
function cbFailure(log: (msg: string) => void) {
  cbFailures++;
  if (cbFailures >= CB_THRESHOLD) {
    cbOpenUntil = Date.now() + CB_RESET_MS;
    log(`Auth circuit breaker opened (${cbFailures} failures). Will retry after ${CB_RESET_MS / 1000}s.`);
  }
}
interface CachedAuth {
  authUser: NonNullable<Request["authUser"]>;
  expiresAt: number;
  staleUntil: number; // kept longer for circuit-breaker fallback
}
const authCache = new Map<string, CachedAuth>();
const authInflight = new Map<string, Promise<CachedAuth | null>>();

// Purge entries past their stale window periodically.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of authCache) {
    if (entry.staleUntil <= now) authCache.delete(token);
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

  const now = Date.now();

  // Fast path: cache hit (not expired)
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) {
    req.authUser = cached.authUser;
    next();
    return;
  }

  // Circuit-breaker: Supabase is struggling — serve stale cache if available
  if (cbIsOpen()) {
    if (cached && cached.staleUntil > now) {
      req.authUser = cached.authUser; // serve stale entry
      next();
      return;
    }
    // No stale entry — fail closed with 503 so the client knows to retry
    res.status(503).json({ error: "Auth service temporarily unavailable — please retry shortly" });
    return;
  }

  // Dedup: if another request with the same token is already resolving,
  // wait for that promise instead of firing duplicate Supabase calls.
  let inflight = authInflight.get(token);
  if (!inflight) {
    inflight = (async (): Promise<CachedAuth | null> => {
      try {
        const supabase = getSupabaseAdmin();
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          cbFailure((msg) => console.warn("[auth]", msg));
          return null;
        }

        // Critical: role + permissions — must succeed or we reject the request
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, name, role, permissions, deleted_at")
          .eq("id", userData.user.id)
          .single();
        if (profileError || !profile || profile.deleted_at) {
          cbFailure((msg) => console.warn("[auth]", msg));
          return null;
        }

        cbSuccess(); // clear failure count on successful profile load

        const role = profile.role as UserRole;
        const storedPermissions =
          profile.permissions && typeof profile.permissions === "object"
            ? (profile.permissions as Partial<UserPermissions>)
            : {};
        const permissions: UserPermissions = {
          ...DEFAULT_PERMISSIONS[role],
          ...storedPermissions,
          // dashboard_access is a basic right tied to the role — it must never
          // be stripped by a stored override. All defined roles have it set to
          // true and an admin can't revoke it from the granular-permissions UI.
          dashboard_access: DEFAULT_PERMISSIONS[role].dashboard_access,
        };

        // Non-critical: assigned_bank_ids — PostgREST cache may lag; default to []
        let assignedBankIds: string[] = [];
        try {
          const { data: bankData } = await supabase
            .from("profiles")
            .select("assigned_bank_ids")
            .eq("id", userData.user.id)
            .single();
          if (Array.isArray(bankData?.assigned_bank_ids)) {
            assignedBankIds = bankData.assigned_bank_ids as string[];
          }
        } catch {
          // non-critical — no bank restriction when unknown
        }

        const authUser = {
          id: profile.id,
          email: profile.email,
          name: profile.name ?? profile.email,
          role,
          permissions,
          assignedBankIds,
        };
        const entry: CachedAuth = {
          authUser,
          expiresAt: now + AUTH_CACHE_TTL_MS,
          staleUntil: now + AUTH_STALE_TTL_MS,
        };
        authCache.set(token, entry);
        return entry;
      } catch (err) {
        cbFailure((msg) => console.warn("[auth]", msg));
        console.error("[auth] unexpected error:", err);
        return null;
      }
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

/**
 * Enforces per-bank edit restrictions.
 * If the authenticated user has an `assignedBankId`, they may only mutate
 * their assigned bank. Super admins are always unrestricted.
 *
 * For routes with :id  — the param must match assignedBankId.
 * For routes without :id (e.g. POST /banks) — blocked entirely when restricted.
 */
export function requireBankEditAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  // Super admins bypass all bank restrictions
  if (user.role === "super_admin") { next(); return; }
  if (!user.assignedBankIds || user.assignedBankIds.length === 0) { next(); return; }

  const routeBankId = req.params.id;
  if (!routeBankId) {
    res.status(403).json({ error: "ليس لديك صلاحية إنشاء بنك جديد — بنوكك المخصصة فقط" });
    return;
  }
  if (!user.assignedBankIds.some((id) => id === routeBankId)) {
    res.status(403).json({ error: "يمكنك تعديل بنوكك المخصصة فقط" });
    return;
  }
  next();
}

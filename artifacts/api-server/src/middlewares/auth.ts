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

/**
 * Verifies the Supabase-issued bearer token and loads the caller's profile
 * (including role) from the `profiles` table. Rejects deleted/deactivated
 * profiles.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, permissions, deleted_at")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || profile.deleted_at) {
    res.status(403).json({ error: "No active profile for this account" });
    return;
  }

  const role = profile.role as UserRole;
  // Older rows created before the permissions column existed (or rows saved
  // with a partial/malformed permissions object) fall back to the role's
  // default grant, merged under any keys the row does have -- never trust a
  // missing key as "granted".
  const permissions: UserPermissions = {
    ...DEFAULT_PERMISSIONS[role],
    ...(profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {}),
  };

  req.authUser = {
    id: profile.id,
    email: profile.email,
    name: profile.name ?? profile.email,
    role,
    permissions,
  };
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

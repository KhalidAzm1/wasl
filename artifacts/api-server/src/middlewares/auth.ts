import type { NextFunction, Request, Response } from "express";
import { getSupabaseAdmin, type UserRole } from "@workspace/supabase";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        role: UserRole;
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
    .select("id, email, role, deleted_at")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || profile.deleted_at) {
    res.status(403).json({ error: "No active profile for this account" });
    return;
  }

  req.authUser = { id: profile.id, email: profile.email, role: profile.role as UserRole };
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

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin, DEFAULT_PERMISSIONS, type UserRole, type UserPermissions } from "@workspace/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All user-management endpoints require a valid session, super_admin role,
// and a verified PIN token (see requirePinToken below).
router.use("/admin/users", requireAuth, requireRole("super_admin"), requirePinToken);

// --- Admin panel PIN (second factor) ---------------------------------------
//
// Verifying the PIN issues a short-lived signed token bound to the caller's
// user id. The token itself (not just a client-side flag) is required on
// every /admin/users/* request below, so a super_admin who only has a valid
// login session — but hasn't entered the PIN — cannot reach these routes by
// calling the API directly or by faking client state.
const PIN_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Fail closed: a missing SESSION_SECRET must never silently downgrade to an
// empty/known signing key (which would make PIN tokens trivially forgeable).
function getPinSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured; cannot sign/verify admin PIN tokens");
  }
  return secret;
}

function signPinToken(userId: string, expiresAt: number): string {
  const secret = getPinSigningSecret();
  const payload = `${userId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyPinToken(token: string, userId: string): boolean {
  try {
    const secret = getPinSigningSecret();
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [tokenUserId, expiresAtStr, sig] = decoded.split(".");
    if (!tokenUserId || !expiresAtStr || !sig) return false;
    if (tokenUserId !== userId) return false;
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

    const payload = `${tokenUserId}.${expiresAtStr}`;
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function requirePinToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-pin-token"];
  let valid = false;
  try {
    valid = typeof token === "string" && Boolean(req.authUser) && verifyPinToken(token, req.authUser!.id);
  } catch {
    valid = false; // fail closed (e.g. SESSION_SECRET misconfigured)
  }
  if (!valid) {
    res.status(403).json({ error: "يلزم إدخال الرقم السري لهذه الصفحة" });
    return;
  }
  next();
}

const permissionsSchema = z
  .object({
    user_management: z.boolean(),
    documents: z.boolean(),
    meetings: z.boolean(),
    security: z.boolean(),
    dashboard_access: z.boolean(),
  })
  .partial();

const ROLE_VALUES = ["super_admin", "admin", "manager", "editor", "viewer"] as const;

const createUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLE_VALUES),
  permissions: permissionsSchema.optional(),
});

const updateUserBody = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  permissions: permissionsSchema.optional(),
});

const PROFILE_COLUMNS = "id, name, email, role, permissions, assigned_bank_ids, created_at, updated_at, deleted_at";

// A partial/missing permissions payload is always merged onto the target
// role's default grant -- never persisted as-is -- so a client can only ever
// widen or narrow specific flags, not silently end up with an incomplete
// permissions object that other code (nav gating, requirePermission) would
// have to guess how to interpret.
function normalizePermissions(role: UserRole, partial?: Partial<UserPermissions>): UserPermissions {
  return { ...DEFAULT_PERMISSIONS[role], ...(partial ?? {}) };
}

router.get("/admin/users", async (_req, res): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ users: data });
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const parsed = createUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password, role, permissions } = parsed.data;
  const supabase = getSupabaseAdmin();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, must_change_password: true },
  });

  if (createError || !created?.user) {
    res.status(400).json({ error: createError?.message ?? "Failed to create auth user" });
    return;
  }

  const insertRow: Record<string, unknown> = {
    id: created.user.id,
    name,
    email,
    role,
    permissions: normalizePermissions(role, permissions),
  };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert(insertRow)
    .select(PROFILE_COLUMNS)
    .single();

  if (profileError) {
    // Roll back the auth user so we don't leave an orphaned account. If the
    // rollback itself fails, surface both errors so an operator can clean up
    // the orphaned auth user manually instead of the failure going silent.
    const { error: rollbackError } = await supabase.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      res.status(500).json({
        error: `Failed to create profile (${profileError.message}); rollback of auth user ${created.user.id} also failed (${rollbackError.message}). Manual cleanup required.`,
      });
      return;
    }
    res.status(500).json({ error: profileError.message });
    return;
  }

  res.status(201).json({ user: profile });
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const parsed = updateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const supabase = getSupabaseAdmin();

  const updateRow: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.role || parsed.data.permissions) {
    // Merging permissions requires knowing the current row: a role change
    // without an explicit permissions payload should re-baseline to the new
    // role's defaults, while a permissions-only change should layer onto
    // whatever the row already has (not silently reset unrelated flags).
    // The existing side is itself normalized against its own role's
    // defaults first, so a previously-partial/malformed stored object can
    // never survive another merge still partial.
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("role, permissions")
      .eq("id", req.params.id)
      .single();
    if (existingError || !existing) {
      res.status(404).json({ error: existingError?.message ?? "User not found" });
      return;
    }
    const existingRole = existing.role as UserRole;
    const targetRole = (parsed.data.role ?? existingRole) as UserRole;
    const base = parsed.data.role
      ? DEFAULT_PERMISSIONS[targetRole]
      : normalizePermissions(existingRole, existing.permissions ?? undefined);
    const nextPermissions = { ...base, ...(parsed.data.permissions ?? {}) };

    // Guardrail: never let a write strip `user_management` from the last
    // active (non-deactivated) super_admin/admin with it enabled -- that's
    // the only door back into this page, so losing it here is unrecoverable
    // without direct DB access.
    if (existing.role === "super_admin" && req.authUser?.id === req.params.id && !nextPermissions.user_management) {
      res.status(400).json({ error: "لا يمكنك إزالة صلاحية إدارة المستخدمين عن حسابك الخاص" });
      return;
    }
    if (!nextPermissions.user_management) {
      const { data: otherAdmins, error: otherAdminsError } = await supabase
        .from("profiles")
        .select("id, permissions")
        .in("role", ["super_admin", "admin"])
        .is("deleted_at", null)
        .neq("id", req.params.id);
      if (otherAdminsError) {
        res.status(500).json({ error: otherAdminsError.message });
        return;
      }
      const anotherHasUserManagement = (otherAdmins ?? []).some((row) => row.permissions?.user_management === true);
      if (!anotherHasUserManagement) {
        res.status(400).json({
          error: "لا يمكن إزالة صلاحية إدارة المستخدمين من آخر مسؤول يملكها في النظام",
        });
        return;
      }
    }

    updateRow.permissions = nextPermissions;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updateRow)
    .eq("id", req.params.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

const verifyPinBody = z.object({
  pin: z.string().min(1),
});

// Basic in-memory rate limit on PIN attempts per user, to slow down online
// guessing. Resets on process restart; acceptable for a single-instance API
// server protecting a low-volume internal admin panel.
const PIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const PIN_ATTEMPT_MAX = 5;
const pinAttempts = new Map<string, { count: number; windowStart: number }>();

function isPinRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = pinAttempts.get(userId);
  if (!entry || now - entry.windowStart > PIN_ATTEMPT_WINDOW_MS) {
    pinAttempts.set(userId, { count: 0, windowStart: now });
    return false;
  }
  return entry.count >= PIN_ATTEMPT_MAX;
}

function recordPinAttempt(userId: string): void {
  const entry = pinAttempts.get(userId);
  if (entry) entry.count += 1;
}

// A second factor gating access to the Admin Panel itself, on top of
// super_admin auth. Kept separate from Supabase auth so a leaked/guessed
// login alone can't reach user management.
// NOTE: requireRole is applied inline (not as middleware) so that we can emit
// diagnostic log lines at every stage — middleware failures are otherwise
// invisible in the handler and make root-cause analysis impossible.
router.post("/admin/verify-pin", requireAuth, async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const userRole = req.authUser!.role;

  // Stage 1: role check (mirrors requireRole("super_admin"))
  if (userRole !== "super_admin") {
    logger.warn({ userId, userRole }, "verify-pin: insufficient role");
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  // Stage 2: parse body
  const parsed = verifyPinBody.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ userId }, "verify-pin: missing or invalid pin field in body");
    res.status(400).json({ error: "Missing PIN" });
    return;
  }

  // Stage 3: rate-limit check
  if (isPinRateLimited(userId)) {
    logger.warn({ userId, attempts: pinAttempts.get(userId)?.count }, "verify-pin: rate limited");
    res.status(429).json({ error: "محاولات كثيرة جدًا، حاول لاحقًا" });
    return;
  }

  // Stage 4: env-var presence
  const expected = process.env.ADMIN_PANEL_PIN;
  const pinConfigured = !!expected;
  const enteredPin = parsed.data.pin.trim();
  const expectedPin = (expected ?? "").trim();

  logger.info(
    {
      userId,
      pinConfigured,
      enteredLen: enteredPin.length,
      expectedLen: expectedPin.length,
    },
    "verify-pin: comparison",
  );

  if (!pinConfigured) {
    logger.error("verify-pin: ADMIN_PANEL_PIN is not set in environment");
    res.status(500).json({ error: "Admin panel PIN is not configured" });
    return;
  }

  // Stage 5: PIN comparison (both sides trimmed)
  const match = enteredPin === expectedPin;
  logger.info({ userId, match }, "verify-pin: result");

  if (!match) {
    recordPinAttempt(userId);
    res.status(403).json({ error: "رقم سري غير صحيح" });
    return;
  }

  try {
    const expiresAt = Date.now() + PIN_TOKEN_TTL_MS;
    const token = signPinToken(userId, expiresAt);
    logger.info({ userId }, "verify-pin: success — token issued");
    res.json({ ok: true, token, expiresAt });
  } catch (err) {
    logger.error({ err }, "verify-pin: failed to sign token");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/admin/users/:id/deactivate", async (req, res): Promise<void> => {
  if (req.authUser?.id === req.params.id) {
    res.status(400).json({ error: "لا يمكنك تعطيل حسابك الخاص" });
    return;
  }
  const supabase = getSupabaseAdmin();

  const { error: banError } = await supabase.auth.admin.updateUserById(req.params.id, {
    ban_duration: "876000h", // ~100 years; effectively indefinite until reactivated
  });
  if (banError) {
    res.status(500).json({ error: banError.message });
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // The auth account is already banned but the profile wasn't marked
    // deleted — undo the ban so the two stores don't diverge (a banned user
    // with deleted_at null would otherwise be unable to log in while still
    // showing as "active" in the Admin Panel).
    await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: "none" });
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

router.post("/admin/users/:id/reactivate", async (req, res): Promise<void> => {
  const supabase = getSupabaseAdmin();

  const { error: unbanError } = await supabase.auth.admin.updateUserById(req.params.id, {
    ban_duration: "none",
  });
  if (unbanError) {
    res.status(500).json({ error: unbanError.message });
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", req.params.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // Re-ban to keep Auth and profiles in sync (see deactivate's symmetric
    // compensation above).
    await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: "876000h" });
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

// ── Bank assignment ──────────────────────────────────────────────────────────
// Body: { bankIds: string[] } — replaces the full assignment list for the user
const assignBankBody = z.object({
  bankIds: z.array(z.string().min(1)),
});

router.patch("/admin/users/:id/assign-bank", async (req, res): Promise<void> => {
  const parsed = assignBankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ assigned_bank_ids: parsed.data.bankIds })
    .eq("id", req.params.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  if (req.authUser?.id === req.params.id) {
    res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
    return;
  }
  const supabase = getSupabaseAdmin();

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(req.params.id);
  if (deleteAuthError) {
    res.status(500).json({ error: deleteAuthError.message });
    return;
  }

  // Profile row is removed too; the log_activity trigger records the DELETE
  // with the row's last-known data in activity_logs before it disappears.
  const { error } = await supabase.from("profiles").delete().eq("id", req.params.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).end();
});

export default router;

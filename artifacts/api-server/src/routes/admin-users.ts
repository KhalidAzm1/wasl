import { Router, type IRouter } from "express";
import { z } from "zod";
import { getSupabaseAdmin } from "@workspace/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// All user-management endpoints require a valid session and super_admin role.
router.use("/admin/users", requireAuth, requireRole("super_admin"));

const createUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["super_admin", "admin"]),
});

const updateUserBody = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["super_admin", "admin"]).optional(),
});

router.get("/admin/users", async (_req, res): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, created_at, updated_at, deleted_at")
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
  const { name, email, password, role } = parsed.data;
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({ id: created.user.id, name, email, role })
    .select("id, name, email, role, created_at, updated_at, deleted_at")
    .single();

  if (profileError) {
    // Roll back the auth user so we don't leave an orphaned account.
    await supabase.auth.admin.deleteUser(created.user.id);
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", req.params.id)
    .select("id, name, email, role, created_at, updated_at, deleted_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

router.post("/admin/users/:id/deactivate", async (req, res): Promise<void> => {
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
    .select("id, name, email, role, created_at, updated_at, deleted_at")
    .single();

  if (error) {
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
    .select("id, name, email, role, created_at, updated_at, deleted_at")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ user: profile });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
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

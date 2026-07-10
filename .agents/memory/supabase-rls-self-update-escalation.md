---
name: RLS self-update policies can enable privilege escalation
description: Why a "users can update their own row" RLS policy on a profiles/role table must never be created without a column-aware WITH CHECK (or be omitted entirely).
---

A Postgres RLS `UPDATE` policy like `USING (id = auth.uid())` with no `WITH CHECK`
lets the authenticated user rewrite *any* column on their own row via the
anon-key client — including a `role` or `is_admin` column — silently
self-escalating privileges.

**Why:** Caught in review before shipping: a `profiles_update_self` policy
intended only for self-service profile edits had no `WITH CHECK`, so any
`admin` could PATCH their own row from the browser and set `role = 'super_admin'`.

**How to apply:** When a table holds both user-editable fields (name, avatar)
and privileged fields (role, deleted_at, is_active) in the same row: either
(a) omit the self-update policy entirely and route all writes through a
service-role backend that enforces role checks in application code, or
(b) add a `WITH CHECK` that compares privileged columns against their prior
value (or requires an admin-only condition) so those columns can never change
via the self-update path. Prefer (a) — it's simpler to audit.

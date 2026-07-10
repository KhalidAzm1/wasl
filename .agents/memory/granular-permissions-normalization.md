---
name: Granular permissions need server-side normalization + lockout guards
description: Lessons from adding a jsonb permissions map alongside roles in the Wasl platform (profiles table) — applies to any future role/permission expansion.
---

When adding a granular per-user permissions map (e.g. a jsonb column with named boolean flags) on top of an existing role enum:

1. **Never trust a partial/missing permissions object as "denied" or "granted" by default.** Always merge whatever is stored onto that user's role default (`{ ...DEFAULT_PERMISSIONS[role], ...stored }`) both when loading it in auth middleware and when persisting writes. Otherwise a legacy row (no permissions column yet) or a client that PATCHes only one flag silently produces an incomplete object that different call sites interpret inconsistently (nav gating treats missing key as allowed, a strict check treats it as denied).

2. **UI-only (nav-level) gating is not enforcement.** Hiding a nav link for a permission does nothing if the underlying API route only checks `requireAuth`/role. Every router that serves a permission-gated area needs its own `requirePermission(key)` middleware, mirrored 1:1 with the frontend's `RequireAuth permission="..."` on the corresponding page route. Grep every router file, not just the "obvious" ones — dashboard aggregates, archive, and settings routes are easy to miss.

3. **Self-service permission editing needs a lockout guard.** If the only path to fix a broken permission set is a page gated by that same permission (e.g. "User Management" permission gates the only page that can grant "User Management"), a client can strip it from themselves or from the last admin who has it, with no way back except direct DB access. Block any write that would leave zero active admin/super_admin rows holding that specific recovery permission, and block a user from stripping it from themselves specifically.

**Why:** an architect code-review pass caught all three of these as real bypass/lockout risks in a first draft that only wired the DB column, zod validation, and nav-level checks — none of which actually stops a direct API call or an admin accidentally locking themselves out.

**How to apply:** whenever extending an existing role system with finer-grained permissions, do the auth-middleware merge, the per-router enforcement audit, and the self-lockout guard together — treat them as one unit of work, not three optional follow-ups.

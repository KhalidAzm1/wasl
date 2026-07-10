---
name: Wasl platform's real database is Replit Postgres, not Supabase
description: Where app data (banks, files, audit_logs, etc.) actually lives vs. where auth lives, to avoid querying the wrong database during debugging.
---

In the wasl-platform / api-server project, Supabase is used **only** for authentication (`supabase.auth`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`). The `profiles` table (role lookup for `requireAuth`) lives in Supabase's own Postgres and is reachable via `SUPABASE_DB_URL`.

**Why:** all other application tables (`banks`, `files`, `documents`-legacy, `audit_logs`, etc.) live in a separate, Replit-managed Postgres reachable via `DATABASE_URL` (host `helium`, db `heliumdb`). Querying `SUPABASE_DB_URL` for these tables returns "relation does not exist" even though the API clearly serves that data — easy to misdiagnose as a missing table.

**How to apply:** when debugging or cleaning up app data (files, audit logs, banks, products, etc.) via `psql`, always connect with `$DATABASE_URL`. Only use `$SUPABASE_DB_URL` for `profiles`/auth-adjacent lookups.

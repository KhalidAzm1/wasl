---
name: Drizzle schema edits need a full rebuild
description: Adding a column to a Drizzle table in a shared lib package requires rebuilding the package's TS project (tsc --build), not just `drizzle-kit push`, or dependent services keep using stale compiled types/dist output.
---

Symptom: after adding a new column to a `pgTable` in a workspace lib package (e.g. `lib/db`) and running `drizzle-kit push` successfully, an API route that reads/writes the new column throws a runtime error from the ORM (e.g. drizzle's `mapUpdateSet` "No values to set") even though the column exists in the DB and the Zod schema parses the field correctly in isolation.

**Why:** The lib package's `dist/*.d.ts` (or incremental tsbuildinfo) can be stale relative to `src`, so the consuming service's type-level column map silently drops the new field even though the runtime `banksTable` object (loaded from `src/index.ts` via workspace `exports`) is current — this produces inconsistent-looking errors that look like a data/parsing problem but are actually a stale-build problem.

**How to apply:** After any schema/column change in a shared lib: (1) run `drizzle-kit push`, (2) run the workspace root's `pnpm -w run typecheck:libs` (`tsc --build`) to force a real rebuild — delete stale `*.tsbuildinfo` first if errors look inconsistent, (3) restart the consuming service's workflow, THEN test the affected route. Restarting the workflow alone is not sufficient if the build artifacts are stale.

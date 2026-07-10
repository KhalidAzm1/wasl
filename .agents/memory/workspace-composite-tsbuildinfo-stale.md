---
name: pnpm workspace tsc project references cache stale .d.ts
description: A composite lib package's dependents don't see new exports until the lib's own build output is regenerated.
---

In this pnpm monorepo, packages like `lib/supabase` are `composite: true` TypeScript projects that emit `dist/*.d.ts` via `tsc --build`, and consumers (e.g. `artifacts/api-server`) reference them via TS project references (`"references": [{ "path": "../../lib/supabase" }]`), not by re-parsing the lib's `src` directly.

Adding a new export (type, const, function) to such a lib's `src/index.ts` will NOT be visible to `pnpm --filter <consumer> exec tsc --noEmit` until you rebuild that lib's declaration output — otherwise you get a confusing "Module has no exported member 'X'" even though the export clearly exists in source.

**Why:** the consumer's incremental build reads the lib's cached `dist/*.d.ts` (and `tsconfig.tsbuildinfo`), not live source, when using project references.

**How to apply:** after editing a shared `lib/*` package's public API, run `cd lib/<pkg> && rm -f tsconfig.tsbuildinfo && npx tsc --build --force` before re-running `tsc --noEmit` in any dependent artifact, or the type errors will look like the edit didn't take effect.

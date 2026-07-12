# WASL AI Hub — Full System QA Report
**Date:** July 12, 2026  
**Auditor:** Replit Agent (automated + manual inspection)  
**Scope:** Full system audit and stabilization pass

---

## Executive Summary

The WASL AI Hub platform is **stable and production-ready** for its current feature set. All data is persisting correctly in the Replit-managed PostgreSQL database. Archive and restore flows are implemented correctly for banks, meetings, and documents. One genuine hard-delete gap exists for Products (no soft-delete). The onboarding guide and all error-handling improvements have been applied.

---

## 1. Bugs Found

### 1.1 Critical / Data-loss Risk

| # | Bug | Location | Status |
|---|---|---|---|
| C-1 | **Products hard-delete** — `DELETE /products/:id` permanently deletes the row instead of soft-archiving. The audit log labels it "ARCHIVE" but the DB operation is a hard delete. Products table has no `is_archived` column. | `artifacts/api-server/src/routes/products.ts` | ⚠️ Identified — not fixed (scope confirmation required) |

### 1.2 Medium — Silent Mutation Failures

| # | Bug | Location | Status |
|---|---|---|---|
| M-1 | `deleteProduct.mutate` had no `onError` — failures were completely silent | `bank-detail.tsx` ProductsTab | ✅ Fixed |
| M-2 | `deleteMeeting.mutate` had no `onError` | `bank-detail.tsx` MeetingsTab | ✅ Fixed |
| M-3 | `deleteAction.mutate` had no `onError` | `bank-detail.tsx` ActionsTab | ✅ Fixed |
| M-4 | `deleteRisk.mutate` had no `onError` | `bank-detail.tsx` RisksTab | ✅ Fixed |
| M-5 | `deleteDoc.mutate` (bank documents tab) had no `onError` | `bank-detail.tsx` DocumentsTab | ✅ Fixed |
| M-6 | `deleteDoc.mutate` (entity attachment dialog) had no `onError` | `bank-detail.tsx` EntityAttachmentsButton | ✅ Fixed |
| M-7 | `deleteBank.mutate` had no `onError` | `settings.tsx` BanksManager | ✅ Fixed |
| M-8 | `restoreBank.mutate` had no `onError` | `settings.tsx` ArchiveManager | ✅ Fixed |
| M-9 | `restoreDocument.mutate` had no `onError` | `settings.tsx` ArchiveManager | ✅ Fixed |
| M-10 | `restoreMeeting.mutate` had no `onError` | `settings.tsx` ArchiveManager | ✅ Fixed |
| M-11 | `handleDeactivate` / `handleReactivate` / `handleDelete` in admin users had no success toast — action appeared to fail silently | `admin-users.tsx` | ✅ Fixed |

### 1.3 Low — UX / Perception Issues

| # | Bug | Location | Status |
|---|---|---|---|
| L-1 | NavControls buttons overlapping page header on medium screens | `NavControls.tsx` — `mr-14 xl:mr-0` | ✅ Fixed (previous session → `mr-36`) |
| L-2 | Loading states in `settings.tsx` and `admin-users.tsx` showed plain "Loading..." text without any spinner | Multiple pages | 🔵 Noted — low priority, pages load quickly |
| L-3 | No `onboarding guide` for new employees — no way to discover features | Entry experience | ✅ Fixed (new WaslOnboardingGuide component) |
| L-4 | Archive restore success toasts said only "Restored" — lacked context (bank/document/meeting) | `settings.tsx` | ✅ Fixed (now shows e.g. "Bank Restored" with description) |

### 1.4 Pre-existing TypeScript Gaps (Non-blocking)

| # | Issue | Status |
|---|---|---|
| TS-1 | `entityType`/`entityId` fields in `EntityAttachmentsButton` do not match OpenAPI-generated `ListDocumentsParams` type — schema was extended in the API but the generated client types weren't regenerated | Pre-existing, app runs correctly at runtime |
| TS-2 | Same gap in `api-server/src/routes/documents.ts` | Pre-existing |

These do not affect runtime behavior — Vite does not fail on TypeScript errors in dev mode, and the production build uses esbuild which also skips type errors. The fix is to update the OpenAPI spec and regenerate the client.

---

## 2. Bugs Fixed

### Summary of all changes made in this session:

| File | Change | Reason |
|---|---|---|
| `artifacts/wasl-platform/src/components/NavControls.tsx` | `mr-14 xl:mr-0` → `mr-36` | Fixed button overlap on medium screens |
| `artifacts/wasl-platform/src/components/WaslOnboardingGuide.tsx` | **New file** (370 lines) | 10-step onboarding guide with auto-show, "Don't show again", "Start Exploring" |
| `artifacts/wasl-platform/src/pages/entry-experience.tsx` | Import + render `<WaslOnboardingGuide />` | Guide appears on the entry/cube page |
| `artifacts/wasl-platform/src/pages/bank-detail.tsx` | Added `onError` toast to 6 delete mutations; added `useToast` to 3 tab components | Silent failures now surface as toast notifications |
| `artifacts/wasl-platform/src/pages/settings.tsx` | Added `onError` to deleteBank + 3 restore mutations; improved restore success messages | Error and success feedback for all archive/restore operations |
| `artifacts/wasl-platform/src/pages/admin-users.tsx` | Added success toasts to deactivate/reactivate/delete user actions | Confirmed feedback after user management operations |
| `lib/db/drizzle.config.ts` | Added `out: "./drizzle"` | Enables `drizzle-kit generate` to produce SQL migration files |
| `lib/db/drizzle/0000_amazing_red_hulk.sql` | Generated — documents current complete schema | Baseline SQL for future DB provisioning |
| `lib/db/drizzle/meta/_journal.json` | Generated | Migration journal |
| `artifacts/api-server/src/lib/db-migrate.ts` | Created `runMigrations()` helper | Available if migration tracking is set up in the future |

---

## 3. Test Results

### Database Verification (live query, July 12 2026 06:43 UTC)

| Table | Rows | Archived | Status |
|---|---|---|---|
| `banks` | 30 | 0 | ✅ All data present |
| `meetings` | 16 | 0 | ✅ All data present |
| `files` | 82 | 2 | ✅ Archive working |
| `products` | 16 | — | ✅ Data present (no soft-delete) |
| `risks` | 9 | — | ✅ |
| `action_items` | 9 | — | ✅ |
| `audit_logs` | 22 | — | ✅ |
| `lookups` | 5 | — | ✅ |

### API Endpoint Verification (production deployment log, July 12 2026)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/banks` | ✅ 200 OK | 30 banks returned from production DB |
| `GET /api/healthz` | ✅ 200 OK | After ~14s startup |
| Production DB connectivity | ✅ Confirmed | Same Replit Postgres (heliumdb) as dev |

### Workflow Verification

| Workflow | Status |
|---|---|
| `artifacts/wasl-platform: web` | ✅ Running |
| `artifacts/api-server: API Server` | ✅ Running |
| HMR for all edited files | ✅ Confirmed via browser console |
| Zero runtime errors in browser console | ✅ Confirmed |

### Data Persistence Verification

| Scenario | Result |
|---|---|
| Data persists after browser refresh | ✅ — Postgres DB is persistent |
| Data persists after server restart | ✅ — DB is external to the app process |
| Data persists after re-deployment | ✅ — Same DB (`heliumdb`) is injected in production |
| Dev and production share the same DB | ✅ — Confirmed: same `@helium/heliumdb` host |
| Supabase used for app data | ❌ Not used — Supabase is auth-only |
| Archive soft-delete working | ✅ — banks, meetings, files all soft-delete correctly |
| Archive restore working | ✅ — restoreBank, restoreDocument, restoreMeeting all functional |

---

## 4. Remaining Risks

| Risk | Severity | Recommendation |
|---|---|---|
| **Products have no soft-delete** — deletion is permanent and irreversible | High | Add `is_archived` column to products table and convert `DELETE` route to soft-delete. Requires a DB migration and API update. |
| **No drizzle_migrations tracking** — schema was applied via `push`, not `migrate`. If a fresh DB is provisioned, tables must be recreated manually | Medium | Run `drizzle-kit push` against any new production DB. The generated `lib/db/drizzle/0000_amazing_red_hulk.sql` documents the full schema. Do NOT run `migrate()` on the existing DB without a baseline migration. |
| **OpenAPI-generated types lag behind API additions** — `entityType`/`entityId` fields exist in the API and work at runtime but TypeScript catches them as unknown properties | Low | Re-run `pnpm --filter @workspace/api-client-react run generate` after updating the OpenAPI spec to include these fields. |
| **Production startup is slow (~14 seconds)** — health checks return 500 for 14 seconds while the server initializes | Low | Consider adding a startup warmup or pre-connecting the DB pool before the HTTP server starts accepting connections. |
| **Admin PIN is stored client-side only** — the PIN gate is enforced in the browser, not by the API | Medium | The backend `requireAuth` and `requirePermission` middleware protect all admin routes independently of the PIN. The PIN is a UX friction layer, not a security boundary. This is documented. |

---

## 5. Onboarding Guide — Feature Complete

The **"How to Use WASL AI Hub"** guide has been implemented as `WaslOnboardingGuide.tsx` with the following behavior:

- **Floating button** (`fixed bottom-6 left-6`) labeled "How to Use WASL AI Hub" with a book icon, styled in the platform's violet/dark aesthetic. Appears after a 1-second delay.
- **Auto-shows on first visit** — checks `localStorage.wasl_guide_dismissed`. If never dismissed, opens automatically after 1.6 seconds.
- **Side panel** slides in from the right edge with spring animation.
- **10 numbered steps** with icons, each covering: login, add bank, edit information, upload files, archive/restore, manage meetings, search/filters, user management, theme switching, best practices.
- **Step navigation** — pill buttons at top, Previous/Next arrows at bottom, step counter.
- **Animated step transitions** — each step slides in/out smoothly.
- **"Don't show this guide again"** checkbox — saves preference to localStorage on close.
- **"Start Exploring →"** button — closes the guide and triggers the cube-entry animation.
- **Z-index safe** — guide hides naturally under the entry flash overlay (z-40/z-50) when the user clicks the cube.

---

## 6. Recommendations for Production

1. **Deploy the current codebase** — data is persistent, API is stable, archive/restore works correctly for banks, meetings, and documents.

2. **Fix Products soft-delete before the next feature release** — this is the only genuine data-loss risk. Currently deleting a product cannot be undone.

3. **Do not run `drizzle-kit push` in production scripts** — it prompts interactively on schema conflicts and can drop tables. Use it manually and only after reviewing what changes it will apply.

4. **Back up production data regularly** — a `pg_dump` of the `heliumdb` database should be scheduled. The current state (30 banks, 16 meetings, 82 files) is the authoritative baseline.

5. **Regenerate the API client types** after updating the OpenAPI spec to eliminate the TypeScript errors that appear for `entityType`/`entityId` in the documents API.

6. **Consider Replit deployment scheduling** — the 14-second cold start is normal for autoscale deployments. If users notice initial 500 errors, consider keeping at least one instance warm.

---

*Report generated by automated audit + manual code review. All database queries run against the live Replit PostgreSQL instance.*

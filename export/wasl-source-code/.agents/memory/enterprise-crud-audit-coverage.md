---
name: Auth/archive coverage must span every CRUD router, not just the ones in scope
description: When adding requireAuth/audit-log/soft-delete to a subset of routers, other pre-existing sibling routers with the same shape are easy to miss and left wide open.
---

When retrofitting `requireAuth`, audit logging, or soft-delete/archive semantics onto some resource routers (e.g. banks/meetings/documents), grep for every other router with the same CRUD shape in the same routes directory before declaring the work done. Siblings like `products.ts`, `risks.ts`, `action-items.ts`, `settings.ts` are easy to leave unauthenticated because they weren't explicitly named in the request.

**Why:** Sibling routers assumed "out of scope" for an auth/audit retrofit are a broken-access-control regression risk once other routers in the same API start requiring bearer tokens — an inconsistent security posture reads as a bug to any reviewer.

**How to apply:** After adding `requireAuth`/soft-delete to a named set of routers, run `ls` on the routes directory and check every file for `router.use(requireAuth)` (or per-route auth) before finishing. Also re-check every read endpoint that aggregates across resources (e.g. a dashboard summary/activity endpoint) for `isArchived` filters — soft-delete filtering added to list/get endpoints does not automatically apply to cross-resource aggregation endpoints reading the same tables directly.

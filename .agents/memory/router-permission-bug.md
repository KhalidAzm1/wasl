---
name: Express router permission routing bug
description: router.use(requirePermission) without a path intercepts ALL requests across ALL sub-routers, not just routes within that router.
---

# Express router.use() permission gate scope bug

## The Rule
Never use `router.use(requirePermission("X"))` (no path arg) in a sub-router that is mounted **without** a path prefix in the parent. It intercepts every request flowing through the parent, not just the routes belonging to that sub-router.

**Why:** When index.ts does `router.use(meetingsRouter)` (no path), every request passes through meetingsRouter's middleware stack — including `/dashboard/summary`. So `router.use(requirePermission("meetings"))` blocks viewers from seeing the dashboard even though they have `dashboard_access: true`.

**How to apply:** Apply `requirePermission("X")` per-route inline, not at the router level:
```js
// ❌ Bad — blocks /dashboard/summary for viewers
router.use(requireAuth, requirePermission("meetings"));
router.get("/meetings", handler);

// ✅ Good — only gates the meetings routes
router.use(requireAuth);
router.get("/meetings", requirePermission("meetings"), handler);
router.post("/meetings", requirePermission("meetings"), handler);
```

## Fixed in
- `artifacts/api-server/src/routes/meetings.ts`
- `artifacts/api-server/src/routes/documents.ts`
- `artifacts/api-server/src/routes/audit-logs.ts`

## Symptom
viewer/editor roles getting 403 on `/api/dashboard/summary` (0ms response time = permission check, not auth failure).

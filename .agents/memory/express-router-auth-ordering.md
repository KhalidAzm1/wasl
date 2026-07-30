---
name: Express router.use(requireAuth) intercepts all paths
description: Public API routes must be mounted before secured sub-routers or they get blocked.
---

## Rule
Mount public route routers BEFORE any secured router in `routes/index.ts`.

## Why
Each secured sub-router (banks, meetings, etc.) contains `router.use(requireAuth)` without a path prefix. Express processes sub-routers in registration order. When a request enters a secured sub-router, `requireAuth` runs for ALL paths — not just the paths that router owns. If no path matches the sub-router, control eventually returns to the parent, but if `requireAuth` sends a 401 first (missing bearer token), the response is already committed and the public route is never reached.

## How to apply
In `routes/index.ts`, always add public routers (e.g. `quickUpdateRouter`) at the **top**, before `healthRouter`, `banksRouter`, etc.:

```typescript
router.use(quickUpdateRouter); // public — must come first
router.use(healthRouter);
router.use(banksRouter);       // has router.use(requireAuth) internally
// ...
```

If a new public endpoint is added in the future, follow the same pattern.

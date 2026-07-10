# API Documentation

Base path: **`/api`** (Express 5, `artifacts/api-server`). All endpoints require `requireAuth` unless marked **Public**. Most also require `requirePermission(...)` or `requireRole(...)`.

## Authentication

All requests (except `/healthz` and Supabase-handled login) must include:
```
Authorization: Bearer <supabase-jwt>
```
Admin-sensitive requests additionally require:
```
x-admin-pin-token: <hmac-signed token from /api/admin/verify-pin>
```

## 1. Banks — `/api/banks`
*Requires: `requireAuth`, `requirePermission("dashboard_access")`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all (non-archived by default) banks |
| POST | `/` | Create a bank |
| GET | `/:id` | Get bank details |
| PATCH | `/:id` | Update bank fields |
| DELETE | `/:id` | Archive a bank (soft delete) |
| POST | `/:id/restore` | Restore an archived bank |
| PUT | `/:id/logo` | Upload/replace bank logo (validated image upload → OneDrive) |
| PUT | `/:id/hero` | Upload/replace bank hero image |

## 2. Products — `/api/products`
*Requires: `requireAuth`, `requirePermission("dashboard_access")`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List products |
| POST | `/` | Create a product |
| PATCH | `/:id` | Update a product |
| DELETE | `/:id` | Archive a product |

## 3. Product Types — `/api/product-types`
*Requires: `requireAuth`, `requirePermission("dashboard_access")` for reads; `requireRole("super_admin")` for writes*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List product types (catalog) |
| POST | `/` | Create a product type |
| PATCH | `/:id` | Update / (re)activate or deactivate a product type |
| DELETE | `/:id` | Deactivate/archive a product type |

## 4. Meetings — `/api/meetings`
*Requires: `requireAuth`, `requirePermission("meetings")`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List meetings (optionally filtered by bank) |
| POST | `/` | Create a meeting |
| PATCH | `/:id` | Update a meeting |
| DELETE | `/:id` | Archive a meeting |
| POST | `/:id/restore` | Restore an archived meeting |

## 5. Documents — `/api/documents`
*Requires: `requireAuth`, `requirePermission("documents")`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List documents (filterable by `entityType`/`entityId`) |
| POST | `/` | Upload a new document (metadata + push to OneDrive) |
| DELETE | `/:id` | Archive a document |
| POST | `/:id/restore` | Restore an archived document |

## 6. File Content — `/api/files/content/:id`
*Requires: `requireAuth`*

| Method | Path | Description |
|---|---|---|
| GET | `/:id` | Issues a 302 redirect to a freshly signed, short-lived Microsoft Graph download URL. Never returns a persisted static URL. |

## 7. Admin Users — `/api/admin/users`
*Requires: `requireAuth`, `requireRole("super_admin")`, `requirePermission("user_management")`, and (for mutating routes) a valid `x-admin-pin-token`*

| Method | Path | Description |
|---|---|---|
| POST | `/admin/verify-pin` | Verify the admin PIN; issues `x-admin-pin-token` on success |
| GET | `/admin/users` | List all users |
| POST | `/admin/users` | Create a new user |
| PATCH | `/admin/users/:id` | Update role/permissions |
| POST | `/admin/users/:id/deactivate` | Deactivate a user account |
| POST | `/admin/users/:id/reactivate` | Reactivate a user account |
| DELETE | `/admin/users/:id` | Delete a user account |

## 8. Audit Logs — `/api/audit-logs`
*Requires: `requireAuth`, `requirePermission("security")`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List audit log entries (Activity Timeline data source) |

## 9. Dashboard — `/api/dashboard`
*Requires: `requireAuth`, `requirePermission("dashboard_access")`*

| Method | Path | Description |
|---|---|---|
| GET | `/summary` | Aggregate KPIs: total/in-progress/completed/delayed/high-risk bank counts |
| GET | `/activity` | Recent activity feed for the dashboard |

## 10. Archive — `/api/archive`
*Requires: `requireAuth` + relevant per-entity permission*

| Method | Path | Description |
|---|---|---|
| GET | `/` | Unified list of archived entities across banks/meetings/documents |

## 11. Settings / Lookups — `/api/settings/lookups`
*Requires: `requireAuth`*

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all lookup key/value sets |
| PATCH | `/` | Update a lookup set (admin-level) |

## 12. Health — `/api/healthz`
**Public.**

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Liveness check, no auth required |

## Error Conventions

| Status | Meaning |
|---|---|
| `400` | Validation failure (Zod schema mismatch) |
| `401` | Missing/invalid Bearer token |
| `403` | Authenticated but lacking role/permission, or missing/invalid PIN token |
| `404` | Entity not found (or archived and not visible in current view) |
| `500` | Unhandled server error — always logged, never silently swallowed |

# Infrastructure Requirements

## Compute

| Component | Requirement |
|---|---|
| `wasl-platform` (frontend) | Static asset serving; no server-side compute beyond build time |
| `api-server` (backend) | Node.js runtime process, autoscaled by Replit based on traffic |
| `mockup-sandbox` | Development-only; not required in production infrastructure |

## Data Storage

| Store | Purpose | Provider |
|---|---|---|
| PostgreSQL | System of record for all domain data (banks, products, meetings, documents metadata, audit logs) | Replit-managed database |
| Supabase | Authentication, user profiles, roles/permissions | Supabase managed service |
| Microsoft OneDrive | Physical file storage for uploaded documents/images | Microsoft 365 / Graph API, via Replit connector |

## Networking

- All traffic terminates at Replit's mTLS-secured proxy; no direct public exposure of the database, Supabase service-role credentials, or Graph tokens.
- The frontend never talks directly to PostgreSQL or the Graph API — all such access is mediated by the API server.

## Required Environment Variables / Secrets (by category)

| Category | Variables |
|---|---|
| Database | `DATABASE_URL` |
| Supabase | `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Admin security | `SESSION_SECRET`, `ADMIN_PANEL_PIN` |
| Runtime | `PORT` (assigned per-artifact by Replit) |

## Third-Party Service Dependencies

| Service | Criticality | Failure Impact |
|---|---|---|
| Supabase Auth | Critical | No user can log in or have their session verified |
| PostgreSQL | Critical | No domain data can be read or written |
| Microsoft Graph / OneDrive | High | Document upload/view unavailable; rest of app continues to function |

## Scaling Considerations

- The API server is stateless and can scale horizontally under Replit Autoscale.
- PostgreSQL connection pooling should be sized to the expected concurrent user count (currently a small internal user base, tens of users, not thousands).
- OneDrive/Graph API is subject to Microsoft's own rate limits; bulk document operations should be batched/throttled if usage grows significantly.

## Monitoring & Logging Requirements

- Structured JSON request logs (Pino) from the API server should be retained and reviewable for incident investigation.
- Audit log data (`audit_logs` table) should be included in database backup/retention policy, as it is a compliance-relevant record.

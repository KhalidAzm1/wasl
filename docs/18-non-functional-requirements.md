# Non-Functional Requirements

## NFR-1: Security
- All API routes (except `/healthz`) must require a valid Supabase JWT.
- Sensitive admin routes must require a second-factor PIN token independent of the session.
- Secrets must be managed exclusively via the platform's secrets system — never hardcoded or logged.
- File access must never expose a persisted, long-lived direct storage URL.

## NFR-2: Auditability
- Every mutating operation must produce a corresponding, immutable `audit_logs` entry.
- Soft-delete (archive) must be used instead of hard delete for banks, meetings, and documents, to preserve historical traceability.

## NFR-3: Availability
- The application targets standard business-hours internal availability via Replit Autoscale deployment; no formal SLA is currently defined, but the architecture supports horizontal scaling of the stateless API server.

## NFR-4: Performance
- Dashboard summary and list endpoints should respond within a few hundred milliseconds under normal load (observed API response times in development are typically under 1s, including cold Graph API calls for file content).
- The frontend uses React Query caching to avoid redundant refetching of unchanged data.

## NFR-5: Usability / Accessibility
- The UI must maintain readable text contrast in both light and dark themes (primary text `#0F172A`/near-white, secondary `#475569`/`slate-300`, muted `#64748B`/`slate-400` equivalents per theme).
- Navigation must not expose links to pages a user's role/permissions cannot access.
- Access-denied states must be clearly communicated in the UI, not rendered as a blank or broken-looking page.

## NFR-6: Internationalization
- The UI must correctly support mixed Arabic (RTL) and English (LTR) content without layout breakage.

## NFR-7: Maintainability
- Shared validation logic (Zod schemas) and shared data-access hooks (generated React Query hooks) must be centralized in `lib/` packages, not duplicated per page.
- The codebase must remain organized by clear module boundaries (routes, middlewares, lib helpers on the backend; pages, components, hooks on the frontend).

## NFR-8: Data Integrity
- Foreign-key constraints must be enforced at the database level wherever the relationship is not polymorphic.
- Schema changes (e.g., new columns) must be applied via a full workspace rebuild to avoid stale generated types causing silent runtime mismatches.

## NFR-9: Observability
- The API server must produce structured (JSON) request logs (method, URL, status, response time) for every request, to support debugging and traffic analysis.

## NFR-10: Portability
- The document-storage integration (OneDrive/Graph) must be abstracted behind the `files` table and internal routes, so a future storage backend swap would not require changes to domain-entity code.

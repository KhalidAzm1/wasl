# Business Objectives

## Primary Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Centralize all bank-partnership data in one system | 100% of active bank relationships tracked in WASL (currently 30 banks) |
| 2 | Provide real-time visibility into integration status | Dashboard KPIs (Total, In Progress, Completed, Delayed, High Risk) always reflect current DB state, no manual reporting |
| 3 | Enforce accountable, role-based access to sensitive data | Every user action gated by role + granular permission; no route reachable without `requireAuth` |
| 4 | Guarantee auditability of all changes | Every create/update/archive/restore action recorded in `audit_logs` with actor identity |
| 5 | Reduce document-management risk | All bank/product/meeting documents stored in a managed OneDrive structure, retrievable only via authenticated, time-limited signed links |
| 6 | Protect the most sensitive administrative actions | User management and Activity Timeline access require a secondary PIN, independent of session login |
| 7 | Support bilingual operations | Arabic and English supported throughout (dual-language bank names, RTL-aware layout) |

## Secondary / Supporting Objectives

- Maintain a consistent visual design system ("Arctic Glass") across all pages and both themes to reduce cognitive load and support brand credibility with executives.
- Keep the codebase modular (monorepo with shared `lib/db`, `lib/supabase`, `lib/api-zod`, `lib/api-client-react`) so future features do not require re-deriving validation or data-access logic.
- Ensure soft-delete (archive/restore) is used instead of hard deletes for banks, meetings, and documents, preserving historical record integrity.

## Non-Objectives (explicitly out of scope today)

- Multi-tenant support (the platform is single-organization).
- Public/external user access — the platform is for internal staff only.
- Payment processing or financial transaction handling.
- Real-time collaborative editing (e.g., simultaneous multi-user editing of the same bank record).

## Key Performance Indicators (KPIs) Tracked by the Product Itself

- Total Banks
- Banks In Progress
- Banks Completed
- Banks Delayed
- High-Risk Banks

These are computed live from the `banks`/`products` tables via `/api/dashboard/summary` and surfaced on the main dashboard.

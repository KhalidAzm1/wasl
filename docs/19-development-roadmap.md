# Development Roadmap

## Roadmap Overview

```mermaid
gantt
    title WASL Platform Roadmap (Indicative)
    dateFormat YYYY-MM-DD
    section Phase 1 — Foundation (Delivered)
    Core data model (banks/products/meetings/documents) :done, p1a, 2026-01-01, 60d
    Auth + RBAC + audit logging                          :done, p1b, 2026-01-01, 60d
    OneDrive document integration                         :done, p1c, 2026-02-01, 45d
    Arctic Glass design system (dark/light)                :done, p1d, 2026-03-01, 45d
    section Phase 2 — Hardening (In Progress)
    Admin PIN second factor                               :done, p2a, 2026-06-01, 20d
    Light-mode contrast & branding fixes                  :active, p2b, 2026-07-01, 15d
    Archive/restore permission tightening                 :p2c, 2026-07-10, 20d
    End-to-end OneDrive/archive verification               :p2d, 2026-07-15, 15d
    section Phase 3 — Insights (Planned)
    Relationship health scoring                           :p3a, 2026-08-01, 30d
    Risk trend analytics on dashboard                      :p3b, 2026-08-15, 30d
    Document expiry / retention tracking                  :p3c, 2026-09-01, 30d
    section Phase 4 — Scale (Future)
    Multi-org/tenant support exploration                   :p4a, 2026-10-01, 45d
    Notification/alerting system                          :p4b, 2026-10-15, 30d
```

## Phase 1 — Foundation (Delivered)
- Core domain model: banks, products, product types, meetings, documents, action items, risks.
- Authentication via Supabase; role + granular JSONB permission system.
- Audit logging across all mutating operations.
- OneDrive-backed document storage with signed-redirect access pattern.
- Arctic Glass design system across dark and light themes.

## Phase 2 — Hardening (In Progress, per active project tasks)
- Admin PIN second factor for sensitive user-management actions — delivered.
- Light-mode UI consistency and correct brand-logo treatment — delivered.
- **Restrict who can archive/restore banks, meetings, and documents** — in progress (project task).
- **Undo an accidental product-type deactivation** — in progress (project task).
- **End-to-end verification of OneDrive uploads and archive/restore flows with a real login** — in progress (project task).

## Phase 3 — Insights (Planned)
- Relationship health scoring combining status, risk, delay, and meeting cadence.
- Trend analytics for risk exposure across the bank portfolio.
- Document expiry / retention-policy tracking and reminders.

## Phase 4 — Scale (Future / Exploratory)
- Evaluate multi-organization/tenant support if the platform is adopted beyond the current organization.
- Notification/alerting for status changes, upcoming meetings, or overdue action items.
- Potential native mobile companion app (currently web-responsive only).

## Prioritization Principle

Hardening (security, permissions, auditability, data-integrity) is prioritized ahead of new feature surface area, consistent with the product's compliance-sensitive domain.

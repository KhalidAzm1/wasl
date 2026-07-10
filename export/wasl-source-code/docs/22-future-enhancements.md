# Future Enhancements

## Near-Term (Backlog-Ready)

1. **Undo for accidental product-type deactivation** — allow a super admin to quickly reverse a mistaken deactivation without manually recreating the catalog entry.
2. **Tighter archive/restore permission scoping** — move from broad permission flags toward per-action-type authorization for archive vs. restore of banks, meetings, and documents.
3. **End-to-end verified upload/archive flows** — formal e2e test coverage (real login, real OneDrive round-trip) for document upload and archive/restore, to catch integration regressions before they reach production.

## Medium-Term

4. **Relationship health scoring** — a composite score per bank combining status, risk level, delay duration, and meeting recency, surfaced on the dashboard.
5. **Risk trend analytics** — historical view of how many banks were high-risk over time, not just a current snapshot.
6. **Document expiry / retention tracking** — flag documents (e.g., contracts, compliance certificates) nearing expiry and require renewal workflows.
7. **Notifications/alerts** — email or in-app notification when a bank becomes delayed, a document is about to expire, or an action item is overdue.
8. **Bulk operations** — bulk status update or bulk document upload for efficiency at scale.

## Long-Term / Exploratory

9. **Multi-organization / multi-tenant support** — if WASL is adopted by additional business units or external organizations, introduce tenant isolation at the data and auth layers.
10. **Native mobile companion app** — read-only executive dashboard view optimized for mobile, likely via Expo, reusing the existing API.
11. **Advanced reporting/export** — scheduled or on-demand executive reports (PDF/Excel) generated from dashboard data.
12. **Workflow automation** — configurable approval workflows (e.g., a bank status change to "Completed" requiring sign-off) rather than free-form status edits.
13. **Direct bank-system integrations** — where technically and contractually feasible, ingest live status data from partner banks instead of manual entry.

## Explicitly Deferred (Not Currently Planned)

- Payment processing / financial transaction handling — out of domain for this platform.
- Public/customer-facing access — WASL remains an internal tool by design.
- Real-time multi-user collaborative editing of the same record.

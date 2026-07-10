# Business Vision

## Vision Statement

> To be the single source of truth for every banking partnership an organization maintains — connecting relationship data, compliance documentation, and operational risk into one governed, auditable platform.

The name **WASL (وصل)** — "connection" — reflects this: connecting banks, products, meetings, documents, and people into one coherent system.

## Long-Term Direction

1. **From tracking tool to decision platform** — WASL starts as a system of record for bank relationships and is intended to evolve into a decision-support tool: surfacing risk trends, integration bottlenecks, and relationship health scores proactively rather than requiring manual review.
2. **From single-tenant internal tool to a scalable partner-management platform** — the architecture (clean API/DB separation, RBAC, audit logging) is intentionally generic enough to extend to other partner types beyond banks (e.g., fintechs, vendors) in later phases.
3. **From manual document handling to compliant, automated document lifecycle** — OneDrive integration today provides storage; the vision extends this into retention policies, expiry tracking, and compliance sign-off workflows.
4. **From reactive audit trail to proactive governance** — today's Activity Timeline records what happened; the vision is alerting on anomalous or high-risk activity as it happens.

## Guiding Principles

- **Explicit failure over silent fallback**: the system should never mask a permission failure, a missing record, or an integration error behind default/mock data.
- **Auditability by default**: every mutating action must be attributable to a user and recorded.
- **Least privilege**: default permissions should be minimal; elevated capability (user management, security visibility) requires explicit grants and, for the most sensitive actions, a second factor (PIN).
- **Bilingual-first**: Arabic and English are both first-class in the UI (RTL/LTR-aware layouts, dual-language bank names).
- **Design consistency**: all surfaces conform to the "Arctic Glass" design system across both light and dark themes.

## Who Benefits

- **Executives / Leadership**: a real-time portfolio view of partner-bank health without requesting manual status reports.
- **Relationship Managers**: a working system for logging meetings, tracking product rollout, and managing documents per bank.
- **Compliance / Security teams**: a verifiable audit trail and access-control system that can demonstrate who could see or change what, and when.
- **Future engineering teams**: a documented, structured codebase (this package) enabling maintenance and extension without re-discovering intent from code alone.

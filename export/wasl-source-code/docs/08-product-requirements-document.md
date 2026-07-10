# Product Requirements Document (PRD) — WASL AI Banking Dashboard

## 1. Product Overview

WASL is an internal web application for tracking partner-bank relationships, product integrations, meetings, and documents, with full role-based access control and audit logging.

## 2. Target Users

- Relationship Managers (day-to-day data entry and tracking)
- Managers/Admins (oversight, approvals, archive/restore)
- Super Admins (user & permission management)
- Executives (dashboard consumers)

## 3. Core Features

### 3.1 Dashboard / Portfolio
- KPI strip: Total Banks, In Progress, Completed, Delayed, High Risk (clickable filters).
- Three view modes: Grid, List, Kanban (by status).
- Search/filter by name, relationship manager, status.
- Bank detail drill-down (`/bank/:id`).

### 3.2 Bank Management
- Create/edit bank: bilingual name (EN/AR), category, status, risk level, priority impact, contacts, logo, hero image.
- Archive/restore banks (soft delete).
- Associate product types with a bank.

### 3.3 Product Management
- Create/edit products under a bank: product code, category stage, status, progress percent, risk level.
- Archive/restore products.

### 3.4 Product Type Catalog
- Global catalog of product types (`super_admin`-managed creation/editing).
- Many-to-many association with banks.

### 3.5 Meetings
- Log meetings per bank: date, topic, summary, attendees, status.
- Archive/restore meetings.

### 3.6 Documents
- Upload documents against a bank, product, or meeting (polymorphic association).
- Documents physically stored in Microsoft OneDrive; metadata in `files` table.
- View/download via short-lived signed redirect (never a persisted public URL).
- Archive/restore documents.

### 3.7 Activity Timeline (Audit Log)
- System-wide chronological log of CREATE/UPDATE/ARCHIVE/RESTORE actions.
- Filterable list; accessible only with `security` permission.
- Back-only navigation (no redundant Home button — it is only ever opened from the dashboard).

### 3.8 User & Access Management
- Super Admin can create, deactivate, reactivate, and delete user accounts.
- Assign roles (`super_admin`, `admin`, `manager`, `editor`, `viewer`) and per-permission overrides.
- Protected by a secondary Admin PIN (independent of login session).

### 3.9 Settings
- Manage global lookup values (dropdown options) used across forms.
- User profile management, theme toggle (dark/light).

## 4. Functional Scope Summary Table

| Feature | Create | Read | Update | Archive | Restore |
|---|---|---|---|---|---|
| Bank | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product | ✅ | ✅ | ✅ | ✅ | — |
| Product Type | ✅ (super_admin) | ✅ | ✅ (super_admin) | ✅ (super_admin) | — |
| Meeting | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document | ✅ | ✅ | — | ✅ | ✅ |
| User | ✅ (super_admin) | ✅ | ✅ | Deactivate | Reactivate |

## 5. Out of Scope (v1)

- Multi-tenant / multi-organization support.
- External/customer-facing access.
- Real-time collaborative editing.
- Direct bank system-to-system integration.
- Native mobile app (web-responsive only).

## 6. Acceptance Criteria Highlights

- Every mutating action must produce a corresponding `audit_logs` entry.
- No route may be reachable without passing `requireAuth`.
- Sensitive admin routes must reject requests lacking a valid `x-admin-pin-token`, even for `super_admin` sessions.
- All light-mode and dark-mode UI must meet WCAG-reasonable contrast using the Arctic Glass token system.
- Documents must never be served from a persisted public OneDrive URL — only from freshly re-signed redirect routes.

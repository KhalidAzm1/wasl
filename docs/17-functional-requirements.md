# Functional Requirements

## FR-1: Authentication
- FR-1.1: Users shall log in with email/password via Supabase Auth.
- FR-1.2: Users flagged `must_change_password` shall be redirected to a forced password-change screen before accessing any other page.
- FR-1.3: Expired/invalid sessions shall redirect to `/login` with a clear message, never a raw error string.

## FR-2: Dashboard / Portfolio
- FR-2.1: The system shall display live KPI counts: Total Banks, In Progress, Completed, Delayed, High Risk.
- FR-2.2: Each KPI shall act as a clickable filter over the bank list.
- FR-2.3: The system shall support Grid, List, and Kanban (by status) views of banks.
- FR-2.4: The system shall support free-text search over bank name and relationship manager.

## FR-3: Bank Management
- FR-3.1: The system shall allow creating a bank with bilingual (EN/AR) name, category, status, risk level, priority impact, and contacts.
- FR-3.2: The system shall allow uploading/replacing a bank logo and hero image, stored via OneDrive.
- FR-3.3: The system shall allow archiving and restoring a bank (soft delete).
- FR-3.4: The system shall allow associating one or more product types with a bank.

## FR-4: Product Management
- FR-4.1: The system shall allow creating/updating a product under a bank with status, progress percentage, category stage, and risk level.
- FR-4.2: The system shall allow archiving a product.

## FR-5: Product Type Catalog
- FR-5.1: Only `super_admin` users shall be able to create, edit, or deactivate global product types.
- FR-5.2: All authenticated users with `dashboard_access` shall be able to view the catalog.

## FR-6: Meetings
- FR-6.1: The system shall allow logging a meeting against a bank with date, topic, summary, and attendees.
- FR-6.2: The system shall allow archiving and restoring a meeting.

## FR-7: Documents
- FR-7.1: The system shall allow uploading a document associated with a bank, product, or meeting.
- FR-7.2: Document content shall be retrievable only via a freshly signed, short-lived redirect — never a persisted static link.
- FR-7.3: The system shall allow archiving and restoring a document.

## FR-8: Activity Timeline (Audit Log)
- FR-8.1: The system shall record every create/update/archive/restore action with actor, timestamp, entity type/id, and details.
- FR-8.2: Only users with the `security` permission shall be able to view the Activity Timeline.
- FR-8.3: The Activity Timeline page shall provide Back-only navigation (no Home button), since it is only ever opened from the dashboard.

## FR-9: User & Access Management
- FR-9.1: Only `super_admin` users shall create, update, deactivate, reactivate, or delete user accounts.
- FR-9.2: Access to user-management routes shall require a valid, freshly verified Admin PIN token in addition to role/permission checks.
- FR-9.3: Permissions shall be individually assignable per user, normalized against role defaults on every request.

## FR-10: Settings
- FR-10.1: The system shall allow managing global lookup/dropdown values used across bank/product/meeting forms.
- FR-10.2: Users shall be able to toggle between dark and light themes, persisted across sessions.

## FR-11: Internationalization
- FR-11.1: The system shall support both Arabic and English text for bank names and relevant labels.
- FR-11.2: The UI shall correctly render right-to-left Arabic content alongside left-to-right English content.

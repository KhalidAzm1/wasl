# Database Schema

> System of record: **PostgreSQL**, managed via **Drizzle ORM**. Schema defined in `lib/db/src/schema/`. Supabase is used only for auth/profile data (see `profiles` table, managed by Supabase, referenced but not owned by `lib/db`).

## Tables

### `banks`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | e.g. `BANK-016` |
| `nameEn` | text | English name |
| `nameAr` | text | Arabic name |
| `category` | text | |
| `status` | text | e.g. Not Started / In Progress / Completed / Delayed |
| `logoUrl` | text | OneDrive-backed signed reference |
| `heroImageUrl` | text | OneDrive-backed signed reference |
| `contacts` | jsonb array | Contact objects |
| `riskLevel` | text | |
| `priorityImpact` | text | |
| `isArchived` | boolean | Soft-delete flag |
| `archivedAt` | timestamp | |
| `archivedBy` | text | User identifier |
| `createdAt` / `updatedAt` | timestamp | |

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `bankId` | text (FK → banks.id) | |
| `productCode` | text | |
| `categoryStage` | text | |
| `status` | text | |
| `progressPercent` | real | 0–100 |
| `riskLevel` | text | |
| `isArchived` | boolean | |
| `createdAt` / `updatedAt` | timestamp | |

### `product_types`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `name` | text (unique) | |
| `isActive` | boolean | Deactivation flag (soft toggle, not archive) |

### `bank_product_types` (join table)
| Column | Type | Notes |
|---|---|---|
| `bankId` | text (FK → banks.id) | Composite PK part |
| `productTypeId` | text (FK → product_types.id) | Composite PK part |

### `meetings`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `bankId` | text (FK → banks.id) | |
| `date` | timestamp | |
| `topic` | text | |
| `summary` | text | |
| `attendees` | text/jsonb | |
| `status` | text | |
| `isArchived` | boolean | |
| `archivedAt` / `archivedBy` | timestamp / text | |

### `files` (documents)
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `entityType` | text | `'bank' \| 'product' \| 'meeting'` (polymorphic) |
| `entityId` | text | Polymorphic FK, no DB-level constraint |
| `onedriveFileId` | text | Microsoft Graph file ID |
| `onedriveUrl` | text | Internal reference (re-signed on read, not served directly) |
| `title` | text | |
| `docType` | text | |
| `isArchived` | boolean | |

### `action_items`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `bankId` | text (FK → banks.id) | |
| `description` | text | |
| `dueDate` | timestamp | |
| `owner` | text | |
| `status` | text | |

### `risks`
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `bankId` | text (FK → banks.id) | |
| `description` | text | |
| `level` | text | |
| `status` | text | |

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | text/serial (PK) | |
| `userId` | text | Actor |
| `userName` | text | Denormalized for display |
| `action` | text | `CREATE \| UPDATE \| ARCHIVE \| RESTORE` |
| `entityType` | text | `bank \| product \| productType \| meeting \| document` |
| `entityId` | text | |
| `details` | jsonb | Diff/context payload |
| `createdAt` | timestamp | |

### `lookups`
| Column | Type | Notes |
|---|---|---|
| `key` | text (PK) | e.g. `bank_categories`, `risk_levels` |
| `values` | text array | Dropdown option values |

### `profiles` (Supabase-managed, referenced by API server)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Matches Supabase Auth user id |
| `email` | text | |
| `role` | text | `super_admin \| admin \| manager \| editor \| viewer` |
| `permissions` | jsonb | `{ user_management, documents, meetings, security, dashboard_access }` |
| `deleted_at` | timestamp \| null | Soft-deactivation for auth purposes |

## Notes on Data Integrity

- Foreign keys enforced at the DB level for `bankId` references (`products`, `meetings`, `action_items`, `risks`) and for `bank_product_types`.
- `files.entityId`/`entityType` is a polymorphic reference **without** a DB-level foreign key (by necessity, since it can point to three different tables) — referential integrity here is enforced in application code, not the database.
- All soft-delete flags (`isArchived`) default to `false`; no row should ever be physically deleted for banks, meetings, or documents — only archived.

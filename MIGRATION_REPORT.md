# Migration Report: OneDrive → Supabase Storage

**Date**: 2026-07-12  
**Task**: #9 — Migrate file storage from OneDrive to Supabase

---

## Summary

All file and image uploads in the WASL AI Hub platform have been migrated from Microsoft OneDrive (via the Replit Connectors SDK + Graph API) to Supabase Storage. The API server now starts without any OneDrive or Microsoft dependencies.

---

## Pre-Migration Backup

82 file metadata rows were backed up before any changes were applied:

```
backup/files-metadata-backup.json — all 82 rows from the `files` table
```

---

## Database Changes

### New Column
```sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_path TEXT;
```

- All 82 pre-migration rows have `storage_path = NULL` (legacy OneDrive rows).
- All new uploads populate `storage_path` with the Supabase Storage object key (e.g. `bank/BANK-001/1720700000_report.pdf`).

### Legacy Columns Preserved
`onedrive_file_id` and `onedrive_url` remain in the schema (nullable) so old rows stay readable and the column data isn't lost. These can be dropped in a future cleanup migration once legacy rows are confirmed unused.

---

## Supabase Storage Bucket

- **Bucket name**: `wasl-documents`
- **Visibility**: Private (no public access)
- **Max file size**: 10 MB per upload
- **URL mechanism**: Signed URLs generated fresh on every read (1-hour TTL). URLs are never stored in the database.

The bucket is created automatically on API server startup via `ensureStorageBucket()` (called once, silently ignores "already exists" errors).

---

## Files Changed

### New File
| File | Purpose |
|---|---|
| `artifacts/api-server/src/lib/supabase-storage.ts` | Core helpers: `uploadToStorage`, `getSignedUrl`, `deleteFromStorage`, `resolveStoredUrl`, `ensureStorageBucket` |

### Fully Rewritten
| File | Changes |
|---|---|
| `artifacts/api-server/src/routes/documents.ts` | Replaced OneDrive upload/move with Supabase; `toWire()` now async, generates signed URLs; archive/restore simplified to DB-only flag flip |
| `artifacts/api-server/src/routes/banks.ts` | Replaced `uploadBankImage()` to use Supabase Storage for bank logos and hero images; `withResignedImages()` (sync) → `withSignedImageUrls()` (async); `fileToWire()` for bank documents |
| `artifacts/api-server/src/routes/archive.ts` | Replaced `resignFileUrl()` with Supabase `getSignedUrl()` for documents; `resolveStoredUrl()` for bank logo URLs |
| `artifacts/api-server/src/index.ts` | Replaced `ensureWaslFolders()` startup call with `ensureStorageBucket()` |

### Deleted
| File | Reason |
|---|---|
| `artifacts/api-server/src/lib/onedrive.ts` | OneDrive upload/move logic — no longer needed |
| `artifacts/api-server/src/lib/file-tokens.ts` | HMAC signed-token proxy for OneDrive auth — no longer needed |
| `artifacts/api-server/src/routes/files-content.ts` | OneDrive proxy redirect route — no longer needed (signed URLs returned directly in API responses) |

### Updated
| File | Changes |
|---|---|
| `lib/db/src/schema/files.ts` | Added `storagePath: text("storage_path")` column |
| `lib/api-spec/openapi.yaml` | Added `fileUrl` field to Document schema; updated tag descriptions; removed OneDrive references from summaries |
| `lib/api-zod/src/generated/api.ts` | Added `fileUrl` field to all 7 Document Zod schemas (ListDocumentsResponseItem, CreateDocumentResponse, UploadDocumentResponse, UpdateDocumentResponse, RestoreDocumentResponse, and archive variants) |
| `lib/api-zod/src/generated/types/document.ts` | Added `fileUrl?: string | null` to Document TypeScript interface |
| `artifacts/wasl-platform/src/pages/bank-detail.tsx` | "Upload to OneDrive" → "Upload File"; toast messages updated; download URLs use `fileUrl \|\| oneDriveWebUrl \|\| link`; `oneDriveItemId` detection → `fileUrl \|\| oneDriveItemId`; upload progress bar added |
| `artifacts/wasl-platform/src/pages/documents.tsx` | Download URL fallback chain updated |
| `artifacts/api-server/package.json` | Removed `@replit/connectors-sdk` dependency |
| `artifacts/api-server/src/routes/index.ts` | Removed `filesContentRouter` import and registration |

---

## API Contract Changes

### New field: `fileUrl`
All Document API responses (`GET /documents`, `POST /documents`, `POST /documents/upload`, `PATCH /documents/:id`, `POST /documents/:id/restore`, `GET /archive`) now include:

```json
{
  "fileUrl": "https://[supabase-host]/storage/v1/object/sign/wasl-documents/...",
  "oneDriveWebUrl": "<same value as fileUrl — deprecated alias kept for backward compat>"
}
```

- `fileUrl` is the canonical field going forward.
- `oneDriveWebUrl` continues to be populated (same value as `fileUrl`) so cached clients continue working.
- Both are `null` for link-only records and legacy OneDrive rows.

### Simplified archive/restore behavior
Previously, archiving a document physically moved the file to an OneDrive "Archive" folder. Now:
- **Archive**: sets `isArchived = true` (DB-only, no storage operation)
- **Restore**: sets `isArchived = false` (DB-only, no storage operation)

The Supabase Storage object is preserved in both cases, making restore instantaneous and reliable.

---

## Data Migration Status

| Category | Count | Status |
|---|---|---|
| Pre-migration OneDrive rows | 82 | `storagePath = NULL`; `fileUrl = null` in API responses; "No link available" in UI |
| New Supabase uploads | 0 (at migration time) | Will populate `storagePath`; get signed URLs on every read |

Legacy rows retain their `onedrive_file_id` and `onedrive_url` column values in the DB (now inaccessible, since the OneDrive proxy and tokens were removed). These rows show "No link available" in the UI, which is the accepted behavior agreed on in the task plan.

---

## Microsoft Dependency Removal

| Item | Status |
|---|---|
| `@replit/connectors-sdk` | Removed from `api-server` dependencies |
| `lib/onedrive.ts` | Deleted |
| `lib/file-tokens.ts` | Deleted |
| `routes/files-content.ts` | Deleted |
| `ensureWaslFolders()` on startup | Removed |
| `moveOneDriveItem()` on archive/restore | Removed |
| Microsoft OneDrive integration | No longer used by any API route |

All outbound requests to `graph.microsoft.com` have been eliminated from the document and image upload flows.

---

## Verification

- TypeScript: `pnpm --filter @workspace/api-server run typecheck` → **0 errors**
- API server: builds and starts successfully on port 8080
- `GET /api/documents` → returns `fileUrl: null` for legacy rows (expected)
- New uploads → routed through `POST /documents/upload` → stored in Supabase Storage → signed URL returned in response

---

## Known Limitations / Follow-up Work

1. **Legacy OneDrive documents (82 rows)** have `fileUrl = null`. Files are not accessible from the UI. These need either: (a) manual re-upload, or (b) a one-time migration script to fetch and re-upload from OneDrive before removing the OneDrive integration entirely.

2. **Existing bank logos/hero images** stored as `/api/files/content/:itemId` proxy URLs return `null` from `resolveStoredUrl()` since the proxy was removed. Logos will reappear once re-uploaded via the Settings page.

3. **Hard delete**: `deleteFromStorage()` exists in `supabase-storage.ts` but is not wired into any route. Archived files are preserved in Supabase Storage indefinitely until a hard-delete policy is implemented.

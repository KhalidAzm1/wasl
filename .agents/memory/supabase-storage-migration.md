---
name: Supabase Storage migration
description: OneDrive → Supabase Storage migration decisions and patterns for the WASL platform
---

# Supabase Storage migration (wasl-documents bucket)

## What changed
- All file/image uploads now go to Supabase Storage bucket `wasl-documents` (private, 10MB limit)
- `files.storage_path` column added (TEXT, nullable); old rows have NULL
- Bank logos/hero images also migrated to Supabase (stored as storage paths in `banks.logo_url` / `banks.hero_image_url`)

## Key patterns

### Signed URLs — regenerated on every read
Signed URLs are NEVER stored in the DB. `getSignedUrl(storagePath)` is called in `toWire()` / `withSignedImageUrls()` on every API read. TTL = 1 hour.

### resolveStoredUrl() — handles legacy + new
`resolveStoredUrl(storedValue)` in `supabase-storage.ts` handles three cases:
- `data:...` → return as-is (inline base64, used by some PATCH logo updates)
- `/api/files/content/...` → return null (legacy OneDrive proxy, no longer resolvable)
- anything else → treat as Supabase storage path, generate signed URL

### ensureStorageBucket() on startup
Called once in `src/index.ts`; ignores "already exists" errors.

### Archive = DB flag only (no storage delete)
Archived files stay in Supabase Storage. `deleteFromStorage()` exists but is NOT called anywhere — reserved for future hard-delete feature.

## Legacy rows
82 rows have `storage_path = NULL` (pre-migration OneDrive files). `fileUrl` is null for these; UI shows "No link available". Re-uploading those legacy files and existing bank logos are tracked as separate proposed tasks.

**Why:** The task plan explicitly scoped out legacy data migration to keep the code change focused and reversible.

## Deleted files
- `lib/onedrive.ts` — OneDrive upload/move
- `lib/file-tokens.ts` — HMAC token proxy for OneDrive auth
- `routes/files-content.ts` — OneDrive proxy redirect route

## After schema changes to lib/db
Run `cd lib/db && npx tsc --build --force` to regenerate `dist/*.d.ts` so dependents pick up new columns. Same applies to `lib/api-zod` when Zod schemas change.

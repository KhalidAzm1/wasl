---
name: OneDrive storage migration (v2)
description: All new file uploads go to OneDrive; existing Supabase files still read correctly; storage_path column reused with "onedrive:" prefix.
---

## Decision
New document uploads and bank logo/hero images are stored in the user's OneDrive under:
- Documents: `Wasl Platform/documents/<entityType>/<entityId>/<timestamp>_<filename>`
- Bank images: `Wasl Platform/bank-images/<bankId>/<kind>_<timestamp>.<ext>`

The Microsoft Graph item ID is stored in the DB as `onedrive:<graphItemId>` in the existing `storage_path` column. No schema change required.

## Why
User has company Microsoft 365 — files under company tenant are permanently owned by the organization, not tied to any third-party service account. Supabase Storage tied to the Supabase project which could expire.

## How it works
- `lib/onedrive-storage.ts` — upload, getDownloadUrl (cached 55min), delete
- `supabase-storage.ts → resolveStoredUrl` — routes `onedrive:` prefix to `resolveOneDriveUrl()`, Supabase paths unchanged
- Download URLs use `@microsoft.graph.downloadUrl` — pre-authenticated, embeddable in `<img>`/`<a>`, valid ~1hr
- Old Supabase-stored files (`bank-images/...`, `bank/...`) still resolve via existing `getSignedUrl` path (backward compatible)

## Key rules
- `onedrive-storage.ts` uses `ReplitConnectors` — never cache the client object (tokens expire)
- Path segments in upload URL must be percent-encoded individually (`encodeURIComponent` per segment, slashes preserved)
- `parentReference.path` in Graph JSON body is NOT percent-encoded (move operations only)
- Graph API paths require `/v1.0/...` prefix through Replit connectors proxy

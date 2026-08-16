import { getSupabaseAdmin } from "@workspace/supabase";

const BUCKET = "wasl-documents";
/** Maximum file size accepted (binary). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
/** Signed-URL time-to-live in seconds (24 hours — logos are not sensitive). */
const SIGNED_URL_TTL = 86_400; // 24 h

// ── Signed-URL in-process cache ───────────────────────────────────────────────
// Cache for 23 hours so the URL is regenerated 1 h before it expires.
const SIGNED_URL_CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 h
interface CachedUrl { url: string; expiresAt: number }
const signedUrlCache = new Map<string, CachedUrl>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of signedUrlCache) { if (v.expiresAt <= now) signedUrlCache.delete(k); }
}, 5 * 60 * 1000).unref();

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

export interface ParsedDataUrl {
  contentType: string;
  buffer: Buffer;
}

/**
 * Parses a base64 data URL into a content-type string and raw buffer.
 * Throws if the format is invalid or the file exceeds the size limit.
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("fileDataBase64 must be a base64 data URL (e.g. data:application/pdf;base64,...)");
  }
  const contentType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB upload limit`,
    );
  }
  return { contentType, buffer };
}

/**
 * Uploads a file buffer to Supabase Storage under the given path.
 * Throws on any storage error; the caller is responsible for DB cleanup.
 *
 * Returns the storage path (same as the `path` argument), which should be
 * persisted in the `files.storage_path` column.
 */
export async function uploadToStorage(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return path;
}

/**
 * Generates a fresh signed URL for the given Supabase Storage path.
 * The URL is valid for SIGNED_URL_TTL seconds and does not require
 * additional authentication — it is safe to embed in `<a>` / `<img>` tags
 * and send to the client.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const supabase = getSupabaseAdmin();

  // Retry up to 3 times with exponential backoff — needed when 28+ banks
  // all request signed URLs in parallel and hit Supabase rate limits.
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 300));
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (!error && data?.signedUrl) {
      signedUrlCache.set(storagePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
      });
      return data.signedUrl;
    }
    lastError = new Error(`Failed to sign storage URL: ${error?.message ?? "no URL returned"}`);
  }
  throw lastError!;
}

/**
 * Permanently removes an object from Supabase Storage.
 * Only call this on hard-delete — archive (soft-delete) should NOT remove
 * the storage object so it can be restored later.
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Resolves a stored URL/path from the database to a usable URL:
 * - `onedrive:<itemId>`  → pre-authenticated OneDrive download URL (via Graph)
 * - Supabase storage path (e.g. `bank-images/abc/logo_123`) → 1-hour signed URL
 * - Inline base64 data URL (starts with `data:`) → returned as-is
 * - Full https URL → returned as-is
 * - Legacy OneDrive proxy URL (`/api/files/content/...`) → null (no longer resolvable)
 * - null / undefined → null
 */
export async function resolveStoredUrl(storedValue: string | null | undefined): Promise<string | null> {
  if (!storedValue) return null;
  // Inline base64 data URL — no signing needed
  if (storedValue.startsWith("data:")) return storedValue;
  // Full external URL — pass through
  if (storedValue.startsWith("http://") || storedValue.startsWith("https://")) return storedValue;
  // Legacy OneDrive proxy URL — no longer resolvable
  if (storedValue.startsWith("/api/files/content/")) return null;
  // OneDrive item — resolve via Microsoft Graph pre-auth URL
  if (storedValue.startsWith("onedrive:")) {
    const { resolveOneDriveUrl } = await import("./onedrive-storage");
    return resolveOneDriveUrl(storedValue);
  }
  // Supabase storage path — generate a fresh 1-hour signed URL
  try {
    return await getSignedUrl(storedValue);
  } catch {
    return null;
  }
}

/**
 * Ensures the `wasl-documents` bucket exists. Safe to call repeatedly;
 * a "Duplicate" / "already exists" error is silently ignored.
 * Call once at server startup so upload routes never fail on a missing bucket.
 */
export async function ensureStorageBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
  });
  if (error && !error.message.toLowerCase().includes("already exists") && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(`Failed to create storage bucket: ${error.message}`);
  }
}

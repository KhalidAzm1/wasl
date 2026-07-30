import { ReplitConnectors } from "@replit/connectors-sdk";

/**
 * Root folder inside the user's OneDrive where all Wasl files are stored.
 * Everything goes under: "Wasl Platform/..."
 */
const WASL_ROOT = "Wasl Platform";

/** Cache pre-authenticated download URLs for 55 min (they expire after ~1 hr). */
const DOWNLOAD_URL_CACHE_TTL_MS = 55 * 60 * 1000;
interface CachedUrl { url: string; expiresAt: number }
const downloadUrlCache = new Map<string, CachedUrl>();

// Evict stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of downloadUrlCache) {
    if (v.expiresAt <= now) downloadUrlCache.delete(k);
  }
}, 5 * 60 * 1000).unref();

/** Never cache the connectors client — tokens expire. */
function getConnectors() {
  return new ReplitConnectors();
}

/**
 * Builds the Graph API upload URL for a file path inside the Wasl root folder.
 * Each path segment is percent-encoded individually; slashes are kept as-is.
 *
 * Example:
 *   folderPath = "documents/bank/BANK-001"
 *   fileName   = "report.pdf"
 *   → /v1.0/me/drive/root:/Wasl%20Platform/documents/bank/BANK-001/report.pdf:/content
 */
function buildUploadUrl(folderPath: string, fileName: string): string {
  const fullPath = `${WASL_ROOT}/${folderPath}/${fileName}`;
  const encoded = fullPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/v1.0/me/drive/root:/${encoded}:/content`;
}

/**
 * Uploads a file buffer to OneDrive under:
 *   Wasl Platform/<folderPath>/<fileName>
 *
 * Returns the Microsoft Graph item ID (e.g. "01BYE5RZF6Y2GOVW7725BZO354PWSELRRZ"),
 * which should be stored as "onedrive:<itemId>" in the DB.
 *
 * Throws on any error; the caller is responsible for DB cleanup.
 */
export async function uploadToOneDrive(
  folderPath: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const connectors = getConnectors();
  const url = buildUploadUrl(folderPath, fileName);

  const response = await connectors.proxy("onedrive", url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`OneDrive upload failed (${response.status}): ${text}`);
  }

  const item = (await response.json()) as { id: string };
  if (!item?.id) throw new Error("OneDrive upload response missing item ID");
  return item.id;
}

/**
 * Returns a pre-authenticated download URL for an OneDrive item.
 * The URL can be used directly in <img> / <a> tags without additional auth headers.
 * Cached for 55 minutes (Graph pre-auth URLs are valid for ~1 hour).
 */
export async function getOneDriveDownloadUrl(itemId: string): Promise<string> {
  const cached = downloadUrlCache.get(itemId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const connectors = getConnectors();
  const response = await connectors.proxy(
    "onedrive",
    `/v1.0/me/drive/items/${encodeURIComponent(itemId)}?$select=id,%40microsoft.graph.downloadUrl`,
    { method: "GET" },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`OneDrive get item failed (${response.status}): ${text}`);
  }

  const item = (await response.json()) as Record<string, unknown>;
  const url = item["@microsoft.graph.downloadUrl"] as string | undefined;
  if (!url) throw new Error("OneDrive response missing @microsoft.graph.downloadUrl");

  downloadUrlCache.set(itemId, { url, expiresAt: Date.now() + DOWNLOAD_URL_CACHE_TTL_MS });
  return url;
}

/**
 * Permanently deletes an OneDrive item by ID.
 * 404 is silently ignored (item already gone).
 * Only call on hard-delete — archive (soft-delete) must NOT remove the OneDrive file.
 */
export async function deleteFromOneDrive(itemId: string): Promise<void> {
  const connectors = getConnectors();
  const response = await connectors.proxy(
    "onedrive",
    `/v1.0/me/drive/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`OneDrive delete failed (${response.status}): ${text}`);
  }

  downloadUrlCache.delete(itemId);
}

/**
 * Resolves an "onedrive:<itemId>" stored value to a pre-authenticated download URL.
 * Returns null if the item is missing or the request fails.
 */
export async function resolveOneDriveUrl(stored: string): Promise<string | null> {
  const itemId = stored.startsWith("onedrive:") ? stored.slice("onedrive:".length) : stored;
  try {
    return await getOneDriveDownloadUrl(itemId);
  } catch {
    return null;
  }
}

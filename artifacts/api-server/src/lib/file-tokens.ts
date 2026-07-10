import crypto from "crypto";

// Browsers rendering <img src> / following <a href> never attach the app's
// Authorization bearer header, so the OneDrive content-redirect route
// (GET /files/content/:itemId) can't sit behind requireAuth like the rest of
// the API. Instead, every authenticated JSON response that includes a file
// URL signs it with a short-lived HMAC token; the redirect route verifies
// that token before resolving/redirecting to the real (also short-lived)
// Graph download URL. Nothing here is ever persisted -- tokens are minted
// fresh on every authenticated read.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h -- long enough that an open tab / cached page keeps working

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET must be set to sign file access tokens");
  }
  return value;
}

function sign(itemId: string, exp: number): string {
  return crypto.createHmac("sha256", secret()).update(`${itemId}.${exp}`).digest("hex");
}

export function signFileToken(itemId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${sign(itemId, exp)}`;
}

export function verifyFileToken(itemId: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const exp = Number(token.slice(0, dotIndex));
  const sig = token.slice(dotIndex + 1);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = sign(itemId, exp);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

const CONTENT_URL_PATTERN = /^\/api\/files\/content\/([^?]+)/;

/** Builds a freshly-signed proxy URL for a OneDrive item id. */
export function buildFileContentUrl(itemId: string): string {
  return `/api/files/content/${encodeURIComponent(itemId)}?token=${signFileToken(itemId)}`;
}

/**
 * Re-signs a previously stored `/api/files/content/:itemId` URL with a fresh
 * token at read time. Any other value (external URLs, null) passes through
 * unchanged.
 */
export function resignFileUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  const match = CONTENT_URL_PATTERN.exec(url);
  if (!match) return url;
  return buildFileContentUrl(decodeURIComponent(match[1]));
}

import { ReplitConnectors } from "@replit/connectors-sdk";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB simple-upload limit for Microsoft Graph
const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

const ROOT_FOLDER = "Wasl Documents";

// Fixed folder structure under /Wasl Documents. Every uploaded file lives in
// exactly one of these (or Archive once soft-deleted).
export const ONEDRIVE_FOLDERS = ["Banks", "Products", "Meetings", "Archive"] as const;
export type OneDriveFolder = (typeof ONEDRIVE_FOLDERS)[number];

export interface OneDriveUploadResult {
  itemId: string;
  webUrl: string;
  contentType: string;
  size: number;
}

function encodePath(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

/**
 * Creates /Wasl Documents/Banks, /Products, /Meetings and /Archive if they
 * don't already exist. Safe to call repeatedly (existing folders are left
 * untouched -- conflicts are swallowed).
 */
export async function ensureWaslFolders(): Promise<void> {
  const connectors = new ReplitConnectors();

  async function ensureChild(parentPath: string, name: string): Promise<void> {
    const url =
      parentPath === ""
        ? "/v1.0/me/drive/root/children"
        : `/v1.0/me/drive/root:/${encodePath(parentPath.split("/"))}:/children`;
    const response = await connectors.proxy("onedrive", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    // 409 Conflict just means the folder already exists -- that's fine.
    if (!response.ok && response.status !== 409) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to create OneDrive folder "${name}" (${response.status}): ${text}`);
    }
  }

  await ensureChild("", ROOT_FOLDER);
  for (const sub of ONEDRIVE_FOLDERS) {
    await ensureChild(ROOT_FOLDER, sub);
  }
}

/**
 * Uploads a file to Microsoft OneDrive under /Wasl Documents/<folder>/<fileName>
 * and returns the item id + web link + computed type/size. Never persists the
 * raw file bytes -- callers should only store the returned id/url alongside
 * metadata.
 */
export async function uploadFileToOneDrive(
  folder: OneDriveFolder,
  fileName: string,
  dataUrl: string,
): Promise<OneDriveUploadResult> {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("fileDataBase64 must be a base64 data URL");
  }
  const contentType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 4MB upload limit");
  }

  const connectors = new ReplitConnectors();
  const safePath = encodePath([ROOT_FOLDER, folder, fileName]);

  const response = await connectors.proxy("onedrive", `/v1.0/me/drive/root:/${safePath}:/content`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OneDrive upload failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { id: string; webUrl: string };
  return { itemId: json.id, webUrl: json.webUrl, contentType, size: buffer.byteLength };
}

/**
 * Moves an existing OneDrive item into a different top-level Wasl Documents
 * subfolder (used to archive a file into /Archive, and to restore it back
 * to its original folder).
 */
export async function moveOneDriveItem(itemId: string, toFolder: OneDriveFolder): Promise<void> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("onedrive", `/v1.0/me/drive/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentReference: { path: `/drive/root:/${encodePath([ROOT_FOLDER, toFolder])}` },
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to move OneDrive item (${response.status}): ${text}`);
  }
}

/**
 * Fetches a fresh, short-lived direct-download URL for an item. Graph's
 * downloadUrl expires after ~1 hour, so this must be called at request time
 * rather than stored -- see the /files/content/:itemId redirect route.
 */
export async function getOneDriveDownloadUrl(itemId: string): Promise<string> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "onedrive",
    `/v1.0/me/drive/items/${encodeURIComponent(itemId)}?select=id,%40microsoft.graph.downloadUrl`,
    { method: "GET" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to resolve OneDrive item (${response.status}): ${text}`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  const url = json["@microsoft.graph.downloadUrl"];
  if (typeof url !== "string") {
    throw new Error("OneDrive item has no download URL available");
  }
  return url;
}

import { ReplitConnectors } from "@replit/connectors-sdk";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB simple-upload limit for Microsoft Graph
const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

export interface OneDriveUploadResult {
  itemId: string;
  webUrl: string;
}

/**
 * Uploads a file to Microsoft OneDrive under /Wasl Documents/<folder>/<fileName> and
 * returns the item id + web link. Never persists the raw file bytes -- callers should
 * only store the returned id/url alongside metadata.
 */
export async function uploadFileToOneDrive(
  folder: string,
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
  const safePath = ["Wasl Documents", folder, fileName]
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await connectors.proxy("onedrive", `/me/drive/root:/${safePath}:/content`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OneDrive upload failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { id: string; webUrl: string };
  return { itemId: json.id, webUrl: json.webUrl };
}

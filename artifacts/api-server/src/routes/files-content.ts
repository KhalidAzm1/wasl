import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, filesTable } from "@workspace/db";
import { getOneDriveDownloadUrl } from "../lib/onedrive";
import { verifyFileToken } from "../lib/file-tokens";

// Browsers render <img> tags and follow <a> link clicks without an
// Authorization header, so this route cannot sit behind requireAuth like the
// rest of the API. Instead, access requires a short-lived signed `token`
// query param minted by an authenticated response (see lib/file-tokens.ts) --
// the raw itemId alone is not sufficient. Archived files are also rejected so
// an old link stops working the moment a file is moved to /Archive. Graph's
// real download URL expires after ~1 hour and is resolved fresh on every
// request rather than ever being persisted.
const router: IRouter = Router();

router.get("/files/content/:itemId", async (req, res): Promise<void> => {
  const itemId = req.params.itemId;
  if (!verifyFileToken(itemId, req.query.token)) {
    res.status(403).json({ error: "Invalid or expired file access token" });
    return;
  }
  const [known] = await db
    .select({ id: filesTable.id, isArchived: filesTable.isArchived })
    .from(filesTable)
    .where(eq(filesTable.onedriveFileId, itemId));
  if (!known || known.isArchived) {
    res.status(404).json({ error: "Unknown file" });
    return;
  }
  try {
    const url = await getOneDriveDownloadUrl(itemId);
    res.redirect(302, url);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to resolve file" });
  }
});

export default router;

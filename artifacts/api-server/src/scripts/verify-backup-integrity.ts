import { pool } from "@workspace/db";
import { verifyLatestBackupIntegrity } from "../lib/backup-readiness";

try {
  console.log(JSON.stringify(await verifyLatestBackupIntegrity()));
} finally {
  await pool.end();
}

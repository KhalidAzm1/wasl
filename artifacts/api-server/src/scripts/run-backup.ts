import { createDatabaseBackup } from "../lib/backup-readiness";
import { pool } from "@workspace/db";

try {
  const requested = process.argv[2];
  const backupType = requested === "monthly_full" ? "monthly_full" : requested === "weekly_full" ? "weekly_full" : "manual_full";
  const result = await createDatabaseBackup("replit-scheduled-deployment", backupType);
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}

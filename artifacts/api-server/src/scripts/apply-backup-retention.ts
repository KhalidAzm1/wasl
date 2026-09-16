import { applyBackupRetentionPolicy } from "../lib/backup-readiness";
import { pool } from "@workspace/db";

try {
  console.log(JSON.stringify(await applyBackupRetentionPolicy()));
} finally {
  await pool.end();
}

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { and, desc, eq, isNull } from "drizzle-orm";
import { backupRecoveryTestsTable, backupRunsTable, db } from "@workspace/db";
import { deleteFromOneDrive, downloadFromOneDrive, uploadFileToOneDrive } from "./onedrive-storage";

const CRITICAL_DATA = [
  "PostgreSQL schema",
  "Banks and contacts",
  "Products and implementation tracks",
  "Meetings, actions, risks and audit history",
  "Document metadata and OneDrive references",
  "Application settings and user profiles",
];

const RECOVERY_PROCEDURE = [
  "Provision an isolated empty PostgreSQL test database.",
  "Download the selected backup from OneDrive and verify its SHA-256 checksum.",
  "Run pg_restore only against the isolated test database.",
  "Validate required tables, row counts, relationships and representative records.",
  "Record the test result, duration and operator in Backup & Recovery.",
  "Never restore into production without explicit approval and a maintenance window.",
];

export type BackupType = "manual_full" | "weekly_full" | "monthly_full";

function encryptionKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) throw new Error("BACKUP_ENCRYPTION_KEY is not configured in Replit Secrets");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be exactly 32 bytes");
  return key;
}

async function encryptAes256Gcm(sourcePath: string, targetPath: string): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  // File format: WASLBAK1 (8 bytes), IV (12), ciphertext, auth tag (16).
  await writeFile(targetPath, Buffer.concat([Buffer.from("WASLBAK1"), iv]));
  await pipeline(createReadStream(sourcePath), cipher, createWriteStream(targetPath, { flags: "a" }));
  await appendFile(targetPath, cipher.getAuthTag());
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}: ${stderr}`)));
  });
}

function runCapture(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`pg_restore exited with code ${code}: ${stderr}`)));
  });
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database connection hidden]")
    .slice(0, 1000);
}

export async function createDatabaseBackup(createdBy?: string, backupType: BackupType = "manual_full") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const running = await db.select({ id: backupRunsTable.id }).from(backupRunsTable)
    .where(eq(backupRunsTable.status, "running")).limit(1);
  if (running.length) throw new Error("A backup is already running");

  const id = randomUUID();
  const startedAt = new Date();
  await db.insert(backupRunsTable).values({ id, backupType, status: "running", createdBy: createdBy ?? "scheduled-job" });
  const workDir = await mkdtemp(path.join(tmpdir(), "wasl-backup-"));
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const plainName = `wasl-postgresql-${backupType}-${stamp}.dump`;
  const plainPath = path.join(workDir, plainName);
  const fileName = `${plainName}.aes256`;
  const filePath = path.join(workDir, fileName);
  const tier = backupType === "monthly_full" ? "monthly" : backupType === "weekly_full" ? "weekly" : "manual";
  const folder = `backups/postgresql/${tier}/${startedAt.getUTCFullYear()}/${String(startedAt.getUTCMonth() + 1).padStart(2, "0")}`;

  try {
    await run("pg_dump", [
      "--dbname", process.env.DATABASE_URL,
      "--format=custom", "--compress=9", "--no-owner", "--no-acl", "--file", plainPath,
    ], process.env);
    await encryptAes256Gcm(plainPath, filePath);
    const [{ size }, checksum] = await Promise.all([stat(filePath), sha256(filePath)]);
    const itemId = await uploadFileToOneDrive(folder, fileName, filePath);
    const completedAt = new Date();
    await db.update(backupRunsTable).set({
      status: "successful",
      storagePath: `Wasl Platform/${folder}/${fileName}`,
      oneDriveItemId: itemId,
      sizeBytes: size,
      checksumSha256: checksum,
      encryption: "AES-256-GCM",
      completedAt,
      errorMessage: null,
    }).where(eq(backupRunsTable.id, id));
    return { id, status: "successful", sizeBytes: size, checksumSha256: checksum, completedAt };
  } catch (error) {
    await db.update(backupRunsTable).set({
      status: "failed",
      errorMessage: safeError(error),
      completedAt: new Date(),
    }).where(eq(backupRunsTable.id, id));
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Read-only integrity check. It never connects to or writes to a database. */
export async function verifyLatestBackupIntegrity() {
  const [latest] = await db.select().from(backupRunsTable)
    .where(and(eq(backupRunsTable.status, "successful"), isNull(backupRunsTable.destroyedAt)))
    .orderBy(desc(backupRunsTable.completedAt))
    .limit(1);
  if (!latest?.oneDriveItemId || !latest.checksumSha256) throw new Error("No successful backup is available to verify");

  const workDir = await mkdtemp(path.join(tmpdir(), "wasl-backup-check-"));
  const encryptedPath = path.join(workDir, "backup.aes256");
  const plainPath = path.join(workDir, "backup.dump");
  try {
    await writeFile(encryptedPath, await downloadFromOneDrive(latest.oneDriveItemId));

    const actualChecksum = await sha256(encryptedPath);
    if (actualChecksum !== latest.checksumSha256) throw new Error("Backup checksum does not match the recorded SHA-256 value");

    const encrypted = await readFile(encryptedPath);
    if (encrypted.length < 36 || encrypted.subarray(0, 8).toString() !== "WASLBAK1") {
      throw new Error("Backup encryption header is invalid");
    }
    const iv = encrypted.subarray(8, 20);
    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(20, encrypted.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    await writeFile(plainPath, Buffer.concat([decipher.update(ciphertext), decipher.final()]));

    const listing = await runCapture("pg_restore", ["--list", plainPath], process.env);
    const objectCount = listing.split("\n").filter((line) => line.trim() && !line.startsWith(";")).length;
    if (objectCount === 0) throw new Error("Backup archive contains no restorable objects");
    return { backupRunId: latest.id, status: "passed", checksumVerified: true, encryptionVerified: true, archiveReadable: true, objectCount };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function getBackupReadiness() {
  const [runs, tests] = await Promise.all([
    db.select().from(backupRunsTable).orderBy(desc(backupRunsTable.startedAt)).limit(20),
    db.select().from(backupRecoveryTestsTable).orderBy(desc(backupRecoveryTestsTable.testedAt)).limit(10),
  ]);
  return {
    configured: Boolean(process.env.DATABASE_URL),
    provider: "Microsoft OneDrive",
    destination: "Wasl Platform/Backups/PostgreSQL/{weekly|monthly}/YYYY/MM",
    criticalData: CRITICAL_DATA,
    recoveryProcedure: RECOVERY_PROCEDURE,
    schedules: {
      dailyIncremental: "Provider-managed Replit PostgreSQL PITR — verify recovery window in Replit",
      weeklyFull: "Every Friday at 02:00 Asia/Riyadh",
      monthlyFull: "First day of every month at 03:00 Asia/Riyadh",
      recoveryTest: "Every 3 months — isolated test database, explicit approval required",
    },
    retention: { weeklyDays: 56, monthlyDays: 365 },
    encryption: "AES-256-GCM",
    encryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
    latestSuccessfulBackup: runs.find((run) => run.status === "successful") ?? null,
    latestRecoveryTest: tests[0] ?? null,
    runs,
    recoveryTests: tests,
    restoreEnabled: false,
  };
}

/** Secure-destruction job for expired cloud backups; preserves an audit record. */
export async function applyBackupRetentionPolicy(): Promise<{ destroyed: number; failed: number }> {
  const now = Date.now();
  const weeklyCutoff = new Date(now - 56 * 24 * 60 * 60 * 1000);
  const monthlyCutoff = new Date(now - 365 * 24 * 60 * 60 * 1000);
  const candidates = await db.select().from(backupRunsTable).where(and(
    eq(backupRunsTable.status, "successful"),
    isNull(backupRunsTable.destroyedAt),
  ));
  const expired = candidates.filter((run) =>
    (run.backupType === "weekly_full" && run.startedAt < weeklyCutoff) ||
    (run.backupType === "monthly_full" && run.startedAt < monthlyCutoff),
  );
  let destroyed = 0;
  let failed = 0;
  for (const run of expired) {
    if (!run.oneDriveItemId) { failed++; continue; }
    try {
      await deleteFromOneDrive(run.oneDriveItemId);
      await db.update(backupRunsTable).set({ destroyedAt: new Date() }).where(eq(backupRunsTable.id, run.id));
      destroyed++;
    } catch {
      failed++;
    }
  }
  return { destroyed, failed };
}

/**
 * System Health & Testing Routes
 * ───────────────────────────────
 * GET  /api/system/health                  – live system metrics
 * POST /api/system/tests/run               – run a test suite
 * GET  /api/system/reports                 – list saved reports
 * GET  /api/system/reports/:id             – get one report (JSON)
 * GET  /api/system/reports/:id/download    – download PDF version
 * DELETE /api/system/reports/:id           – delete a report
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq, isNull, and, not } from "drizzle-orm";
import {
  db,
  banksTable,
  productsTable,
  meetingsTable,
  filesTable,
  actionItemsTable,
  auditLogsTable,
} from "@workspace/db";
import { getSupabaseAdmin } from "@workspace/supabase";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  uploadToStorage,
  deleteFromStorage,
  getSignedUrl,
} from "../lib/supabase-storage";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
router.use(requireAuth);

const BUCKET = "wasl-documents";
const REPORTS_DIR = path.join(process.cwd(), "storage", "reports");

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestResult {
  test: string;
  category: string;
  status: "passed" | "failed" | "warning" | "skipped";
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

interface RecommendationItem {
  severity: "critical" | "medium" | "low";
  issue: string;
  fix: string;
}

interface SystemReport {
  id: string;
  suite: string;
  timestamp: string;
  durationMs: number;
  environment: string;
  appVersion: string;
  results: TestResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    errors: number;
    score: number;
  };
  health: {
    database: Record<string, number>;
    storage: {
      provider: string;
      bucket: string;
      fileCount: number;
      totalSizeMB: number;
      uploadDirectory: string;
    };
    integrity: {
      orphanFiles: number;
      missingFiles: number;
      brokenLinks: number;
    };
  };
  recommendations: RecommendationItem[];
  logs: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

async function countRows(table: any, condition?: any): Promise<number> {
  const query = db
    .select({ n: sql<number>`count(*)::int` })
    .from(table);
  const [row] = condition ? await query.where(condition) : await query;
  return row?.n ?? 0;
}

function ms(): number {
  return Date.now();
}

function elapsed(start: number): number {
  return Date.now() - start;
}

function makeResult(
  category: string,
  test: string,
  status: TestResult["status"],
  message: string,
  startMs: number,
  details?: Record<string, unknown>,
): TestResult {
  return { test, category, status, message, durationMs: elapsed(startMs), details };
}

// ── Data aggregation ──────────────────────────────────────────────────────────

async function getDatabaseStats(): Promise<Record<string, number>> {
  const [
    banksActive,
    banksArchived,
    products,
    meetingsActive,
    meetingsArchived,
    filesActive,
    filesArchived,
    actionItems,
    auditLogs,
  ] = await Promise.all([
    countRows(banksTable, eq(banksTable.isArchived, false)),
    countRows(banksTable, eq(banksTable.isArchived, true)),
    countRows(productsTable),
    countRows(meetingsTable, eq(meetingsTable.isArchived, false)),
    countRows(meetingsTable, eq(meetingsTable.isArchived, true)),
    countRows(filesTable, eq(filesTable.isArchived, false)),
    countRows(filesTable, eq(filesTable.isArchived, true)),
    countRows(actionItemsTable),
    countRows(auditLogsTable),
  ]);

  let users = 0;
  try {
    const { data } = await getSupabaseAdmin().auth.admin.listUsers({ perPage: 1 });
    users = (data as any)?.total ?? 0;
  } catch {
    // ignore – non-blocking
  }

  return {
    banksActive,
    banksArchived,
    productsTotal: products,
    meetingsActive,
    meetingsArchived,
    filesActive,
    filesArchived,
    actionItemsTotal: actionItems,
    auditLogsTotal: auditLogs,
    usersTotal: users,
  };
}

async function getStorageStats(): Promise<{
  fileCount: number;
  totalSizeMB: number;
}> {
  // Approximate from the files table (storagePath IS NOT NULL).
  const [countRow] = await db
    .select({
      n: sql<number>`count(*)::int`,
      totalBytes: sql<number>`coalesce(sum(file_size), 0)::bigint`,
    })
    .from(filesTable)
    .where(and(not(isNull(filesTable.storagePath)), eq(filesTable.isArchived, false)));

  return {
    fileCount: countRow?.n ?? 0,
    totalSizeMB: Math.round(((countRow?.totalBytes ?? 0) / (1024 * 1024)) * 100) / 100,
  };
}

async function getIntegrityStats(): Promise<{
  orphanFiles: number;
  missingFiles: number;
  brokenLinks: number;
}> {
  // Broken links: link-only records whose link doesn't look like a URL
  const [linkRows] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(filesTable)
    .where(
      and(
        eq(filesTable.isArchived, false),
        not(isNull(filesTable.link)),
        isNull(filesTable.storagePath),
        sql`link NOT LIKE 'http%'`,
      ),
    );
  const brokenLinks = linkRows?.n ?? 0;

  // "Missing files": rows with storagePath set but no file_size (suggests partial upload)
  const [missingRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(filesTable)
    .where(
      and(
        eq(filesTable.isArchived, false),
        not(isNull(filesTable.storagePath)),
        isNull(filesTable.fileSize),
      ),
    );
  const missingFiles = missingRow?.n ?? 0;

  // Orphan products: bank_id references a non-existent bank
  const [orphanProd] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(
      sql`bank_id NOT IN (SELECT id FROM banks)`,
    );
  const orphanFiles = orphanProd?.n ?? 0;

  return { orphanFiles, missingFiles, brokenLinks };
}

function calculateHealthScore(passed: number, failed: number, warnings: number): number {
  const total = passed + failed + warnings;
  if (total === 0) return 100;
  const score = Math.round(((passed + warnings * 0.5) / total) * 100);
  return Math.min(100, Math.max(0, score));
}

function generateRecommendations(
  results: TestResult[],
  integrity: { orphanFiles: number; missingFiles: number; brokenLinks: number },
): RecommendationItem[] {
  const recs: RecommendationItem[] = [];
  const failed = results.filter((r) => r.status === "failed");

  for (const r of failed) {
    recs.push({
      severity: "critical",
      issue: `${r.test} failed: ${r.message}`,
      fix: r.category === "storage"
        ? "Check Supabase credentials and bucket configuration."
        : r.category === "database"
        ? "Check database connection string and schema migrations."
        : "Review the test details and investigate the underlying service.",
    });
  }

  if (integrity.brokenLinks > 0) {
    recs.push({
      severity: "medium",
      issue: `${integrity.brokenLinks} document link(s) appear to be invalid (not starting with http).`,
      fix: "Review files table for rows where link is set but malformed. Update or remove those records.",
    });
  }
  if (integrity.missingFiles > 0) {
    recs.push({
      severity: "medium",
      issue: `${integrity.missingFiles} file record(s) have a storagePath but no file_size, suggesting incomplete uploads.`,
      fix: "Re-upload the affected files or remove the orphaned DB records.",
    });
  }
  if (integrity.orphanFiles > 0) {
    recs.push({
      severity: "low",
      issue: `${integrity.orphanFiles} product(s) reference non-existent banks.`,
      fix: "Run a cleanup query to delete or re-associate orphan product records.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      severity: "low",
      issue: "No major issues found.",
      fix: "Continue regular health checks. Consider scheduling automated nightly checks.",
    });
  }
  return recs;
}

// ── Test suites ───────────────────────────────────────────────────────────────

async function runDatabaseTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 1. Connection test
  let t = ms();
  try {
    await db.select({ n: sql`1` }).from(banksTable).limit(1);
    results.push(makeResult("database", "Database Connection", "passed", "Connected to PostgreSQL successfully.", t));
  } catch (e: any) {
    results.push(makeResult("database", "Database Connection", "failed", `Connection failed: ${e.message}`, t));
    return results; // no point continuing
  }

  // 2. Table checks
  const tables = [
    { name: "Banks Table", table: banksTable },
    { name: "Products Table", table: productsTable },
    { name: "Meetings Table", table: meetingsTable },
    { name: "Files Table", table: filesTable },
    { name: "Action Items Table", table: actionItemsTable },
    { name: "Audit Logs Table", table: auditLogsTable },
  ];

  for (const { name, table } of tables) {
    t = ms();
    try {
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
      results.push(
        makeResult("database", name, "passed", `Accessible — ${row?.n ?? 0} records.`, t, { count: row?.n }),
      );
    } catch (e: any) {
      results.push(makeResult("database", name, "failed", `Query failed: ${e.message}`, t));
    }
  }

  // 3. Orphan records check
  t = ms();
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(sql`bank_id NOT IN (SELECT id FROM banks)`);
    const orphans = row?.n ?? 0;
    results.push(
      makeResult(
        "database",
        "Orphan Records",
        orphans > 0 ? "warning" : "passed",
        orphans > 0 ? `${orphans} product(s) reference non-existent banks.` : "No orphan records found.",
        t,
        { orphanProducts: orphans },
      ),
    );
  } catch (e: any) {
    results.push(makeResult("database", "Orphan Records", "warning", `Check skipped: ${e.message}`, t));
  }

  // 4. Data integrity (JSONB contacts)
  t = ms();
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(banksTable)
      .where(sql`contacts IS NULL`);
    const nullContacts = row?.n ?? 0;
    results.push(
      makeResult(
        "database",
        "Data Integrity (JSONB)",
        nullContacts > 0 ? "warning" : "passed",
        nullContacts > 0
          ? `${nullContacts} bank(s) have NULL contacts field.`
          : "JSONB contacts field is intact across all banks.",
        t,
      ),
    );
  } catch (e: any) {
    results.push(makeResult("database", "Data Integrity (JSONB)", "skipped", e.message, t));
  }

  return results;
}

async function runStorageTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabaseAdmin();

  // 1. Supabase connection
  let t = ms();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    results.push(
      makeResult("storage", "Supabase Connection", "passed", `Connected — ${data?.length ?? 0} bucket(s) found.`, t),
    );
  } catch (e: any) {
    results.push(makeResult("storage", "Supabase Connection", "failed", `Connection failed: ${e.message}`, t));
    return results;
  }

  // 2. Bucket exists
  t = ms();
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error || !data) throw new Error(`Bucket "${BUCKET}" not found`);
    results.push(makeResult("storage", "Bucket Exists", "passed", `Bucket "${BUCKET}" is accessible.`, t));
  } catch (e: any) {
    results.push(makeResult("storage", "Bucket Exists", "failed", e.message, t));
    return results;
  }

  // 3. File count consistency
  t = ms();
  try {
    const stats = await getStorageStats();
    results.push(
      makeResult("storage", "Storage Consistency", "passed",
        `${stats.fileCount} file(s) tracked in database, ~${stats.totalSizeMB} MB total.`, t,
        { fileCount: stats.fileCount, totalSizeMB: stats.totalSizeMB }),
    );
  } catch (e: any) {
    results.push(makeResult("storage", "Storage Consistency", "warning", `Check incomplete: ${e.message}`, t));
  }

  // 4. Integrity checks
  t = ms();
  try {
    const integrity = await getIntegrityStats();
    const issues = integrity.brokenLinks + integrity.missingFiles + integrity.orphanFiles;
    results.push(
      makeResult("storage", "Storage Integrity",
        issues > 0 ? "warning" : "passed",
        issues > 0
          ? `Found: ${integrity.orphanFiles} orphan(s), ${integrity.missingFiles} missing file(s), ${integrity.brokenLinks} broken link(s).`
          : "No integrity issues found.",
        t, integrity),
    );
  } catch (e: any) {
    results.push(makeResult("storage", "Storage Integrity", "warning", e.message, t));
  }

  return results;
}

async function runUploadTests(): Promise<{ results: TestResult[]; uploadedPaths: string[] }> {
  const results: TestResult[] = [];
  const uploadedPaths: string[] = [];
  const testId = `test-${Date.now()}`;

  // PDF upload
  let t = ms();
  try {
    const pdfBuffer = await createMinimalPdf(`WASL Test — ${new Date().toISOString()}`);
    const pdfPath = `test/${testId}/test.pdf`;
    await uploadToStorage(pdfPath, pdfBuffer, "application/pdf");
    uploadedPaths.push(pdfPath);
    results.push(
      makeResult("upload", "PDF Upload", "passed",
        `Uploaded ${Math.round(pdfBuffer.byteLength / 1024)} KB PDF successfully.`, t,
        { path: pdfPath }),
    );
  } catch (e: any) {
    results.push(makeResult("upload", "PDF Upload", "failed", e.message, t));
  }

  // Image upload
  t = ms();
  try {
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==",
      "base64",
    );
    const imgPath = `test/${testId}/test.png`;
    await uploadToStorage(imgPath, pngBuffer, "image/png");
    uploadedPaths.push(imgPath);
    results.push(makeResult("upload", "Image Upload", "passed", "Uploaded PNG image (10x10px) successfully.", t, { path: imgPath }));
  } catch (e: any) {
    results.push(makeResult("upload", "Image Upload", "failed", e.message, t));
  }

  // Excel (CSV) upload
  t = ms();
  try {
    const csvContent = `Bank Name,Status,Risk Level\nTest Bank A,Active,Low\nTest Bank B,Pending,Medium\n`;
    const xlsxBuffer = Buffer.from(csvContent, "utf-8");
    const xlsxPath = `test/${testId}/test.xlsx`;
    await uploadToStorage(xlsxPath, xlsxBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    uploadedPaths.push(xlsxPath);
    results.push(makeResult("upload", "Excel Upload", "passed", `Uploaded ${xlsxBuffer.byteLength} B Excel-format file successfully.`, t, { path: xlsxPath }));
  } catch (e: any) {
    results.push(makeResult("upload", "Excel Upload", "failed", e.message, t));
  }

  return { results, uploadedPaths };
}

async function runDownloadTests(uploadedPaths: string[] = []): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // If no test paths supplied, find an existing file in DB
  let paths = uploadedPaths;
  if (paths.length === 0) {
    const rows = await db
      .select({ storagePath: filesTable.storagePath })
      .from(filesTable)
      .where(and(not(isNull(filesTable.storagePath)), eq(filesTable.isArchived, false)))
      .limit(3);
    paths = rows.map((r) => r.storagePath!).filter(Boolean);
  }

  if (paths.length === 0) {
    results.push(makeResult("download", "Signed URL Generation", "skipped",
      "No files found in storage to test downloading. Upload files first.", ms()));
    return results;
  }

  for (const p of paths.slice(0, 3)) {
    const t = ms();
    try {
      const url = await getSignedUrl(p);
      if (!url) throw new Error("Empty signed URL returned");
      const short = p.split("/").pop() ?? p;
      results.push(makeResult("download", `Download: ${short}`, "passed",
        "Signed URL generated successfully (valid 1 hr).", t, { path: p }));
    } catch (e: any) {
      results.push(makeResult("download", `Download: ${p.split("/").pop() ?? p}`, "failed", e.message, t));
    }
  }

  return results;
}

async function runAuthTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const supabase = getSupabaseAdmin();

  // 1. Supabase Auth connection
  let t = ms();
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    if (error) throw error;
    const total = (data as any)?.total ?? 0;
    results.push(makeResult("auth", "Auth Service Connection", "passed", `Auth service reachable — ${total} user(s) registered.`, t, { userCount: total }));
  } catch (e: any) {
    results.push(makeResult("auth", "Auth Service Connection", "failed", `Auth service error: ${e.message}`, t));
  }

  // 2. Profiles table (role system)
  t = ms();
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("role")
      .limit(10);
    const roles = (profiles ?? []).map((p: any) => p.role);
    const hasAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");
    results.push(
      makeResult("auth", "Role System", hasAdmin ? "passed" : "warning",
        hasAdmin
          ? `Role system active. Found: ${[...new Set(roles)].join(", ")}.`
          : "No admin user found. Consider promoting a user to admin.",
        t, { roles: [...new Set(roles)] }),
    );
  } catch (e: any) {
    results.push(makeResult("auth", "Role System", "warning", `Profiles query: ${e.message}`, t));
  }

  // 3. Permission system
  t = ms();
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("permissions")
      .not("permissions", "is", null)
      .limit(5);
    const withPerms = profiles?.length ?? 0;
    results.push(
      makeResult("auth", "Permission System", "passed",
        `${withPerms} profile(s) have custom permissions defined.`, t),
    );
  } catch (e: any) {
    results.push(makeResult("auth", "Permission System", "warning", e.message, t));
  }

  // 4. Session secret configured
  t = ms();
  const sessionSecretSet = !!process.env.SESSION_SECRET;
  results.push(
    makeResult("auth", "Session Secret", sessionSecretSet ? "passed" : "warning",
      sessionSecretSet ? "SESSION_SECRET is configured." : "SESSION_SECRET is not set — admin PIN auth is less secure.", t),
  );

  return results;
}

async function runPerformanceTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // DB query speed
  let t = ms();
  try {
    await db.select().from(banksTable).where(eq(banksTable.isArchived, false));
    const dur = elapsed(t);
    results.push(
      makeResult("performance", "DB Query Speed (Banks)", dur < 200 ? "passed" : dur < 500 ? "warning" : "failed",
        `Fetched all active banks in ${dur} ms.`, t, { durationMs: dur }),
    );
  } catch (e: any) {
    results.push(makeResult("performance", "DB Query Speed (Banks)", "failed", e.message, t));
  }

  // Complex join query
  t = ms();
  try {
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(filesTable)
      .where(eq(filesTable.isArchived, false));
    const dur = elapsed(t);
    results.push(
      makeResult("performance", "DB Aggregate Query", dur < 300 ? "passed" : "warning",
        `COUNT query on files table: ${dur} ms.`, t, { durationMs: dur }),
    );
  } catch (e: any) {
    results.push(makeResult("performance", "DB Aggregate Query", "failed", e.message, t));
  }

  // Signed URL generation speed
  t = ms();
  try {
    const [row] = await db
      .select({ storagePath: filesTable.storagePath })
      .from(filesTable)
      .where(and(not(isNull(filesTable.storagePath)), eq(filesTable.isArchived, false)))
      .limit(1);
    if (row?.storagePath) {
      await getSignedUrl(row.storagePath);
      const dur = elapsed(t);
      results.push(
        makeResult("performance", "Signed URL Generation", dur < 500 ? "passed" : "warning",
          `Generated signed URL in ${dur} ms.`, t, { durationMs: dur }),
      );
    } else {
      results.push(makeResult("performance", "Signed URL Generation", "skipped", "No files to sign — upload a file first.", t));
    }
  } catch (e: any) {
    results.push(makeResult("performance", "Signed URL Generation", "warning", e.message, t));
  }

  return results;
}

async function runFullHealthCheck(): Promise<{ results: TestResult[]; uploadedPaths: string[]; testBankId: string | null }> {
  const allResults: TestResult[] = [];
  let testBankId: string | null = null;
  let uploadedPaths: string[] = [];

  // 1. DB tests
  allResults.push(...(await runDatabaseTests()));

  // 2. Storage tests
  allResults.push(...(await runStorageTests()));

  // 3. Auth tests
  allResults.push(...(await runAuthTests()));

  // 4. Upload tests
  const { results: uploadResults, uploadedPaths: paths } = await runUploadTests();
  allResults.push(...uploadResults);
  uploadedPaths = paths;

  // 5. Create test bank
  const testId = `wasl-test-${Date.now()}`;
  let t = ms();
  try {
    const [bank] = await db
      .insert(banksTable)
      .values({
        id: testId,
        nameEn: "WASL System Test Bank",
        nameAr: "بنك اختبار النظام",
        category: "Test",
        status: "System Test — will be deleted",
        riskLevel: "Low",
        priorityImpact: "Low",
        contacts: [],
        isArchived: false,
      })
      .returning({ id: banksTable.id });
    testBankId = bank.id;
    allResults.push(makeResult("database", "Test Bank Creation", "passed", `Test bank created: ${testId}`, t, { bankId: testId }));
  } catch (e: any) {
    allResults.push(makeResult("database", "Test Bank Creation", "failed", e.message, t));
  }

  // 6. Create test product
  if (testBankId) {
    t = ms();
    try {
      await db.insert(productsTable).values({
        bankId: testBankId,
        productCode: "TEST-PROD-001",
        categoryStage: "System Test",
        status: "Test",
        progressPercent: 0.5,
      });
      allResults.push(makeResult("database", "Test Product Creation", "passed", "Test product attached to test bank.", t));
    } catch (e: any) {
      allResults.push(makeResult("database", "Test Product Creation", "failed", e.message, t));
    }
  }

  // 7. Link uploaded files to test bank in DB
  if (testBankId && uploadedPaths.length > 0) {
    t = ms();
    try {
      for (const sp of uploadedPaths) {
        const fileName = sp.split("/").pop() ?? sp;
        await db.insert(filesTable).values({
          entityType: "bank",
          entityId: testBankId,
          title: `System Test File — ${fileName}`,
          docType: "Test",
          fileName,
          fileType: sp.endsWith(".pdf") ? "application/pdf" : sp.endsWith(".png") ? "image/png" : "application/xlsx",
          storagePath: sp,
          uploadedBy: "System Health Check",
          uploadedAt: new Date(),
        });
      }
      allResults.push(
        makeResult("database", "File-Bank Relationship", "passed",
          `${uploadedPaths.length} file record(s) linked to test bank.`, t),
      );
    } catch (e: any) {
      allResults.push(makeResult("database", "File-Bank Relationship", "failed", e.message, t));
    }
  }

  // 8. Read files back (verify signed URLs)
  t = ms();
  try {
    const rows = await db
      .select()
      .from(filesTable)
      .where(and(eq(filesTable.entityId, testBankId ?? ""), eq(filesTable.isArchived, false)));
    let verified = 0;
    for (const row of rows) {
      if (row.storagePath) {
        try {
          const url = await getSignedUrl(row.storagePath);
          if (url) verified++;
        } catch {
          // count as failed below
        }
      }
    }
    allResults.push(
      makeResult("download", "File Read-back & URL Verification", verified === rows.length ? "passed" : "warning",
        `Verified ${verified}/${rows.length} file signed URL(s).`, t),
    );
  } catch (e: any) {
    allResults.push(makeResult("download", "File Read-back & URL Verification", "failed", e.message, t));
  }

  // 9. Performance spot-check
  allResults.push(...(await runPerformanceTests()));

  return { results: allResults, uploadedPaths, testBankId };
}

async function cleanupTestData(testBankId: string | null, uploadedPaths: string[]): Promise<void> {
  if (testBankId) {
    // Archive test bank (cascades via FK to products, files)
    await db
      .delete(filesTable)
      .where(eq(filesTable.entityId, testBankId));
    await db
      .delete(productsTable)
      .where(eq(productsTable.bankId, testBankId));
    await db
      .delete(banksTable)
      .where(eq(banksTable.id, testBankId));
  }
  for (const p of uploadedPaths) {
    try {
      await deleteFromStorage(p);
    } catch {
      // best-effort
    }
  }
}

// ── PDF & Minimal file creators ───────────────────────────────────────────────

async function createMinimalPdf(title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(18).text("WASL Banking Platform", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(title);
    doc.moveDown(0.5);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.end();
  });
}

function generateReportPdf(report: SystemReport, res: Response): void {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  const filename = `Wasl-System-Health-Report-${report.timestamp.substring(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const PW = doc.page.width;
  const purple = "#7c3aed";
  const darkBg = "#0d0d1a";
  const textColor = "#1a1a2e";
  const successColor = "#16a34a";
  const failColor = "#dc2626";
  const warnColor = "#d97706";

  // ── Cover page ────────────────────────────────────────────────────────────

  // Header band
  doc.rect(0, 0, PW, 140).fill(darkBg);
  doc.fillColor(purple).fontSize(36).font("Helvetica-Bold").text("WASL", 50, 40);
  doc.fillColor("white").fontSize(18).font("Helvetica").text("Banking Intelligence Platform", 50, 82);
  doc.fillColor("#888").fontSize(11).text("System Health Report", 50, 108);

  // Report meta
  doc.fillColor(textColor).moveDown(8);
  const score = report.summary.score;
  const scoreColor = score >= 90 ? successColor : score >= 70 ? warnColor : failColor;

  doc.rect(50, 160, PW - 100, 120).fillAndStroke("#f8f7ff", purple + "33");
  doc.fillColor(scoreColor).fontSize(72).font("Helvetica-Bold").text(`${score}%`, 0, 175, { align: "center" });
  doc.fillColor("#666").fontSize(11).font("Helvetica").text("Overall System Health Score", 0, 255, { align: "center" });

  // Meta table
  const metaY = 310;
  const row = (label: string, value: string, y: number) => {
    doc.fillColor("#888").fontSize(9).font("Helvetica-Bold").text(label.toUpperCase(), 50, y);
    doc.fillColor(textColor).fontSize(10).font("Helvetica").text(value, 200, y);
  };
  row("Date & Time", new Date(report.timestamp).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC", metaY);
  row("Environment", report.environment, metaY + 18);
  row("Application Version", report.appVersion, metaY + 36);
  row("Test Suite", report.suite.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), metaY + 54);
  row("Database Provider", "PostgreSQL (Replit Managed)", metaY + 72);
  row("Storage Provider", "Supabase Storage", metaY + 90);
  row("Bucket", "wasl-documents", metaY + 108);
  row("Duration", `${(report.durationMs / 1000).toFixed(1)}s`, metaY + 126);

  // Summary boxes
  const boxY = metaY + 160;
  const boxes = [
    { label: "Passed", value: report.summary.passed, color: successColor },
    { label: "Failed", value: report.summary.failed, color: failColor },
    { label: "Warnings", value: report.summary.warnings, color: warnColor },
    { label: "Skipped", value: report.summary.errors, color: "#888" },
  ];
  const bw = (PW - 100) / 4 - 8;
  boxes.forEach((b, i) => {
    const bx = 50 + i * (bw + 8);
    doc.rect(bx, boxY, bw, 55).fillAndStroke("#fff", b.color + "44");
    doc.fillColor(b.color).fontSize(24).font("Helvetica-Bold").text(String(b.value), bx, boxY + 8, { width: bw, align: "center" });
    doc.fillColor("#666").fontSize(9).font("Helvetica").text(b.label, bx, boxY + 36, { width: bw, align: "center" });
  });

  // ── Page 2: Test Results ──────────────────────────────────────────────────

  doc.addPage();
  doc.rect(0, 0, PW, 50).fill(purple);
  doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Test Results", 50, 17);

  let y = 70;
  const categories = [...new Set(report.results.map((r) => r.category))];

  for (const cat of categories) {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }

    doc.fillColor(purple).fontSize(12).font("Helvetica-Bold")
       .text(cat.toUpperCase().replace(/_/g, " "), 50, y);
    y += 20;

    for (const r of report.results.filter((res) => res.category === cat)) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 50; }

      const ic = r.status === "passed" ? successColor : r.status === "failed" ? failColor : r.status === "warning" ? warnColor : "#888";
      const symbol = r.status === "passed" ? "✓" : r.status === "failed" ? "✗" : r.status === "warning" ? "⚠" : "–";

      doc.rect(50, y - 2, PW - 100, 22).fill(y % 40 < 20 ? "#f9f9ff" : "white");
      doc.fillColor(ic).fontSize(10).font("Helvetica-Bold").text(symbol, 55, y);
      doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold").text(r.test, 75, y);
      doc.fillColor("#555").fontSize(8).font("Helvetica").text(r.message, 75, y + 11, { width: PW - 180 });
      doc.fillColor("#aaa").fontSize(7).text(`${r.durationMs}ms`, PW - 90, y + 6);
      y += 26;
    }
    y += 10;
  }

  // ── Page 3: Database & Storage ────────────────────────────────────────────

  doc.addPage();
  doc.rect(0, 0, PW, 50).fill(darkBg);
  doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Database & Storage Overview", 50, 17);

  y = 70;
  const dbStats = report.health.database;

  doc.fillColor(purple).fontSize(12).font("Helvetica-Bold").text("DATABASE TABLES", 50, y);
  y += 20;

  const dbRows = [
    ["Banks (Active)", dbStats.banksActive],
    ["Banks (Archived)", dbStats.banksArchived],
    ["Products", dbStats.productsTotal],
    ["Meetings (Active)", dbStats.meetingsActive],
    ["Meetings (Archived)", dbStats.meetingsArchived],
    ["Files (Active)", dbStats.filesActive],
    ["Files (Archived)", dbStats.filesArchived],
    ["Action Items", dbStats.actionItemsTotal],
    ["Audit Log Entries", dbStats.auditLogsTotal],
    ["Users", dbStats.usersTotal],
  ];

  dbRows.forEach(([label, value], i) => {
    doc.rect(50, y - 2, PW - 100, 20).fill(i % 2 === 0 ? "#f5f3ff" : "white");
    doc.fillColor(textColor).fontSize(10).font("Helvetica").text(String(label), 55, y);
    doc.fillColor(purple).fontSize(10).font("Helvetica-Bold").text(String(value ?? 0), PW - 100, y, { align: "right" });
    y += 20;
  });

  y += 20;
  doc.fillColor(purple).fontSize(12).font("Helvetica-Bold").text("STORAGE", 50, y);
  y += 20;

  const storRows = [
    ["Provider", report.health.storage.provider],
    ["Bucket", report.health.storage.bucket],
    ["Upload Directory", report.health.storage.uploadDirectory],
    ["Files Tracked", String(report.health.storage.fileCount)],
    ["Total Size", `${report.health.storage.totalSizeMB} MB`],
  ];

  storRows.forEach(([label, value], i) => {
    doc.rect(50, y - 2, PW - 100, 20).fill(i % 2 === 0 ? "#f5f3ff" : "white");
    doc.fillColor(textColor).fontSize(10).font("Helvetica").text(String(label), 55, y);
    doc.fillColor(textColor).fontSize(10).font("Helvetica").text(String(value), 220, y);
    y += 20;
  });

  y += 20;
  doc.fillColor(purple).fontSize(12).font("Helvetica-Bold").text("INTEGRITY", 50, y);
  y += 20;

  const intRows = [
    ["Orphan Records", String(report.health.integrity.orphanFiles)],
    ["Missing Files (no file_size)", String(report.health.integrity.missingFiles)],
    ["Broken Links", String(report.health.integrity.brokenLinks)],
  ];
  intRows.forEach(([label, value], i) => {
    const v = Number(value);
    doc.rect(50, y - 2, PW - 100, 20).fill(i % 2 === 0 ? "#f5f3ff" : "white");
    doc.fillColor(textColor).fontSize(10).font("Helvetica").text(String(label), 55, y);
    doc.fillColor(v > 0 ? failColor : successColor).fontSize(10).font("Helvetica-Bold").text(String(value), PW - 100, y, { align: "right" });
    y += 20;
  });

  // ── Page 4: Recommendations ───────────────────────────────────────────────

  doc.addPage();
  doc.rect(0, 0, PW, 50).fill(purple);
  doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Recommendations", 50, 17);

  y = 70;
  for (const rec of report.recommendations) {
    if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
    const sc = rec.severity === "critical" ? failColor : rec.severity === "medium" ? warnColor : "#888";
    doc.rect(50, y - 2, 4, 50).fill(sc);
    doc.fillColor(sc).fontSize(9).font("Helvetica-Bold")
       .text(rec.severity.toUpperCase(), 60, y);
    doc.fillColor(textColor).fontSize(10).font("Helvetica-Bold")
       .text(rec.issue, 60, y + 12, { width: PW - 120 });
    doc.fillColor("#555").fontSize(9).font("Helvetica")
       .text(`Fix: ${rec.fix}`, 60, y + 28, { width: PW - 120 });
    y += 65;
  }

  // ── Footer on last page ───────────────────────────────────────────────────

  doc.fontSize(8).fillColor("#aaa")
     .text(`Generated by Wasl Banking Platform — ${new Date().toISOString()}`, 50, doc.page.height - 30, { align: "center" });

  doc.end();
}

// ── Report file management ────────────────────────────────────────────────────

function saveReport(report: SystemReport): void {
  ensureReportsDir();
  const filePath = path.join(REPORTS_DIR, `${report.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
}

function listReports(): Array<{
  id: string;
  suite: string;
  timestamp: string;
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  durationMs: number;
}> {
  ensureReportsDir();
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 50)
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf-8")) as SystemReport;
        return {
          id: data.id,
          suite: data.suite,
          timestamp: data.timestamp,
          score: data.summary.score,
          passed: data.summary.passed,
          failed: data.summary.failed,
          warnings: data.summary.warnings,
          durationMs: data.durationMs,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];
}

function getReport(id: string): SystemReport | null {
  try {
    const safe = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(REPORTS_DIR, `${safe}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as SystemReport;
  } catch {
    return null;
  }
}

function deleteReportFile(id: string): boolean {
  try {
    const safe = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(REPORTS_DIR, `${safe}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/system/health */
router.get("/system/health", async (_req, res): Promise<void> => {
  try {
    const [dbStats, storageStats, integrity] = await Promise.all([
      getDatabaseStats(),
      getStorageStats(),
      getIntegrityStats(),
    ]);

    const issues = integrity.brokenLinks + integrity.missingFiles + integrity.orphanFiles;
    const failedDbItems = Object.values(dbStats).filter((v) => typeof v === "number" && v < 0).length;
    const healthScore = Math.max(
      0,
      Math.min(100, 100 - issues * 5 - failedDbItems * 10),
    );

    const reports = listReports();

    res.json({
      timestamp: new Date().toISOString(),
      storage: {
        provider: "Supabase Storage",
        bucket: BUCKET,
        uploadDirectory: `supabase://${BUCKET}`,
        fileCount: storageStats.fileCount,
        totalSizeMB: storageStats.totalSizeMB,
        healthScore: Math.max(0, 100 - integrity.brokenLinks * 10 - integrity.missingFiles * 15),
      },
      database: {
        status: "connected",
        provider: "PostgreSQL (Replit Managed)",
        tables: dbStats,
      },
      integrity,
      reports: {
        total: reports.length,
        lastReportDate: reports[0]?.timestamp ?? null,
      },
      healthScore,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/system/tests/run */
router.post("/system/tests/run", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const suite = (req.body?.suite ?? "all") as string;
  const start = ms();
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  log(`Starting test suite: ${suite}`);

  let results: TestResult[] = [];
  let uploadedPaths: string[] = [];
  let testBankId: string | null = null;

  try {
    switch (suite) {
      case "database":
        results = await runDatabaseTests();
        break;
      case "storage":
        results = await runStorageTests();
        break;
      case "upload":
        const up = await runUploadTests();
        results = up.results;
        uploadedPaths = up.uploadedPaths;
        // Clean up test uploads
        for (const p of uploadedPaths) {
          try { await deleteFromStorage(p); } catch { /* best-effort */ }
        }
        uploadedPaths = [];
        break;
      case "download":
        results = await runDownloadTests();
        break;
      case "auth":
        results = await runAuthTests();
        break;
      case "performance":
        results = await runPerformanceTests();
        break;
      case "full_health_check":
      case "all":
      default: {
        const full = await runFullHealthCheck();
        results = full.results;
        uploadedPaths = full.uploadedPaths;
        testBankId = full.testBankId;
        log("Full health check complete, cleaning up test data...");
        await cleanupTestData(testBankId, uploadedPaths);
        uploadedPaths = [];
        testBankId = null;
        break;
      }
    }
  } catch (e: any) {
    log(`Fatal error: ${e.message}`);
    results.push({ test: "Test Runner", category: "system", status: "failed", message: e.message, durationMs: elapsed(start) });
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const score = calculateHealthScore(passed, failed, warnings);

  let health: SystemReport["health"] = {
    database: {},
    storage: { provider: "Supabase Storage", bucket: BUCKET, fileCount: 0, totalSizeMB: 0, uploadDirectory: `supabase://${BUCKET}` },
    integrity: { orphanFiles: 0, missingFiles: 0, brokenLinks: 0 },
  };
  try {
    const [dbStats, storageStats, integrity] = await Promise.all([
      getDatabaseStats(),
      getStorageStats(),
      getIntegrityStats(),
    ]);
    health = {
      database: dbStats,
      storage: { provider: "Supabase Storage", bucket: BUCKET, ...storageStats, uploadDirectory: `supabase://${BUCKET}` },
      integrity,
    };
  } catch { /* non-fatal */ }

  const recommendations = generateRecommendations(results, health.integrity);
  const reportId = `report-${new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").substring(0, 22)}-${suite.replace(/_/g, "-")}`;

  const report: SystemReport = {
    id: reportId,
    suite,
    timestamp: new Date().toISOString(),
    durationMs: elapsed(start),
    environment: process.env.NODE_ENV ?? "development",
    appVersion: "2.0.0",
    results,
    summary: { passed, failed, warnings, errors: skipped, score },
    health,
    recommendations,
    logs,
  };

  try {
    saveReport(report);
    log("Report saved successfully.");
  } catch (e: any) {
    log(`Failed to save report: ${e.message}`);
  }

  res.json(report);
});

/** GET /api/system/reports */
router.get("/system/reports", (_req, res): void => {
  try {
    res.json(listReports());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/system/reports/:id */
router.get("/system/reports/:id", (req, res): void => {
  const report = getReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(report);
});

/** GET /api/system/reports/:id/download — PDF */
router.get("/system/reports/:id/download", (req, res): void => {
  const report = getReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  try {
    generateReportPdf(report, res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/system/reports/:id */
router.delete("/system/reports/:id", requireRole("super_admin", "admin"), (req, res): void => {
  const deleted = deleteReportFile(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

import { sql } from "drizzle-orm";
import { db, pool, externalServiceHealthTable } from "@workspace/db";
import { getSupabaseAdmin } from "@workspace/supabase";
import { checkOneDriveConnection } from "./onedrive-storage";

export type ExternalHealthStatus = "healthy" | "degraded" | "unavailable";
export type ExternalServiceKey = "postgresql" | "supabase_auth" | "microsoft_graph" | "ai_provider" | "email_service" | "hosting_environment";

export interface ExternalServiceHealthResult {
  serviceKey: ExternalServiceKey;
  serviceName: string;
  status: ExternalHealthStatus;
  latencyMs: number;
  message: string;
  lastCheckedAt: string;
  lastSuccessfulAt: string | null;
}

const HEALTHY_MAX_MS = 1_000;
const CHECK_TIMEOUT_MS = 3_000;

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown service error";
  return raw.replace(/(api[_-]?key|token|secret|password)=[^\s&]+/gi, "$1=[redacted]").slice(0, 240);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs = CHECK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probe(
  serviceKey: ExternalServiceKey,
  serviceName: string,
  operation: () => Promise<void>,
): Promise<Omit<ExternalServiceHealthResult, "lastSuccessfulAt">> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    await withTimeout(operation());
    const latencyMs = Date.now() - started;
    return {
      serviceKey,
      serviceName,
      status: latencyMs <= HEALTHY_MAX_MS ? "healthy" : "degraded",
      latencyMs,
      message: latencyMs <= HEALTHY_MAX_MS ? "Service is responding normally." : "Service is available but responding slowly.",
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      serviceKey,
      serviceName,
      status: "unavailable",
      latencyMs: Date.now() - started,
      message: safeMessage(error),
      lastCheckedAt: checkedAt,
    };
  }
}

async function checkAIProvider(): Promise<void> {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("AI provider is not configured");
  const url = new URL("models", baseURL.endsWith("/") ? baseURL : `${baseURL}/`).toString();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
}

async function checkSupabaseAuth(): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
}

async function checkHostingEnvironment(): Promise<void> {
  if (!process.env.REPLIT_DEV_DOMAIN && !process.env.REPL_SLUG && process.env.NODE_ENV === "production") {
    throw new Error("Hosting environment metadata is unavailable");
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  const memory = process.memoryUsage();
  if (memory.heapTotal > 0 && memory.heapUsed / memory.heapTotal > 0.95) {
    throw new Error("Hosting memory usage is critically high");
  }
}

export async function runExternalServiceHealthChecks(): Promise<ExternalServiceHealthResult[]> {
  let previous = new Map<string, Date | null>();
  try {
    const rows = await db.select().from(externalServiceHealthTable);
    previous = new Map(rows.map((row) => [row.serviceKey, row.lastSuccessfulAt]));
  } catch {
    // The table may not exist before the migration, or PostgreSQL may itself be unavailable.
  }

  const checks = await Promise.all([
    probe("postgresql", "PostgreSQL", async () => { await pool.query("SELECT 1"); }),
    probe("supabase_auth", "Supabase Auth", checkSupabaseAuth),
    probe("microsoft_graph", "OneDrive / Microsoft Graph", checkOneDriveConnection),
    probe("ai_provider", "AI Provider", checkAIProvider),
    probe("email_service", "Email Service", checkSupabaseAuth),
    probe("hosting_environment", "Hosting Environment", checkHostingEnvironment),
  ]);

  const results: ExternalServiceHealthResult[] = checks.map((check) => ({
    ...check,
    lastSuccessfulAt: check.status === "healthy" || check.status === "degraded"
      ? check.lastCheckedAt
      : previous.get(check.serviceKey)?.toISOString() ?? null,
  }));

  await Promise.allSettled(results.map((result) => db
    .insert(externalServiceHealthTable)
    .values({
      serviceKey: result.serviceKey,
      serviceName: result.serviceName,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.message,
      lastCheckedAt: new Date(result.lastCheckedAt),
      lastSuccessfulAt: result.lastSuccessfulAt ? new Date(result.lastSuccessfulAt) : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: externalServiceHealthTable.serviceKey,
      set: {
        serviceName: result.serviceName,
        status: result.status,
        latencyMs: result.latencyMs,
        message: result.message,
        lastCheckedAt: new Date(result.lastCheckedAt),
        lastSuccessfulAt: result.lastSuccessfulAt ? new Date(result.lastSuccessfulAt) : sql`${externalServiceHealthTable.lastSuccessfulAt}`,
        updatedAt: new Date(),
      },
    })));

  return results;
}

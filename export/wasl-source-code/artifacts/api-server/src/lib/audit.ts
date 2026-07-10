import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export type AuditAction = "CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE";

/** Records an entry in the enterprise audit trail. Never throws to the caller's request flow beyond logging. */
export async function logAudit(
  req: Request,
  params: {
    action: AuditAction;
    entityType: string;
    entityId?: string | number;
    entityLabel?: string | null;
    details?: unknown;
  },
): Promise<void> {
  const actor = req.authUser;
  await db.insert(auditLogsTable).values({
    userId: actor?.id ?? null,
    userName: actor?.name ?? null,
    userEmail: actor?.email ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId != null ? String(params.entityId) : null,
    entityLabel: params.entityLabel ?? null,
    details: params.details ?? null,
  });
}

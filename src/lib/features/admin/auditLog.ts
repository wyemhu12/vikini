// Audit log helper - writes admin actions to admin_audit_logs table
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";

interface AuditEvent {
  action: string;
  adminId: string;
  adminEmail?: string;
  targetId?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin action to the audit_logs table.
 * Gracefully falls back to console logging if the table doesn't exist.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const logCtx = logger.withContext("AuditLog");

  // Always log to console as well
  logCtx.audit(event.action, event.adminId, {
    targetId: event.targetId,
    targetEmail: event.targetEmail,
    details: event.details,
  });

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("admin_audit_logs").insert({
      action: event.action,
      admin_id: event.adminId,
      admin_email: event.adminEmail || null,
      target_id: event.targetId || null,
      target_email: event.targetEmail || null,
      details: event.details || {},
    });

    if (error) {
      // Table might not exist yet - graceful degradation
      logCtx.warn("Failed to write audit log to DB (table may not exist yet)", {
        error: error.message,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logCtx.warn("Audit log DB write failed", { error: message });
  }
}

// Admin API route - Audit log viewer
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: Fetch audit logs (newest first, max 100)
export async function GET() {
  try {
    await requireAdminUser();

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (dbError) {
      // Table might not exist yet
      if (dbError.message.includes("does not exist") || dbError.code === "42P01") {
        return success({ logs: [], tableExists: false });
      }
      throw new Error(dbError.message);
    }

    return success({ logs: data || [], tableExists: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch audit logs", 500);
  }
}

// Admin API route - Audit log viewer
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: Fetch audit logs (newest first, max 100)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

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

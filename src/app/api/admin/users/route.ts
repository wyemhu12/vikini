// Admin API route - User management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logAuditEvent } from "@/lib/features/admin/auditLog";

// SECURITY: Whitelist of valid user ranks - prevents rank injection attacks
const VALID_RANKS = ["basic", "pro", "admin", "not_whitelisted"] as const;
type UserRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is UserRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as UserRank);
}

// SECURITY: Validate userId format - accepts both UUID and Google numeric IDs
const SAFE_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GOOGLE_ID_REGEX = /^\d{10,30}$/;

function isValidUserId(id: unknown): boolean {
  return typeof id === "string" && (SAFE_ID_REGEX.test(id) || GOOGLE_ID_REGEX.test(id));
}

// Type for profile updates
interface ProfileUpdates {
  rank?: UserRank;
  is_blocked?: boolean;
}

// GET: List all users
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) throw new Error(dbError.message);

    return success({ users: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list users", 500);
  }
}

// PATCH: Update user rank or blocked status
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const body = (await req.json()) as { userId?: string; rank?: unknown; is_blocked?: unknown };
    const { userId, rank, is_blocked } = body;

    if (!userId || typeof userId !== "string") {
      throw new ValidationError("Missing or invalid userId");
    }

    // SECURITY: Validate userId format
    if (!isValidUserId(userId)) {
      throw new ValidationError("Invalid userId format");
    }

    // SECURITY: Validate rank against whitelist to prevent injection
    if (rank !== undefined && !isValidRank(rank)) {
      throw new ValidationError(`Invalid rank. Must be one of: ${VALID_RANKS.join(", ")}`);
    }

    const updates: ProfileUpdates = {};
    if (rank !== undefined && isValidRank(rank)) {
      updates.rank = rank;
    }
    if (typeof is_blocked === "boolean") {
      updates.is_blocked = is_blocked;
    }

    // Ensure at least one field is being updated
    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from("profiles").update(updates).eq("id", userId);

    if (dbError) throw new Error(dbError.message);

    // Resolve target email for audit log
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    // Determine audit action
    let action = "UPDATE_USER_RANK";
    if (updates.is_blocked === true) action = "BLOCK_USER";
    else if (updates.is_blocked === false) action = "UNBLOCK_USER";

    await logAuditEvent({
      action,
      adminId: session.user.id,
      adminEmail: session.user.email || undefined,
      targetId: userId,
      targetEmail: targetProfile?.email || undefined,
      details: updates as Record<string, unknown>,
    });

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update user", 500);
  }
}

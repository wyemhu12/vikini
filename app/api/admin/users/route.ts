// Admin API route - User management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// SECURITY: Whitelist of valid user ranks - prevents rank injection attacks
const VALID_RANKS = ["basic", "pro", "admin", "not_whitelisted"] as const;
type UserRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is UserRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as UserRank);
}

// SECURITY: UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
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

    // SECURITY: Validate userId is a valid UUID
    if (!isValidUUID(userId)) {
      throw new ValidationError("Invalid userId format - must be a valid UUID");
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

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update user", 500);
  }
}

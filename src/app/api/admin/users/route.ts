// Admin API route - User management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import {
  ForbiddenError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  AppError,
} from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logAuditEvent } from "@/lib/features/admin/auditLog";
import { bumpAuthVersion } from "@/lib/features/auth/authRevocation";

// SECURITY: Whitelist of valid user ranks - prevents rank injection attacks
const VALID_RANKS = ["basic", "pro", "admin", "not_whitelisted"] as const;
type UserRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is UserRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as UserRank);
}

// SECURITY: Validate userId format - accepts email or UUID
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUserId(id: unknown): boolean {
  return typeof id === "string" && (EMAIL_REGEX.test(id) || UUID_REGEX.test(id));
}

// Type for profile updates
interface ProfileUpdates {
  rank?: UserRank;
  is_blocked?: boolean;
}

const DEFAULT_USERS_LIMIT = 1000;
const MAX_USERS_LIMIT = 1000;
const USER_PROFILE_COLUMNS = "id, email, rank, is_blocked, created_at";
const NON_NEGATIVE_INT_REGEX = /^\d+$/;

function parsePaginationParams(req?: NextRequest): { limit: number; offset: number } {
  const searchParams = req?.nextUrl?.searchParams;
  const limitRaw = searchParams?.get("limit");
  const offsetRaw = searchParams?.get("offset");

  let limit = DEFAULT_USERS_LIMIT;
  if (limitRaw !== null && limitRaw !== undefined && limitRaw !== "") {
    if (!NON_NEGATIVE_INT_REGEX.test(limitRaw)) {
      throw new ValidationError("limit must be a positive integer");
    }
    const parsedLimit = Number(limitRaw);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0) {
      throw new ValidationError("limit must be a positive integer");
    }
    limit = Math.min(parsedLimit, MAX_USERS_LIMIT);
  }

  let offset = 0;
  if (offsetRaw !== null && offsetRaw !== undefined && offsetRaw !== "") {
    if (!NON_NEGATIVE_INT_REGEX.test(offsetRaw)) {
      throw new ValidationError("offset must be a non-negative integer");
    }
    const parsedOffset = Number(offsetRaw);
    if (!Number.isSafeInteger(parsedOffset) || parsedOffset < 0) {
      throw new ValidationError("offset must be a non-negative integer");
    }
    offset = parsedOffset;
  }

  return { limit, offset };
}

// GET: List users with backward-compatible pagination
export async function GET(req?: NextRequest) {
  try {
    await requireAdminUser();
    const { limit, offset } = parsePaginationParams(req);

    const supabase = getSupabaseAdmin();
    const {
      data,
      count,
      error: dbError,
    } = await supabase
      .from("profiles")
      .select(USER_PROFILE_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) throw new DatabaseError(dbError.message);

    const users = data || [];
    const total = typeof count === "number" ? count : users.length;
    const hasMore = offset + users.length < total;

    return success({
      users,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list users", 500);
  }
}

// PATCH: Update user rank or blocked status
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdminUser();

    let body: { userId?: string; rank?: unknown; is_blocked?: unknown };
    try {
      body = (await req.json()) as { userId?: string; rank?: unknown; is_blocked?: unknown };
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
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

    // Look up user by id first (supports UUID and canonical email)
    let targetProfile: { id: string; email: string } | null = null;
    const { data: byId, error: byIdError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    if (byIdError) {
      throw new DatabaseError(`Failed to look up user: ${byIdError.message}`);
    }

    if (byId) {
      targetProfile = byId;
    } else {
      // Fallback lookup by canonical email
      const { data: byEmail, error: byEmailError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", userId.toLowerCase())
        .maybeSingle();

      if (byEmailError) {
        throw new DatabaseError(`Failed to look up user: ${byEmailError.message}`);
      }
      targetProfile = byEmail;
    }

    if (!targetProfile) {
      throw new NotFoundError("User");
    }

    // SECURITY: Prevent an administrator from modifying or locking out their own account
    if (
      targetProfile.id.toLowerCase() === admin.userId ||
      targetProfile.email?.toLowerCase() === admin.userId
    ) {
      throw new ForbiddenError("Cannot modify your own admin account");
    }

    const { error: dbError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", targetProfile.id);

    if (dbError) throw new Error(dbError.message);

    // SECURITY: Invalidate cached JWT rank for the target user (canonical email)
    const canonicalEmail = targetProfile.email?.toLowerCase() || targetProfile.id.toLowerCase();
    await bumpAuthVersion(canonicalEmail);

    // Determine audit action
    let action = "UPDATE_USER_RANK";
    if (updates.is_blocked === true) action = "BLOCK_USER";
    else if (updates.is_blocked === false) action = "UNBLOCK_USER";

    await logAuditEvent({
      action,
      adminId: admin.userId,
      adminEmail: admin.userId,
      targetId: targetProfile.id,
      targetEmail: targetProfile.email || undefined,
      details: updates as Record<string, unknown>,
    });

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update user", 500);
  }
}

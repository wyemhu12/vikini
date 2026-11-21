// Admin API route - System statistics
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { AppError, DatabaseError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: Fetch system statistics (or user-specific stats with ?userId=xxx)
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();

    const supabase = getSupabaseAdmin();
    const userIdParam = req.nextUrl.searchParams.get("userId");

    if (userIdParam) {
      // User-specific stats - normalize email
      const canonicalEmail = userIdParam.trim().toLowerCase();

      const [convRes, msgRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", canonicalEmail),
        supabase
          .from("messages")
          .select("id, conversations!messages_conversation_id_fkey!inner(user_id)", {
            count: "exact",
            head: true,
          })
          .eq("conversations.user_id", canonicalEmail),
      ]);

      if (convRes.error) {
        throw new DatabaseError(
          `Failed to fetch user conversation stats: ${convRes.error.message}`
        );
      }
      if (msgRes.error) {
        throw new DatabaseError(`Failed to fetch user message stats: ${msgRes.error.message}`);
      }

      return success({
        conversations: convRes.count || 0,
        messages: msgRes.count || 0,
      });
    }

    // Global stats (head-only exact counts avoid PostgREST 1,000-row cap)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [
      profilesTotal,
      profilesBlocked,
      profilesAdmin,
      profilesPro,
      profilesBasic,
      profilesNotWhitelisted,
      totalConvs,
      todayConvs,
      todayMsgs,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_blocked", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("rank", "admin"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("rank", "pro"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("rank", "basic"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("rank", "not_whitelisted"),
      supabase.from("conversations").select("*", { count: "exact", head: true }),
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayIso),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayIso),
    ]);

    const allResults = [
      profilesTotal,
      profilesBlocked,
      profilesAdmin,
      profilesPro,
      profilesBasic,
      profilesNotWhitelisted,
      totalConvs,
      todayConvs,
      todayMsgs,
    ];
    for (const result of allResults) {
      if (result.error) {
        throw new DatabaseError(`Failed to fetch stats: ${result.error.message}`);
      }
    }

    const totalUsers = profilesTotal.count || 0;
    const blockedUsers = profilesBlocked.count || 0;

    const userStats = {
      total: totalUsers,
      active: Math.max(0, totalUsers - blockedUsers),
      blocked: blockedUsers,
      byRank: {
        admin: profilesAdmin.count || 0,
        pro: profilesPro.count || 0,
        basic: profilesBasic.count || 0,
        not_whitelisted: profilesNotWhitelisted.count || 0,
      },
    };

    return success({
      users: userStats,
      conversations: { total: totalConvs.count || 0, today: todayConvs.count || 0 },
      messages: { today: todayMsgs.count || 0 },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch stats", 500);
  }
}

// Admin API route - System statistics
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: Fetch system statistics (or user-specific stats with ?userId=xxx)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const userId = req.nextUrl.searchParams.get("userId");

    if (userId) {
      // User-specific stats
      const { count: convCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: convIds } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId);

      let msgCount = 0;
      if (convIds && convIds.length > 0) {
        const ids = convIds.map((c: { id: string }) => c.id);
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", ids);
        msgCount = count || 0;
      }

      return success({
        conversations: convCount || 0,
        messages: msgCount,
      });
    }

    // Global stats
    const { data: profiles } = await supabase.from("profiles").select("rank, is_blocked");

    const userStats = {
      total: profiles?.length || 0,
      active: profiles?.filter((p: { is_blocked: boolean }) => !p.is_blocked).length || 0,
      blocked: profiles?.filter((p: { is_blocked: boolean }) => p.is_blocked).length || 0,
      byRank: {
        admin: profiles?.filter((p: { rank: string }) => p.rank === "admin").length || 0,
        pro: profiles?.filter((p: { rank: string }) => p.rank === "pro").length || 0,
        basic: profiles?.filter((p: { rank: string }) => p.rank === "basic").length || 0,
        not_whitelisted:
          profiles?.filter((p: { rank: string }) => p.rank === "not_whitelisted").length || 0,
      },
    };

    // Conversation count
    const { count: totalConvs } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayConvs } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    // Message count today
    const { count: todayMsgs } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    return success({
      users: userStats,
      conversations: { total: totalConvs || 0, today: todayConvs || 0 },
      messages: { today: todayMsgs || 0 },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch stats", 500);
  }
}

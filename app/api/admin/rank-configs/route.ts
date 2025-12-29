// Admin API route - Rank config management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { invalidateRankConfigsCache } from "@/lib/core/limits";

// GET: List all rank configs
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("rank_configs").select("*").order("rank");

    if (error) throw error;

    return NextResponse.json({ configs: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

// PATCH: Update rank configs
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return NextResponse.json({ error: "Invalid configs format" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Update each config
    for (const config of configs) {
      const { error } = await supabase
        .from("rank_configs")
        .update({
          daily_message_limit: config.daily_message_limit,
          max_file_size_mb: config.max_file_size_mb,
          features: config.features,
        })
        .eq("rank", config.rank);

      if (error) throw error;
    }

    // Invalidate cache so new configs take effect immediately
    await invalidateRankConfigsCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

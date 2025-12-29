// Admin API route - GEMs management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";

// GET: List all premade gems
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("gems")
      .select("id, name, description, icon, color, is_premade")
      .eq("is_premade", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json({ gems: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

// DELETE: Delete a premade gem
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const gemId = searchParams.get("id");

    if (!gemId) {
      return NextResponse.json({ error: "Missing gem ID" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("gems").delete().eq("id", gemId).eq("is_premade", true); // Safety: only delete premade gems

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

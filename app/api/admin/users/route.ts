// Admin API route - User management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";

// GET: List all users
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

// PATCH: Update user rank or blocked status
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, rank, is_blocked } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const updates: any = {};
    if (rank) updates.rank = rank;
    if (typeof is_blocked === "boolean") updates.is_blocked = is_blocked;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

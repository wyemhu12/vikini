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
    console.log("[AdminGEMs] Session:", session); // DEBUG
    if (!session?.user || session.user.rank !== "admin") {
      console.log("[AdminGEMs] Unauthorized. Rank:", session?.user?.rank); // DEBUG
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("gems")
      .select("id, name, description, instructions, icon, color, is_premade")
      .eq("is_premade", true)
      .order("name");

    if (error) {
      console.error("[AdminGEMs] DB Error:", error); // DEBUG
      throw error;
    }

    return NextResponse.json({ gems: data });
  } catch (error: any) {
    console.error("[AdminGEMs] Catch Error:", error); // DEBUG
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

// POST: Create a new premade gem
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const json = await req.json();
    const { name, description, instructions, icon, color } = json;

    if (!name || !instructions) {
      return NextResponse.json({ error: "Name and instructions are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("gems")
      .insert({
        name,
        description,
        instructions,
        icon,
        color,
        is_premade: true,
        user_id: session.user.id, // Optional: link to admin who created it, or null depending on schema
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ gem: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

// PUT: Update an existing premade gem
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const json = await req.json();
    const { id, name, description, instructions, icon, color } = json;

    if (!id || !name || !instructions) {
      return NextResponse.json(
        { error: "ID, Name and instructions are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("gems")
      .update({
        name,
        description,
        instructions,
        icon,
        color,
      })
      .eq("id", id)
      .eq("is_premade", true)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ gem: data });
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

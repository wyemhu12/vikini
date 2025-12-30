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
    // Use select("*") to be robust against schema mismatches, and filter properly
    const { data: rawData, error } = await supabase
      .from("gems")
      .select("*")
      .eq("is_premade", true)
      .order("name");

    console.log("[AdminGEMs] Actual columns:", rawData?.[0] ? Object.keys(rawData[0]) : "No data");

    if (error) {
      console.error("[AdminGEMs] DB Error:", error); // DEBUG
      throw error;
    }

    // Enrich with latest gem_versions
    const ids = (rawData || []).map((g) => g.id);
    const latestByGem = new Map<string, string>();

    if (ids.length > 0) {
      const { data: versions } = await supabase
        .from("gem_versions")
        .select("gem_id,version,instructions")
        .in("gem_id", ids)
        .order("version", { ascending: false });

      if (versions) {
        for (const v of versions) {
          // Since ordered by version desc, first one we see is latest
          if (!latestByGem.has(v.gem_id)) {
            latestByGem.set(v.gem_id, v.instructions || "");
          }
        }
      }
    }

    // Map DB column `instruction` to Frontend field `instructions` if needed
    const gems = rawData?.map((g: any) => {
      const fallback = g.instructions || g.instruction || "";
      const latest = latestByGem.get(g.id);
      return {
        ...g,
        instructions: typeof latest === "string" ? latest : fallback,
      };
    });

    return NextResponse.json({ gems });
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

    // Validate inputs
    if (!name || !instructions) {
      return NextResponse.json({ error: "Name and instructions are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // 1. Insert into gems (metadata only)
    const { data, error } = await supabase
      .from("gems")
      .insert({
        name,
        description,
        // instruction: instructions, // REMOVED: Column does not exist
        icon,
        color,
        is_premade: true,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Insert into gem_versions (content)
    let versionedInstructions = "";
    if (data?.id) {
      // Check standard library usage for version insertion
      // We'll reimplement simplified version here to avoid circular dependencies with `lib/features/gems` if it's client-side mixed
      // Actually we can try to use the `gem_versions` table directly
      const { data: vData, error: vError } = await supabase
        .from("gem_versions")
        .insert({
          gem_id: data.id,
          version: 1,
          instructions: instructions,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (!vError && vData) {
        versionedInstructions = vData.instructions;
      } else {
        console.error("Failed to insert gem_version:", vError);
        // Fallback? If version fails, we have a broken gem.
        // But the user error is specifically about the COLUMN on 'gems'.
      }
    }

    // Map back for response
    const gem = {
      ...data,
      instructions: versionedInstructions || instructions,
    };

    return NextResponse.json({ gem });
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

    // 1. Update gems table (metadata only)
    const updatePayload = {
      name,
      description,
      // instruction: instructions, // REMOVED
      icon,
      color,
    };

    const { data, error } = await supabase
      .from("gems")
      .update(updatePayload)
      .eq("id", id)
      .eq("is_premade", true)
      .select()
      .single();

    if (error) throw error;

    // 2. Create new gem_version
    // Find latest version first
    const { data: latest } = await supabase
      .from("gem_versions")
      .select("version")
      .eq("gem_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version || 0) + 1;

    const { data: vData, error: vError } = await supabase
      .from("gem_versions")
      .insert({
        gem_id: id,
        version: nextVersion,
        instructions: instructions,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (vError) {
      console.error("Failed to insert gem_version update:", vError);
    }

    // Map back for response
    const gem = {
      ...data,
      instructions: vData?.instructions || instructions,
    };

    return NextResponse.json({ gem });
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

// Admin API route - GEMs management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: List all premade gems
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const { data: rawData, error: dbError } = await supabase
      .from("gems")
      .select("*")
      .eq("is_premade", true)
      .order("name");

    if (dbError) throw new Error(dbError.message);

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
          if (!latestByGem.has(v.gem_id)) {
            latestByGem.set(v.gem_id, v.instructions || "");
          }
        }
      }
    }

    interface GemRow {
      id: string;
      name: string;
      description?: string;
      instructions?: string;
      instruction?: string;
      icon?: string;
      color?: string;
      is_premade: boolean;
      user_id?: string;
    }

    const gems = rawData?.map((g: GemRow) => {
      const fallback = g.instructions || g.instruction || "";
      const latest = latestByGem.get(g.id);
      return {
        ...g,
        instructions: typeof latest === "string" ? latest : fallback,
      };
    });

    return success({ gems });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list gems", 500);
  }
}

// POST: Create a new premade gem
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const json = await req.json();
    const { name, description, instructions, icon, color } = json;

    if (!name || !instructions) {
      throw new ValidationError("Name and instructions are required");
    }

    const supabase = getSupabaseAdmin();
    // 1. Insert into gems (metadata only)
    const { data, error: dbError } = await supabase
      .from("gems")
      .insert({
        name,
        description,
        icon,
        color,
        is_premade: true,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // 2. Insert into gem_versions (content)
    let versionedInstructions = "";
    if (data?.id) {
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
      }
    }

    const gem = {
      ...data,
      instructions: versionedInstructions || instructions,
    };

    return success({ gem });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to create gem", 500);
  }
}

// PUT: Update an existing premade gem
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const json = await req.json();
    const { id, name, description, instructions, icon, color } = json;

    if (!id || !name || !instructions) {
      throw new ValidationError("ID, Name and instructions are required");
    }

    const supabase = getSupabaseAdmin();

    const updatePayload = {
      name,
      description,
      icon,
      color,
    };

    const { data, error: dbError } = await supabase
      .from("gems")
      .update(updatePayload)
      .eq("id", id)
      .eq("is_premade", true)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // 2. Create new gem_version
    const { data: latest } = await supabase
      .from("gem_versions")
      .select("version")
      .eq("gem_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version || 0) + 1;

    const { data: vData } = await supabase
      .from("gem_versions")
      .insert({
        gem_id: id,
        version: nextVersion,
        instructions: instructions,
        created_by: session.user.id,
      })
      .select()
      .single();

    const gem = {
      ...data,
      instructions: vData?.instructions || instructions,
    };

    return success({ gem });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update gem", 500);
  }
}

// DELETE: Delete a premade gem
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const { searchParams } = new URL(req.url);
    const gemId = searchParams.get("id");

    if (!gemId) {
      throw new ValidationError("Missing gem ID");
    }

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from("gems")
      .delete()
      .eq("id", gemId)
      .eq("is_premade", true);

    if (dbError) throw new Error(dbError.message);

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete gem", 500);
  }
}

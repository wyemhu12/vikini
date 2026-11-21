// Admin API route - GEMs management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { invalidateAllGemsCache } from "@/lib/core/cache";
import { ValidationError, DatabaseError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

// GET: List all premade gems
export async function GET() {
  try {
    await requireAdminUser();

    const supabase = getSupabaseAdmin();
    const { data: rawData, error: dbError } = await supabase
      .from("gems")
      .select("*")
      .eq("is_premade", true)
      .order("name");

    if (dbError) throw new DatabaseError(dbError.message);

    // Enrich with latest gem_versions
    const ids = (rawData || []).map((g) => g.id);
    const latestByGem = new Map<string, string>();

    if (ids.length > 0) {
      const { data: versions, error: vError } = await supabase
        .from("gem_versions")
        .select("gem_id,version,instructions")
        .in("gem_id", ids)
        .order("version", { ascending: false });

      if (vError) {
        throw new DatabaseError(`Failed to load gem versions: ${vError.message}`);
      }

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
    const admin = await requireAdminUser();
    const adminEmail = admin.userId;

    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const { name, description, instructions, icon, color } = json as {
      name?: string;
      description?: string;
      instructions?: string;
      icon?: string;
      color?: string;
    };
    const loggerWithContext = logger.withContext("AdminGemCreate");

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
        user_id: adminEmail,
      })
      .select()
      .single();

    if (dbError || !data?.id) {
      throw new DatabaseError(dbError?.message || "Failed to insert gem");
    }

    // 2. Insert into gem_versions (content)
    const { data: vData, error: vError } = await supabase
      .from("gem_versions")
      .insert({
        gem_id: data.id,
        version: 1,
        instructions,
        created_by: adminEmail,
      })
      .select()
      .single();

    if (vError) {
      // Best-effort rollback of parent gem row to avoid versionless orphan
      try {
        await supabase.from("gems").delete().eq("id", data.id).eq("is_premade", true);
      } catch (rollbackErr: unknown) {
        loggerWithContext.warn("Failed to rollback gem row after gem_versions error", rollbackErr);
      }
      throw new DatabaseError(`Failed to create initial gem version: ${vError.message}`);
    }

    await invalidateAllGemsCache();

    const gem = {
      ...data,
      instructions: vData?.instructions || instructions,
    };

    loggerWithContext.audit("ADMIN_CREATE_GEM", adminEmail, {
      gemId: data.id,
      name,
    });

    return success({ gem });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to create gem", 500);
  }
}

// PUT: Update an existing premade gem
export async function PUT(req: NextRequest) {
  let gemUpdated = false;
  try {
    const admin = await requireAdminUser();
    const adminEmail = admin.userId;

    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const { id, name, description, instructions, icon, color } = json as {
      id?: string;
      name?: string;
      description?: string;
      instructions?: string;
      icon?: string;
      color?: string;
    };

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

    if (dbError) throw new DatabaseError(dbError.message);
    gemUpdated = true;

    // 2. Create new gem_version
    const { data: latest, error: latestError } = await supabase
      .from("gem_versions")
      .select("version")
      .eq("gem_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw new DatabaseError(`Failed to fetch latest gem version: ${latestError.message}`);
    }

    const nextVersion = (latest?.version || 0) + 1;

    const { data: vData, error: vError } = await supabase
      .from("gem_versions")
      .insert({
        gem_id: id,
        version: nextVersion,
        instructions,
        created_by: adminEmail,
      })
      .select()
      .single();

    if (vError) {
      throw new DatabaseError(`Failed to create gem version: ${vError.message}`);
    }

    const gem = {
      ...data,
      instructions: vData?.instructions || instructions,
    };

    logger.withContext("AdminGemUpdate").audit("ADMIN_UPDATE_GEM", adminEmail, {
      gemId: id,
      updates: updatePayload,
      version: nextVersion,
    });

    return success({ gem });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update gem", 500);
  } finally {
    if (gemUpdated) {
      await invalidateAllGemsCache();
    }
  }
}

// DELETE: Delete a premade gem
export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const adminEmail = admin.userId;

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

    if (dbError) throw new DatabaseError(dbError.message);

    await invalidateAllGemsCache();

    logger.withContext("AdminGemDelete").audit("ADMIN_DELETE_GEM", adminEmail, {
      gemId,
    });

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete gem", 500);
  }
}

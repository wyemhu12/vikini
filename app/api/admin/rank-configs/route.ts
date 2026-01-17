// Admin API route - Rank config management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { invalidateRankConfigsCache } from "@/lib/core/limits";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// GET: List all rank configs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase.from("rank_configs").select("*").order("rank");

    if (dbError) throw new Error(dbError.message);

    return success({ configs: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to load rank configs", 500);
  }
}

// PATCH: Update rank configs
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const body = (await req.json()) as { configs?: unknown };
    const { configs } = body;

    if (!Array.isArray(configs)) {
      throw new ValidationError("Invalid configs format - expected array");
    }

    const supabase = getSupabaseAdmin();

    // Update each config
    for (const config of configs) {
      const configObj = config as {
        rank?: string;
        daily_message_limit?: number;
        max_file_size_mb?: number;
        features?: unknown;
        allowed_models?: string[];
      };

      const { error: dbError } = await supabase
        .from("rank_configs")
        .update({
          daily_message_limit: configObj.daily_message_limit,
          max_file_size_mb: configObj.max_file_size_mb,
          features: configObj.features,
          allowed_models: configObj.allowed_models || [],
        })
        .eq("rank", configObj.rank);

      if (dbError) throw new Error(dbError.message);
    }

    // Invalidate cache so new configs take effect immediately
    await invalidateRankConfigsCache();

    return success({ updated: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update rank configs", 500);
  }
}

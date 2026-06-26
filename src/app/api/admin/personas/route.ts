// Admin API route - Personas management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

// GET: List all premade personas
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("personas")
      .select("*")
      .eq("is_premade", true)
      .order("name");

    if (dbError) throw new Error(dbError.message);

    return success({ personas: data || [] });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list personas", 500);
  }
}

// POST: Create a new premade persona
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const json = await req.json();
    const { name, description, tone, icon, color } = json;
    // Accept both camelCase (from UI) and snake_case
    const use_emojis = json.useEmojis ?? json.use_emojis;
    const use_headers_lists = json.useHeadersLists ?? json.use_headers_lists;
    const user_context = json.userContext ?? json.user_context;
    const custom_instructions = json.customInstructions ?? json.custom_instructions;
    const loggerWithContext = logger.withContext("AdminPersonaCreate");

    if (!name) {
      throw new ValidationError("Name is required");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("personas")
      .insert({
        name,
        description,
        tone: tone ?? "default",
        use_emojis: use_emojis ?? true,
        use_headers_lists: use_headers_lists ?? true,
        user_context,
        custom_instructions,
        icon,
        color,
        is_premade: true,
        user_id: "SYSTEM",
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    loggerWithContext.audit("ADMIN_CREATE_PERSONA", session.user.id, {
      personaId: data.id,
      name,
    });

    return success({ persona: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to create persona", 500);
  }
}

// PUT: Update an existing premade persona
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const json = await req.json();
    const { id, name, description, tone, icon, color } = json;
    // Accept both camelCase (from UI) and snake_case
    const use_emojis = json.useEmojis ?? json.use_emojis;
    const use_headers_lists = json.useHeadersLists ?? json.use_headers_lists;
    const user_context = json.userContext ?? json.user_context;
    const custom_instructions = json.customInstructions ?? json.custom_instructions;

    if (!id || !name) {
      throw new ValidationError("ID and Name are required");
    }

    const supabase = getSupabaseAdmin();

    const updatePayload = {
      name,
      description,
      tone,
      use_emojis,
      use_headers_lists,
      user_context,
      custom_instructions,
      icon,
      color,
    };

    const { data, error: dbError } = await supabase
      .from("personas")
      .update(updatePayload)
      .eq("id", id)
      .eq("is_premade", true)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    logger.withContext("AdminPersonaUpdate").audit("ADMIN_UPDATE_PERSONA", session.user.id, {
      personaId: id,
      updates: updatePayload,
    });

    return success({ persona: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update persona", 500);
  }
}

// DELETE: Delete a premade persona
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const { searchParams } = new URL(req.url);
    const personaId = searchParams.get("id");

    if (!personaId) {
      throw new ValidationError("Missing persona ID");
    }

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from("personas")
      .delete()
      .eq("id", personaId)
      .eq("is_premade", true);

    if (dbError) throw new Error(dbError.message);

    logger.withContext("AdminPersonaDelete").audit("ADMIN_DELETE_PERSONA", session.user.id, {
      personaId,
    });

    return success({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete persona", 500);
  }
}

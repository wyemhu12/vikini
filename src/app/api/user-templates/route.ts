import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/api/conversations/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { MODEL_IDS } from "@/lib/utils/constants";
import { AppError, ValidationError } from "@/lib/utils/errors";

const routeLogger = logger.withContext("/api/user-templates");

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
  style: z.string().max(50).optional(),
  aspectRatio: z.string().max(10).optional(),
  model: z.string().max(100).optional(),
  negativePrompt: z.string().max(500).optional(),
});

/**
 * User templates are stored in the conversations table as a special
 * "templates storage" conversation. This avoids needing a new table migration.
 *
 * The approach:
 * - Find or create a conversation with model = "user_templates_store"
 * - Templates are stored as messages in this conversation
 * - Each message's meta contains the template data
 */
const TEMPLATE_STORE_MODEL = MODEL_IDS.USER_TEMPLATES_STORE;

async function getOrCreateTemplateStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  // Find existing store
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("model", TEMPLATE_STORE_MODEL)
    .single();

  if (existing) return existing.id;

  // Create new store
  const { data: created, error: createErr } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title: "Image Templates",
      model: TEMPLATE_STORE_MODEL,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    throw new AppError("Failed to create template store", 500);
  }

  return created.id;
}

/**
 * GET /api/user-templates
 * Fetch all user's custom templates
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    const supabase = getSupabaseAdmin();
    const storeId = await getOrCreateTemplateStore(supabase, userId);

    const { data: messages, error: fetchErr } = await supabase
      .from("messages")
      .select("id, meta, created_at")
      .eq("conversation_id", storeId)
      .eq("role", "user")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      routeLogger.error("Fetch templates error:", fetchErr);
      throw new AppError("Failed to fetch templates", 500);
    }

    const templates = (messages || []).map((msg) => {
      const meta = msg.meta as Record<string, unknown>;
      return {
        id: msg.id,
        name: meta.name as string,
        prompt: meta.prompt as string,
        style: meta.style as string | undefined,
        aspectRatio: meta.aspectRatio as string | undefined,
        model: meta.model as string | undefined,
        negativePrompt: meta.negativePrompt as string | undefined,
        createdAt: msg.created_at,
      };
    });

    return success({ templates });
  } catch (err: unknown) {
    routeLogger.error("GET templates error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch templates", 500);
  }
}

/**
 * POST /api/user-templates
 * Save a new custom template
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    const body: unknown = await req.json();
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid template data");
    }

    const supabase = getSupabaseAdmin();
    const storeId = await getOrCreateTemplateStore(supabase, userId);

    // Check count (max 20)
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", storeId)
      .eq("role", "user");

    if (count !== null && count >= 20) {
      throw new ValidationError("Maximum 20 templates allowed");
    }

    // Save as message
    const { data: msg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: storeId,
        role: "user",
        content: `Template: ${parsed.data.name}`,
        meta: {
          type: "user_template",
          ...parsed.data,
        },
      })
      .select("id, created_at")
      .single();

    if (insertErr || !msg) {
      routeLogger.error("Insert template error:", insertErr);
      throw new AppError("Failed to save template", 500);
    }

    routeLogger.info(`Saved template "${parsed.data.name}" for user ${userId}`);
    return success({
      template: {
        id: msg.id,
        ...parsed.data,
        createdAt: msg.created_at,
      },
    });
  } catch (err: unknown) {
    routeLogger.error("POST template error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to save template", 500);
  }
}

/**
 * DELETE /api/user-templates
 * Delete a template by ID
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireUser(req);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("id" in body)) {
      throw new ValidationError("Template ID is required");
    }
    const templateId = (body as Record<string, unknown>).id as string;

    const supabase = getSupabaseAdmin();
    const storeId = await getOrCreateTemplateStore(supabase, userId);

    // Verify message belongs to this store
    const { error: deleteErr } = await supabase
      .from("messages")
      .delete()
      .eq("id", templateId)
      .eq("conversation_id", storeId);

    if (deleteErr) {
      routeLogger.error("Delete template error:", deleteErr);
      throw new AppError("Failed to delete template", 500);
    }

    return success({ deleted: templateId });
  } catch (err: unknown) {
    routeLogger.error("DELETE template error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete template", 500);
  }
}

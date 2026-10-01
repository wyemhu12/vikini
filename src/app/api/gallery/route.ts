import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { MODEL_IDS } from "@/lib/utils/constants";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("GET /api/gallery");

// ============================================================================
// Types
// ============================================================================

interface MessageRow {
  id: string;
  content: string | null;
  role?: string;
  created_at: string;
  meta: {
    type?: string;
    imageUrl?: string;
    prompt?: string;
    attachment?: { url?: string };
    originalOptions?: {
      aspectRatio?: string;
      style?: string;
      model?: string;
    };
  } | null;
}

interface GalleryImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
}

// ============================================================================
// Input Validation
// ============================================================================

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  favorites: z.string().optional(), // MT7: filter favorites only
});

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 2. Validate Input
    const { searchParams } = new URL(req.url);
    const parseResult = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      favorites: searchParams.get("favorites") ?? undefined,
    });

    if (!parseResult.success) {
      throw new ValidationError("Invalid query parameters");
    }

    const { limit, offset, favorites } = parseResult.data;
    const favoritesOnly = favorites === "true";

    const supabase = getSupabaseAdmin();

    // 3. DB-Level query: join messages with conversations
    // SECURITY & SCOPE: Filters by user_id, excludes USER_TEMPLATES_STORE,
    // includes Image Studio, uses PostgREST JSONB filtering and DB pagination.
    let query = supabase
      .from("messages")
      .select(
        `
        id,
        content,
        created_at,
        meta,
        conversations!inner(
          user_id,
          model
        )
      `
      )
      .eq("conversations.user_id", userId)
      .neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)
      .or(
        "meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null"
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (favoritesOnly) {
      query = query.eq("meta->>is_favorite", "true");
    }

    // Range fetch: fetch limit + 1 items to determine hasMore
    const { data, error: dbError } = await query.range(offset, offset + limit);

    if (dbError) {
      routeLogger.error("Gallery Fetch Error:", dbError);
      throw dbError;
    }

    const rawRows = (data || []) as unknown as MessageRow[];
    const hasMore = rawRows.length > limit;
    const items = hasMore ? rawRows.slice(0, limit) : rawRows;

    const images: GalleryImage[] = items
      .map((msg) => {
        const meta = msg.meta;
        const url = meta?.imageUrl || meta?.attachment?.url || "";
        return {
          id: msg.id,
          url,
          prompt: meta?.prompt || msg.content || "",
          createdAt: msg.created_at,
          aspectRatio: meta?.originalOptions?.aspectRatio,
          style: meta?.originalOptions?.style,
          model: meta?.originalOptions?.model,
        };
      })
      .filter((img) => img.url);

    return success({ images, hasMore });
  } catch (err: unknown) {
    routeLogger.error("Gallery API error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch gallery", 500);
  }
}

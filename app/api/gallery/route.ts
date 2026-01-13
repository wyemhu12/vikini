import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { MODEL_IDS } from "@/lib/utils/constants";

// ============================================================================
// Types
// ============================================================================

interface ConversationRow {
  id: string;
  model: string | null;
}

interface MessageRow {
  id: string;
  content: string | null;
  role: string;
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
});

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(req: NextRequest) {
  // 1. Auth Check
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.email.toLowerCase();

  // 2. Validate Input
  const { searchParams } = new URL(req.url);
  const parseResult = querySchema.safeParse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { limit, offset } = parseResult.data;

  try {
    const supabase = getSupabaseAdmin();

    // 3. Get ALL valid conversation IDs for this user (excluding Image Studio)
    const { data: userConvs, error: convError } = await supabase
      .from("conversations")
      .select("id, model")
      .eq("user_id", userId);

    if (convError) {
      console.error("Gallery: Error fetching conversations:", convError);
      throw convError;
    }

    if (!userConvs || userConvs.length === 0) {
      return NextResponse.json({ images: [], hasMore: false });
    }

    const validConvIds = (userConvs as ConversationRow[])
      .filter((c) => c.model !== MODEL_IDS.IMAGE_STUDIO)
      .map((c) => c.id);

    if (validConvIds.length === 0) {
      return NextResponse.json({ images: [], hasMore: false });
    }

    // 4. Fetch Messages with image content (using DB-level filtering)
    // Note: Supabase doesn't support complex JSON filtering in .or(),
    // so we still need some client-side filtering, but we pre-filter meta != null
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, role, created_at, meta")
      .in("conversation_id", validConvIds)
      .not("meta", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gallery Fetch Error:", error);
      throw error;
    }

    // 5. Filter and format images
    const allImages: GalleryImage[] = (data as MessageRow[])
      .filter((msg) => {
        const meta = msg.meta;
        if (!meta) return false;
        return meta.type === "image_gen" || !!meta.imageUrl || !!meta.attachment?.url;
      })
      .map((msg) => {
        const meta = msg.meta!;
        return {
          id: msg.id,
          url: meta.imageUrl || meta.attachment?.url || "",
          prompt: meta.prompt || msg.content || "",
          createdAt: msg.created_at,
          aspectRatio: meta.originalOptions?.aspectRatio,
          style: meta.originalOptions?.style,
          model: meta.originalOptions?.model,
        };
      })
      .filter((img) => img.url);

    // 6. Apply pagination AFTER filtering (correct pagination logic)
    const paginatedImages = allImages.slice(offset, offset + limit);
    const hasMore = offset + limit < allImages.length;

    return NextResponse.json({ images: paginatedImages, hasMore });
  } catch (error) {
    // Sanitize error - don't leak internal details
    console.error("Gallery API error:", error);
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}

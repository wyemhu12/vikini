import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";

export async function GET(req: NextRequest) {
  // 1. Auth Check
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.email.toLowerCase();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const supabase = getSupabaseAdmin();

    // 1. Get ALL valid conversation IDs for this user
    const { data: userConvs, error: convError } = await supabase
      .from("conversations")
      .select("id, model")
      .eq("user_id", userId);

    if (convError) {
      console.error("Gallery: Error fetching conversations:", convError);
      throw convError;
    }

    if (!userConvs || userConvs.length === 0) {
      return NextResponse.json({ images: [] });
    }

    const validConvIds = userConvs
      .filter((c: any) => c.model !== "vikini-image-studio")
      .map((c: any) => c.id);

    if (validConvIds.length === 0) {
      return NextResponse.json({ images: [] });
    }

    // 2. Fetch Messages for these conversations with pagination
    const { data, error } = await supabase
      .from("messages")
      .select(
        `
                id,
                content,
                role,
                created_at,
                meta
            `
      )
      .in("conversation_id", validConvIds)
      .not("meta", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Gallery Fetch Error:", error);
      throw error;
    }

    // 3. Format Response
    const images = data
      // Strict check for image content in meta
      .filter((msg: any) => {
        const meta = msg.meta || {};
        const isImage = meta.type === "image_gen" || !!meta.imageUrl || !!meta.attachment?.url;
        return isImage;
      })
      .map((msg: any) => {
        const meta = msg.meta || {};
        return {
          id: msg.id,
          url: meta.imageUrl || meta.attachment?.url,
          prompt: meta.prompt || msg.content,
          createdAt: msg.created_at,
          aspectRatio: meta.originalOptions?.aspectRatio,
          style: meta.originalOptions?.style,
          model: meta.originalOptions?.model,
        };
      })
      .filter((img: any) => img.url);

    // hasMore: if we got `limit` results, there might be more
    const hasMore = images.length === limit;
    return NextResponse.json({ images, hasMore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}

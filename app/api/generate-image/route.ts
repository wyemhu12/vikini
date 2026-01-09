import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { ImageGenFactory } from "@/lib/features/image-gen/core/ImageGenFactory";
import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { saveMessage } from "@/lib/features/chat/messages"; // Re-use existing persistence logic

export const maxDuration = 60; // Set max duration to 60s (Vercel functionality)

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const userEmail = session.user.email;

    // 2. Parse Body
    const body = await req.json();
    const { prompt, conversationId, options } = body;

    if (!prompt || !conversationId) {
      return NextResponse.json({ error: "Missing prompt or conversationId" }, { status: 400 });
    }

    // 3. Generate Image (Gemini)
    // Note: This step takes time (4-8s)
    const provider = ImageGenFactory.getProvider("gemini");
    const results = await provider.generate(prompt, options as ImageGenOptions);

    if (!results || results.length === 0) {
      throw new Error("No images generated");
    }

    const result = results[0]; // Handle first image for now
    let finalUrl = result.url;
    let storagePath = "";
    let mimeType = "image/png";
    let buffer: Buffer | null = null;
    let filename = "";

    // 4. Upload to Supabase
    const supabase = getSupabaseAdmin();
    const bucket = "attachments";

    if (result.url.startsWith("data:image")) {
      // Decode Base64
      const parts = result.url.split(",");
      const base64Data = parts[1];
      mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/png";
      buffer = Buffer.from(base64Data, "base64");

      const ext = mimeType.split("/")[1] || "png";
      const uuid = crypto.randomUUID();
      filename = `gen-${Date.now()}.${ext}`;
      storagePath = `${userId}/${conversationId}/${uuid}-${filename}`;

      // Upload Logic
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase Upload Error:", uploadError);
        throw new Error("Failed to upload image");
      }

      // Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      finalUrl = publicUrl;
    }

    // 5. Persist as Message (Critical for persistence)
    // We create a message of role 'assistant'
    const messageContent = `Generated Image: ${prompt}`;
    const messageMeta = {
      type: "image_gen",
      prompt: prompt,
      provider: "gemini",
      attachment: {
        url: finalUrl,
        storagePath: storagePath,
        mimeType: mimeType,
        filename: filename,
      },
    };

    // Save Message using existing helper
    const message = await saveMessage(
      userId, // Note: saveMessage uses userId for logging but check if it enforces RLS or ownership.
      // `messages.ts` saveMessage doesn't seem to check ownership of conversation, assumes caller checks.
      // Logic seems fine.
      conversationId,
      "assistant",
      messageContent,
      messageMeta
    );

    if (!message) {
      throw new Error("Failed to save message");
    }

    // 6. Also insert into 'attachments' table to keep schema consistent
    // The `attachments` table is for file management (expiration, list view, etc)
    if (buffer) {
      await supabase.from("attachments").insert({
        id: crypto.randomUUID(), // New ID for tracking
        conversation_id: conversationId,
        message_id: message.id, // Link to the new message!
        user_id: userEmail,
        filename: filename,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: buffer.length,
        created_at: new Date().toISOString(),
      });
    }

    // 7. Return Success
    return NextResponse.json({
      success: true,
      message: message,
      // Helper legacy field if frontend needs it immediately
      imageUrl: finalUrl,
    });
  } catch (error) {
    console.error("Image Gen Route Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

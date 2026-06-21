import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { logger } from "@/lib/utils/logger";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { UnauthorizedError, ValidationError, RateLimitError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("describe-image");

const schema = z.object({
  imageUrl: z.string().min(1, "Image URL is required"),
});

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    const rl = await consumeRateLimit(`describe-image:${userId}`);
    if (!rl.allowed) {
      throw new RateLimitError("Too many requests. Please wait.");
    }

    const body = await req.json();
    let parsed;
    try {
      parsed = schema.parse(body);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        throw new ValidationError(e.issues[0].message);
      }
      throw new ValidationError("Invalid request");
    }

    const { imageUrl } = parsed;

    // Fetch image and convert to base64
    let imageBase64: string;
    let mimeType: string;

    if (imageUrl.startsWith("data:image")) {
      const parts = imageUrl.split(",");
      imageBase64 = parts[1];
      mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/png";
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Failed to fetch image");
      const buffer = await res.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString("base64");
      mimeType = res.headers.get("content-type") || "image/png";
    }

    // Call Gemini to describe the image
    const { getGenAIClient } = await import("@/lib/core/genaiClient");
    const genAI = getGenAIClient();

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType } },
            {
              text: `Analyze this image and write a detailed, professional image generation prompt that could recreate it. Include:
- Subject description (what/who, appearance, clothing, pose)
- Environment/background details
- Lighting conditions and quality
- Color palette and mood
- Camera angle and composition
- Art style and medium

Return ONLY the prompt text, no intro or explanation. Keep under 200 words.`,
            },
          ],
        },
      ],
    });

    let description = "";
    const textValue = result.text;
    if (typeof textValue === "function") {
      description = (textValue as () => string)();
    } else if (typeof textValue === "string") {
      description = textValue;
    } else {
      description = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    return success({ description: description.trim() });
  } catch (err: unknown) {
    routeLogger.error("Describe Image Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to describe image", 500);
  }
}

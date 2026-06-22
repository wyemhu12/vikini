import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { logger } from "@/lib/utils/logger";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { UnauthorizedError, ValidationError, RateLimitError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("prompt-suggest");

const schema = z.object({
  partialPrompt: z.string().min(5).max(500),
});

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    const rl = await consumeRateLimit(`prompt-suggest:${userId}`);
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

    const { partialPrompt } = parsed;

    const { getGenAIClient } = await import("@/lib/core/genaiClient");
    const genAI = getGenAIClient();

    const result = await genAI.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an AI image generation prompt assistant. The user is typing an image generation prompt and needs autocomplete suggestions.

Partial prompt: "${partialPrompt}"

Provide exactly 4 short, creative completions/continuations of this prompt. Each completion should:
- Continue naturally from where the user left off
- Be diverse in style and direction
- Be concise (under 30 words each)
- Focus on visual, artistic, and descriptive elements

Return ONLY the 4 completions, one per line, no numbering, no bullets, no explanation.`,
            },
          ],
        },
      ],
    });

    let text = "";
    const textValue = result.text;
    if (typeof textValue === "function") {
      text = (textValue as () => string)();
    } else if (typeof textValue === "string") {
      text = textValue;
    } else {
      text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const suggestions = text
      .trim()
      .split("\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
      .slice(0, 5);

    return success({ suggestions });
  } catch (err: unknown) {
    routeLogger.error("Prompt Suggest Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to generate suggestions", 500);
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = client.getGenerativeModel({
  model: "gemini-2.5-flash",
});

// System modes
function getSystemPrompt(mode, lang = "vi") {
  const dict = {
    dev: {
      vi: "Developer Mode: trả lời kỹ thuật, chi tiết, ưu tiên code.",
      en: "Developer Mode: technical, detailed, code-heavy.",
    },
    friendly: {
      vi: "Friendly Mode: trả lời thân thiện, tự nhiên.",
      en: "Friendly Mode: warm, casual.",
    },
    strict: {
      vi: "Strict Mode: trả lời ngắn gọn, chính xác.",
      en: "Strict Mode: concise, factual.",
    },
    default: {
      vi: "Bạn là một trợ lý AI hữu ích.",
      en: "You are a helpful AI assistant.",
    },
  };
  return dict[mode]?.[lang] ?? dict.default[lang];
}

export async function POST(req) {
  try {
    const { messages = [], systemMode = "default", language = "vi" } =
      await req.json();

    const last = messages[messages.length - 1];

    if (!last?.content) {
      return new Response("No message content", { status: 400 });
    }

    // Build user prompt
    const systemPrompt = getSystemPrompt(systemMode, language);
    const finalPrompt = `${systemPrompt}\n\n${last.content}`;

    // 🚨 Gemini 2.5: MUST USE 'contents', NOT 'messages'
    // 🚨 NO safetySpec, NO safetySettings — or API will reject
    const result = await model.generateContentStream({
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 4096,
        topP: 0.9,
        topK: 40,
      },
    });

    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              controller.enqueue(encoder.encode(text));
            }
          } catch (err) {
            console.error("STREAM ERROR:", err);
            controller.enqueue(encoder.encode("Streaming error."));
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  } catch (err) {
    console.error("Chat-stream error:", err);
    return new Response("Internal error", { status: 500 });
  }
}

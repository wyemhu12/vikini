// app/lib/autoTitleEngine.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const gen = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fastModel = gen.getGenerativeModel({ model: "gemini-2.5-flash" });

// ------------------------------
// Normalize title
// ------------------------------
export function normalizeTitle(str) {
  if (!str) return "New Chat";

  let t = str.split("\n")[0];
  t = t.replace(/["'.,!?`]/g, "").trim();
  t = t.replace(/\s+/g, " ");

  const words = t.split(" ");
  if (words.length > 6) t = words.slice(0, 6).join(" ");

  return t
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ------------------------------
// OPTIMISTIC TITLE (FAST)
// ------------------------------
export async function generateOptimisticTitle(userMessage) {
  if (!userMessage) return null;

  const short = userMessage.trim().split(" ").slice(0, 6).join(" ");

  try {
    const res = await fastModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a 3-6 word short title summarizing this message:\n${short}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 12,
      },
    });

    return normalizeTitle(res.response.text());
  } catch {
    return normalizeTitle(short);
  }
}

// ------------------------------
// FINAL TITLE — DEBOUNCED
// ------------------------------
const debounceMap = new Map(); // conversationId -> timeout

export function generateFinalTitleDebounced({
  conversationId,
  messages,
  delay = 1200,
  onResult,
}) {
  if (!conversationId || !messages?.length) return;

  // clear previous debounce
  if (debounceMap.has(conversationId)) {
    clearTimeout(debounceMap.get(conversationId));
  }

  const timer = setTimeout(async () => {
    try {
      const transcript = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")
        .slice(0, 4000);

      const res = await fastModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate a concise 3–6 word title summarizing the entire conversation.\n${transcript}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 16,
        },
      });

      const title = normalizeTitle(res.response.text());
      onResult?.(title);
    } catch (e) {
      console.error("Final title debounce error:", e);
    } finally {
      debounceMap.delete(conversationId);
    }
  }, delay);

  debounceMap.set(conversationId, timer);
}

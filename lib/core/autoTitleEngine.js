// /lib/core/autoTitleEngine.js
// Auto-title generation (uses @google/genai via cached client)

import { getGenAIClient } from "@/lib/core/genaiClient";

const TITLE_MODEL = "gemini-2.5-flash";

function extractText(resp) {
  try {
    if (typeof resp?.text === "string") return resp.text;
    if (typeof resp?.text === "function") return resp.text();
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return resp.candidates[0].content.parts[0].text;
    }
  } catch {}
  return "";
}

// Chuẩn hóa title (KHÔNG bao giờ trả rỗng)
export function normalizeTitle(str) {
  if (str == null) return "New Chat";

  // ép về string để tránh trường hợp .text() trả non-string
  let t = String(str);

  // lấy dòng đầu + dọn rác
  t = t.split("\n")[0] ?? "";
  t = t.replace(/["'.,!?`]/g, "").trim();
  t = t.replace(/\s+/g, " ").trim();

  // nếu sau khi clean bị rỗng -> fallback
  if (!t) return "New Chat";

  const words = t.split(" ").filter(Boolean);
  if (words.length === 0) return "New Chat";

  let out = words.join(" ");
  if (words.length > 6) out = words.slice(0, 6).join(" ");

  // Title case nhẹ
  return (
    out
      .split(" ")
      .filter(Boolean)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ")
      .trim() || "New Chat"
  );
}

function titleFromUserMessage(userMessage) {
  const short = String(userMessage || "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return normalizeTitle(short);
}

async function generateTitleWithModel(promptText, { temperature, maxOutputTokens
 }) {
  const ai = getGenAIClient();
  const res = await ai.models.generateContent({
    model: TITLE_MODEL,
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    config: {
      temperature,
      maxOutputTokens,
    },
  });

  return extractText(res);
}

// -------- OPTIMISTIC TITLE (RẤT NHANH) --------
export async function generateOptimisticTitle(userMessage) {
  const fallback = titleFromUserMessage(userMessage);
  if (!userMessage?.trim()) return null;

  const short = String(userMessage).trim().split(/\s+/).slice(0, 6).join(" ");

  try {
    const raw = await generateTitleWithModel(
      `Create a 3-6 word short title summarizing this message:\n${short}`,
      { temperature: 0.3, maxOutputTokens: 12 }
    );

    const normalized = normalizeTitle(raw);
    if (!normalized || normalized === "New Chat") return fallback;
    return normalized;
  } catch {
    return fallback;
  }
}

// -------- FINAL TITLE --------
export async function generateFinalTitle({ userId, conversationId, messages }) {
  try {
    const transcript = (messages || [])
      .map((m) => `${String(m.role || "").toUpperCase()}: ${String(m.content ||
"")}`)
      .join("\n")
      .slice(0, 4000);

    const raw = await generateTitleWithModel(
      `Generate a concise 3–6 word title summarizing the entire conversation.\n$
{transcript}`,
      { temperature: 0.35, maxOutputTokens: 16 }
    );

    const normalized = normalizeTitle(raw);

    if (!normalized || normalized === "New Chat") {
      const firstUser = (messages || []).find(
        (m) => m?.role === "user" && m?.content?.trim()
      );
      const fb = firstUser ? titleFromUserMessage(firstUser.content) : null;
      return fb && fb !== "New Chat" ? fb : null;
    }

    return normalized;
  } catch (e) {
    console.error("Final title error:", e);
    return null;
  }
}

// /lib/core/autoTitleEngine.js
// Auto-title generation (uses @google/genai via cached client)

import { getGenAIClient } from "@/lib/core/genaiClient";
import { CONVERSATION_DEFAULTS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const titleLogger = logger.withContext("autoTitleEngine");

// --- CONFIGURATION ---
// UPDATED (12/2025): Sử dụng ID chính thức 'gemini-3-flash-preview' (Released Dec 17, 2025)
// Thay vì dùng alias, ta dùng ID trực tiếp để tránh lỗi phân giải.
const PRIMARY_MODEL = "gemini-3-flash-preview";

// Model dự phòng ổn định (Stable) nếu bản Preview bị lỗi rate limit hoặc 503
const FALLBACK_MODEL = "gemini-2.5-flash";

function extractText(resp) {
  try {
    // Xử lý các định dạng response khác nhau của @google/genai SDK
    if (typeof resp?.text === "function") return resp.text();
    if (typeof resp?.text === "string") return resp.text;
    
    // Fallback sâu vào cấu trúc JSON (đề phòng thay đổi SDK)
    if (resp?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return resp.candidates[0].content.parts[0].text;
    }
  } catch (e) {
    titleLogger.error("Error extracting text:", e);
  }
  return "";
}

// Chuẩn hóa title (KHÔNG bao giờ trả rỗng)
export function normalizeTitle(str) {
  if (str == null) return CONVERSATION_DEFAULTS.TITLE;

  // ép về string để tránh trường hợp .text() trả non-string
  let t = String(str);

  // lấy dòng đầu + dọn rác markdown/quotes
  t = t.split("\n")[0] ?? "";
  t = t.replace(/^["']|["']$/g, ""); // Chỉ xóa quote ở đầu/cuối
  t = t.replace(/[.,!?;:`]/g, "");   // Xóa dấu câu
  t = t.replace(/\s+/g, " ").trim();

  // nếu sau khi clean bị rỗng -> fallback
  if (!t) return CONVERSATION_DEFAULTS.TITLE;

  const words = t.split(" ").filter(Boolean);
  if (words.length === 0) return CONVERSATION_DEFAULTS.TITLE;

  let out = words.join(" ");
  if (words.length > 6) out = words.slice(0, 6).join(" ");

  // Title case nhẹ
  return (
    out
      .split(" ")
      .filter(Boolean)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ")
      .trim() || CONVERSATION_DEFAULTS.TITLE
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

/**
 * Hàm core gọi AI với cơ chế Fallback
 */
async function generateTitleWithModel(promptText, { temperature, maxOutputTokens }) {
  const ai = getGenAIClient();
  
  // Helper thực thi gọi model
  const attemptGenerate = async (modelId) => {
    try {
      const res = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          temperature,
          maxOutputTokens,
        },
      });
      return extractText(res);
    } catch (e) {
      // Ném lỗi để catch block bên dưới xử lý fallback
      throw e;
    }
  };

  try {
    // Thử model chính (Gemini 3 Flash Preview)
    return await attemptGenerate(PRIMARY_MODEL);
  } catch (e1) {
    titleLogger.warn(`Primary model ${PRIMARY_MODEL} failed, trying fallback. Error: ${e1.message}`);
    
    try {
      // Thử model dự phòng (Gemini 2.5 Flash Stable)
      return await attemptGenerate(FALLBACK_MODEL);
    } catch (e2) {
      titleLogger.error(`All models failed. Fallback: ${e2.message}`);
      return null;
    }
  }
}

// -------- OPTIMISTIC TITLE (RẤT NHANH) --------
export async function generateOptimisticTitle(userMessage) {
  const fallback = titleFromUserMessage(userMessage);
  if (!userMessage?.trim()) return null;

  const short = String(userMessage).trim().split(/\s+/).slice(0, 10).join(" ");

  try {
    const raw = await generateTitleWithModel(
      `Summarize this into a 3-5 word title (plain text, no quotes):\n"${short}"`,
      { temperature: 0.3, maxOutputTokens: 15 }
    );

    const normalized = normalizeTitle(raw);
    if (!normalized || normalized === CONVERSATION_DEFAULTS.TITLE) return fallback;
    return normalized;
  } catch {
    return fallback;
  }
}

// -------- FINAL TITLE --------
export async function generateFinalTitle({ userId, conversationId, messages }) {
  try {
    const transcript = (messages || [])
      .map((m) => `${String(m.role || "").toUpperCase()}: ${String(m.content || "")}`)
      .join("\n")
      .slice(0, 5000); // Tăng context lên một chút vì model Flash rất rẻ

    const raw = await generateTitleWithModel(
      `Generate a concise 3-6 word title for this conversation. Direct answer, no "Title:" prefix, no quotes.\n\n${transcript}`,
      { temperature: 0.3, maxOutputTokens: 20 }
    );

    const normalized = normalizeTitle(raw);

    if (!normalized || normalized === CONVERSATION_DEFAULTS.TITLE) {
      const firstUser = (messages || []).find(
        (m) => m?.role === "user" && m?.content?.trim()
      );
      const fb = firstUser ? titleFromUserMessage(firstUser.content) : null;
      return fb && fb !== CONVERSATION_DEFAULTS.TITLE ? fb : null;
    }

    return normalized;
  } catch (e) {
    console.error("Final title error:", e);
    return null;
  }
}
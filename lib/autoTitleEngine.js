// /lib/autoTitleEngine.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const gen = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fastModel = gen.getGenerativeModel({ model: "gemini-2.5-flash" });

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
  return out
    .split(" ")
    .filter(Boolean)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim() || "New Chat";
}

function titleFromUserMessage(userMessage) {
  const short = String(userMessage || "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return normalizeTitle(short);
}

// -------- OPTIMISTIC TITLE (RẤT NHANH) --------
export async function generateOptimisticTitle(userMessage) {
  const fallback = titleFromUserMessage(userMessage);
  if (!userMessage?.trim()) return null;

  const short = String(userMessage).trim().split(/\s+/).slice(0, 6).join(" ");

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

    const raw = res?.response?.text?.() ?? "";
    const normalized = normalizeTitle(raw);

    // Nếu model trả rỗng / “New Chat” (không hữu ích) → fallback về short từ user
    if (!normalized || normalized === "New Chat") return fallback;

    return normalized;
  } catch (e) {
    // fallback chắc chắn có ý nghĩa
    return fallback;
  }
}

// -------- FINAL TITLE --------
export async function generateFinalTitle({ userId, conversationId, messages }) {
  try {
    const transcript = (messages || [])
      .map((m) => `${String(m.role || "").toUpperCase()}: ${String(m.content || "")}`)
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

    const raw = res?.response?.text?.() ?? "";
    const normalized = normalizeTitle(raw);

    // Final title mà vẫn “New Chat” thì fallback sang message đầu tiên của user (nếu có)
    if (!normalized || normalized === "New Chat") {
      const firstUser = (messages || []).find((m) => m?.role === "user" && m?.content?.trim());
      const fb = firstUser ? titleFromUserMessage(firstUser.content) : null;
      return fb && fb !== "New Chat" ? fb : null;
    }

    return normalized;
  } catch (e) {
    console.error("Final title error:", e);
    return null;
  }
}

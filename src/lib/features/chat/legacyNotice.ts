// src/lib/features/chat/legacyNotice.ts

export const LEGACY_NOTICE_LENGTH =
  "*(Quá trình suy nghĩ đã đạt giới hạn độ dài token trước khi tạo câu trả lời. Bạn có thể thử chuyển mức suy nghĩ sang Trung bình/Thấp hoặc yêu cầu câu trả lời ngắn gọn hơn.)*";

export const LEGACY_NOTICE_NO_CONTENT =
  "*(Mô hình đã hoàn tất suy nghĩ nhưng chưa xuất nội dung trả lời. Vui lòng bấm 'Tạo lại'.)*";

export interface ParsedLegacyNotice {
  cleanContent: string;
  reason: "length" | "no_content";
}

/**
 * Detects and strips legacy server-injected notice strings from message content.
 * Returns null if no legacy notice is found.
 */
export function parseLegacyNotice(content: string): ParsedLegacyNotice | null {
  if (!content) return null;
  const trimmed = content.trim();

  if (trimmed.endsWith(LEGACY_NOTICE_LENGTH)) {
    const clean = trimmed.slice(0, -LEGACY_NOTICE_LENGTH.length).trim();
    return {
      cleanContent: clean,
      reason: "length",
    };
  }

  if (trimmed.endsWith(LEGACY_NOTICE_NO_CONTENT)) {
    const clean = trimmed.slice(0, -LEGACY_NOTICE_NO_CONTENT.length).trim();
    return {
      cleanContent: clean,
      reason: "no_content",
    };
  }

  return null;
}

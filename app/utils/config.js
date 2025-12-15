export const translations = {
  vi: {
    appName: "Vikini - Gemini Chat",
    newChat: "Cuộc trò chuyện mới",
    exploreGems: "Khám phá Gems",
    placeholder: "Nhập câu hỏi...",
    send: "Gửi",
    logout: "Đăng xuất",
    thinking: "Đang nghĩ...",
    empty: "Hãy bắt đầu cuộc trò chuyện!",
    whitelist: "Chỉ người được cấp quyền",
    language: "Ngôn ngữ",
    vi: "Tiếng Việt",
    en: "Tiếng Anh",
    themes: "Chủ đề",
    amber: "Cam–Nâu",
    indigo: "Tím–Xanh",
    charcoal: "Xám–Đen",
    systemPrompt: "Chế độ",
    modeDefault: "Mặc định",
    modeDev: "Developer",
    modeFriendly: "Thân thiện",
    modeStrict: "Nghiêm túc",
    renameChat: "Đổi tên cuộc trò chuyện",
    deleteConfirm: "Xóa cuộc trò chuyện này?",
  },
  en: {
    appName: "Vikini - Gemini Chat",
    newChat: "New Chat",
    exploreGems: "Explore Gems",
    placeholder: "Type your message...",
    send: "Send",
    logout: "Log out",
    thinking: "Thinking...",
    empty: "Start your conversation!",
    whitelist: "Whitelist only",
    language: "Language",
    vi: "Vietnamese",
    en: "English",
    themes: "Themes",
    amber: "Amber",
    indigo: "Indigo",
    charcoal: "Charcoal",
    systemPrompt: "Mode",
    modeDefault: "Default",
    modeDev: "Developer",
    modeFriendly: "Friendly",
    modeStrict: "Strict",
    renameChat: "Rename chat",
    deleteConfirm: "Delete this chat?",
  },
};

export function getSystemPrompt(mode, language) {
  const vi = {
    default:
      "Bạn là trợ lý Gemini thân thiện, trả lời ngắn gọn, rõ ràng, ưu tiên tiếng Việt nếu không được yêu cầu ngôn ngữ khác.",
    dev: "Bạn là trợ lý kỹ thuật chuyên về lập trình và hạ tầng. Trả lời chi tiết, có ví dụ code, tập trung vào giải pháp thực tế.",
    friendly:
      "Bạn là trợ lý thân thiện, nói chuyện gần gũi, dễ hiểu, nhưng vẫn chính xác.",
    strict:
      "Bạn là trợ lý nghiêm túc, trả lời trực tiếp, súc tích, không vòng vo, không thêm emoji.",
  };

  const en = {
    default: "You are a helpful Gemini assistant. Answer clearly and concisely.",
    dev: "You are a technical assistant focused on programming and infrastructure. Provide detailed, practical answers with code examples.",
    friendly:
      "You are a friendly, warm assistant. Keep it easy to understand while staying accurate.",
    strict:
      "You are a strict, concise assistant. Answer directly with no fluff and no emojis.",
  };

  const dict = language === "vi" ? vi : en;
  return dict[mode] || dict.default;
}

export function createChat(lang) {
  return {
    id: crypto.randomUUID(),
    messages: [],
    createdAt: Date.now(),
    title: lang === "vi" ? "Cuộc trò chuyện mới" : "New chat",
    autoTitled: false,
    renamed: false,
  };
}

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
    gold: "Vàng metallic",
    red: "Đỏ",
    rose: "Hồng nhạt",
    renameChat: "Đổi tên cuộc trò chuyện",
    deleteConfirm: "Xóa cuộc trò chuyện này?",
    regenerate: "Tạo lại",
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
    gold: "Metallic Gold",
    red: "Red",
    rose: "Rose",
    renameChat: "Rename chat",
    deleteConfirm: "Delete this chat?",
    regenerate: "Regenerate",
  },
};

// Backward compatible exports (fix build warnings from ChatApp.jsx imports)
export const tVi = translations.vi;
export const tEn = translations.en;

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

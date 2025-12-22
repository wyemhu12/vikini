export const translations = {
  vi: {
    appName: "Vikini - Gemini Chat",
    newChat: "Cuộc trò chuyện mới",
    exploreGems: "Khám phá Gems",
    placeholder: "Nhập câu hỏi...",
    send: "Gửi",
    logout: "Đăng xuất",
    signOut: "Đăng xuất",
    thinking: "Đang nghĩ...",
    empty: "Hãy bắt đầu cuộc trò chuyện!",
    whitelist: "Chỉ người được cấp quyền",
    // HeaderBar translations
    language: "Ngôn ngữ",
    themes: "Giao diện",
    vi: "Tiếng Việt",
    en: "Tiếng Anh",
    // Theme names
    amber: "Cam–Nâu",
    indigo: "Tím–Xanh",
    charcoal: "Xám–Đen",
    gold: "Vàng ánh kim",
    red: "Đỏ",
    rose: "Hồng nhạt",
    // Chat actions
    renameChat: "Đổi tên cuộc trò chuyện",
    deleteConfirm: "Xóa cuộc trò chuyện này?",
    regenerate: "Tạo lại",
    refresh: "Làm mới",
    deleteAll: "Xóa tất cả",
    // Model selector translations
    modelSelector: "Model",
    selectModel: "Chọn Model",
    currentModel: "Model hiện tại",
    // Applied GEM translations
    appliedGem: "GEM đang dùng",
    appliedGemNone: "Không có",
    // Model names - chỉ các model thực sự có sẵn
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    // Model descriptions
    modelDescFlash25: "Nhanh & cân bằng",
    modelDescPro25: "Suy luận nâng cao",
    modelDescFlash20: "Thế hệ trước",
    modelDescPro15: "Ngữ cảnh dài",
    // Web search
    webSearch: "Tìm kiếm Web",
    webSearchOn: "BẬT",
    webSearchOff: "TẮT",
  },
  en: {
    appName: "Vikini - Gemini Chat",
    newChat: "New Chat",
    exploreGems: "Explore Gems",
    placeholder: "Type your message...",
    send: "Send",
    logout: "Log out",
    signOut: "Sign Out",
    thinking: "Thinking...",
    empty: "Start your conversation!",
    whitelist: "Whitelist only",
    // HeaderBar translations
    language: "Language",
    themes: "Themes",
    vi: "Vietnamese",
    en: "English",
    // Theme names
    amber: "Amber",
    indigo: "Indigo",
    charcoal: "Charcoal",
    gold: "Metallic Gold",
    red: "Red",
    rose: "Rose",
    // Chat actions
    renameChat: "Rename chat",
    deleteConfirm: "Delete this chat?",
    regenerate: "Regenerate",
    refresh: "Refresh",
    deleteAll: "Delete all",
    // Model selector translations
    modelSelector: "Model",
    selectModel: "Select Model",
    currentModel: "Current Model",
    // Applied GEM translations
    appliedGem: "Applied GEM",
    appliedGemNone: "None",
    // Model names - chỉ các model thực sự có sẵn
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    // Model descriptions
    modelDescFlash25: "Fast & balanced",
    modelDescPro25: "Advanced thinking",
    modelDescFlash20: "Previous generation",
    modelDescPro15: "Long context",
    // Web search
    webSearch: "Web Search",
    webSearchOn: "ON",
    webSearchOff: "OFF",
  },
};

// Backward compatible exports (fix build warnings from ChatApp.jsx imports)
export const tVi = translations.vi;
export const tEn = translations.en;

export function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
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

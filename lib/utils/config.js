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
    refresh: "Làm mới",
    deleteAll: "Xóa tất cả",
    // NEW: Model selector translations
    modelSelector: "Model",
    selectModel: "Chọn Model",
    currentModel: "Model hiện tại",
    // NEW: Applied GEM translations
    appliedGem: "GEM đang dùng",
    appliedGemNone: "Không có",
    // NEW: Model names
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3-pro": "Gemini 3 Pro",
    // NEW: Model descriptions
    modelDescFlash25: "Nhanh & cân bằng",
    modelDescPro25: "Suy luận nâng cao",
    modelDescFlash3: "Thông minh & nhanh",
    modelDescPro3: "Thông minh nhất",
    // NEW: Web search
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
    refresh: "Refresh",
    deleteAll: "Delete all",
    // NEW: Model selector translations
    modelSelector: "Model",
    selectModel: "Select Model",
    currentModel: "Current Model",
    // NEW: Applied GEM translations
    appliedGem: "Applied GEM",
    appliedGemNone: "None",
    // NEW: Model names
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3-pro": "Gemini 3 Pro",
    // NEW: Model descriptions
    modelDescFlash25: "Fast & balanced",
    modelDescPro25: "Advanced thinking",
    modelDescFlash3: "Smart & fast",
    modelDescPro3: "Most intelligent",
    // NEW: Web search
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

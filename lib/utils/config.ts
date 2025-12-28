// lib/utils/config.ts

// Translation types
export type TranslationKey = string;
export type TranslationValue = string;

export interface Translations {
  [key: string]: TranslationValue | Translations;
}

export interface TranslationSet {
  vi: Record<TranslationKey, TranslationValue>;
  en: Record<TranslationKey, TranslationValue>;
}

export const translations: TranslationSet = {
  vi: {
    appName: "Vikini Chat",
    newChat: "Cuộc trò chuyện mới",
    exploreGems: "Khám phá Gems",
    placeholder: "Nhập câu hỏi...",
    send: "Gửi",
    logout: "Đăng xuất",
    signOut: "Đăng xuất",
    thinking: "Đang nghĩ...",
    empty: "Hãy bắt đầu cuộc trò chuyện!",
    whitelist: "Chỉ người được cấp quyền",
    whitelistOnly: "Chỉ dành cho danh sách được cấp quyền",
    landingMessage: "Hãy hỏi bất cứ thứ gì để bắt đầu một cuộc hội thoại mới.",
    lessCensored: "Ít kiểm duyệt hơn. AI được mã hóa.",
    authorizedAccess: "TRUY CẬP ĐƯỢC CẤP PHÉP",
    regenerate: "Tạo câu trả lời mới",
    copy: "Sao chép",
    copied: "Đã chép",
    expand: "Mở rộng",
    collapse: "Thu gọn",
    edit: "Chỉnh sửa",
    save: "Lưu & Gửi",
    cancel: "Hủy",
    // HeaderBar translations
    language: "Ngôn ngữ",
    themes: "Giao diện",
    vi: "Tiếng Việt",
    en: "Tiếng Anh",
    // Theme names
    blueprint: "Xanh Dịu (Blueprint)",
    amber: "Cam–Nâu",
    indigo: "Tím–Xanh",
    charcoal: "Xám–Đen",
    gold: "Vàng ánh kim",
    red: "Đỏ",
    rose: "Hồng nhạt",
    // Chat actions
    renameChat: "Đổi tên cuộc hội thoại",
    deleteConfirm: "Xóa cuộc hội thoại này?",
    refresh: "Làm mới",
    deleteAll: "Xóa tất cả",
    // Model selector translations
    modelSelector: "Model",
    selectModel: "Chọn Model",
    currentModel: "Model hiện tại",
    // Applied GEM translations
    appliedGem: "GEM đang dùng",
    appliedGemNone: "Không có",
    // Model names
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
    "gemini-3-pro-preview": "Gemini 3 Pro (Preview)",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3-pro": "Gemini 3 Pro",
    // Model descriptions
    modelDescFlash25: "Nhanh & cân bằng",
    modelDescPro25: "Suy luận nâng cao",
    modelDescFlash3: "Thông minh & nhanh",
    modelDescPro3: "Thông minh nhất",
    // Web search
    webSearch: "Tìm kiếm Web",
    webSearchOn: "BẬT",
    webSearchOff: "TẮT",
    // Gems Manager
    gemsTitle: "Quản lý Gems",
    myGems: "Gems của tôi",
    premadeGems: "Gems hệ thống",
    createGem: "Tạo Gem mới",
    editGem: "Sửa Gem",
    deleteGem: "Xóa Gem",
    saveGem: "Lưu Gem",
    select: "Chọn",
    gemName: "Tên Gem",
    gemDescription: "Mô tả",
    gemInstructions: "Hướng dẫn (System Prompt)",
    gemPlaceholderName: "Ví dụ: Chuyên gia Code",
    gemPlaceholderDesc: "Mô tả ngắn gọn chức năng của Gem",
    gemPlaceholderInst: "Nhập hướng dẫn chi tiết cho AI...",
    gemDeleteConfirm: "Bạn có chắc chắn muốn xóa Gem này?",
    backToChat: "Quay lại Chat",
    // Sidebar & Conversations
    history: "Lịch sử trò chuyện",
    noConversations: "Chưa có cuộc hội thoại nào",
    clearHistory: "Xóa toàn bộ lịch sử",
    confirmClearHistory: "Hành động này sẽ xóa vĩnh viễn tất cả cuộc hội thoại. Bạn chắc chắn chứ?",
    // Attachments
    attachments: "Tệp đính kèm",
    uploadFile: "Tải tệp lên",
    maxFilesReached: "Đã đạt giới hạn số lượng tệp",
    fileTooLarge: "Tệp quá lớn",
    supportedFiles: "Hỗ trợ: PDF, Hình ảnh, Text, Zip",
    // Common UI
    loading: "Đang tải...",
    error: "Có lỗi xảy ra",
    success: "Thành công",
    // AI disclaimer
    aiDisclaimer: "AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.",
  },
  en: {
    appName: "Vikini Chat",
    newChat: "New Chat",
    exploreGems: "Explore Gems",
    placeholder: "Type a message...",
    send: "Send",
    logout: "Logout",
    signOut: "Sign Out",
    thinking: "Thinking...",
    empty: "Start a conversation!",
    whitelist: "Authorized access only",
    whitelistOnly: "Whitelist only",
    landingMessage: "Ask anything to start a new conversation.",
    lessCensored: "Less censored. AI is encrypted.",
    authorizedAccess: "AUTHORIZED ACCESS",
    regenerate: "Regenerate",
    copy: "Copy",
    copied: "Copied",
    expand: "Expand",
    collapse: "Collapse",
    edit: "Edit",
    save: "Save & Send",
    cancel: "Cancel",
    language: "Language",
    themes: "Themes",
    vi: "Vietnamese",
    en: "English",
    blueprint: "Blueprint",
    amber: "Amber",
    indigo: "Indigo",
    charcoal: "Charcoal",
    gold: "Gold",
    red: "Red",
    rose: "Rose",
    renameChat: "Rename chat",
    deleteConfirm: "Delete this conversation?",
    refresh: "Refresh",
    deleteAll: "Delete All",
    modelSelector: "Model",
    selectModel: "Select Model",
    currentModel: "Current Model",
    appliedGem: "Active GEM",
    appliedGemNone: "None",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
    "gemini-3-pro-preview": "Gemini 3 Pro (Preview)",
    "gemini-3-flash": "Gemini 3 Flash",
    "gemini-3-pro": "Gemini 3 Pro",
    modelDescFlash25: "Fast & balanced",
    modelDescPro25: "Advanced reasoning",
    modelDescFlash3: "Smart & fast",
    modelDescPro3: "Smartest",
    webSearch: "Web Search",
    webSearchOn: "ON",
    webSearchOff: "OFF",
    gemsTitle: "Manage Gems",
    myGems: "My Gems",
    premadeGems: "System Gems",
    createGem: "Create Gem",
    editGem: "Edit Gem",
    deleteGem: "Delete Gem",
    saveGem: "Save Gem",
    select: "Select",
    gemName: "Gem Name",
    gemDescription: "Description",
    gemInstructions: "Instructions (System Prompt)",
    gemPlaceholderName: "Example: Code Expert",
    gemPlaceholderDesc: "Brief description of the Gem's function",
    gemPlaceholderInst: "Enter detailed instructions for AI...",
    gemDeleteConfirm: "Are you sure you want to delete this Gem?",
    backToChat: "Back to Chat",
    history: "Chat History",
    noConversations: "No conversations yet",
    clearHistory: "Clear All History",
    confirmClearHistory: "This action will permanently delete all conversations. Are you sure?",
    attachments: "Attachments",
    uploadFile: "Upload File",
    maxFilesReached: "Maximum files reached",
    fileTooLarge: "File too large",
    supportedFiles: "Supported: PDF, Images, Text, Zip",
    loading: "Loading...",
    error: "An error occurred",
    success: "Success",
    aiDisclaimer: "AI may make mistakes. Verify important information.",
  },
};

export const tVi = translations.vi;
export const tEn = translations.en;

export function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

import { randomUUID } from "crypto";

export interface CreateChatResult {
  id: string;
  messages: never[];
  createdAt: number;
  title: string;
  autoTitled: boolean;
  renamed: boolean;
}

export function createChat(lang: "vi" | "en"): CreateChatResult {
  return {
    id: randomUUID(),
    messages: [],
    createdAt: Date.now(),
    title: lang === "vi" ? "Cuộc trò chuyện mới" : "New Chat",
    autoTitled: false,
    renamed: false,
  };
}


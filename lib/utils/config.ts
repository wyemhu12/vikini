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
    openSidebar: "Mở thanh bên",
    selectLanguage: "Chọn ngôn ngữ",
    selectTheme: "Chọn giao diện",
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
    yuri: "Yuri Purple",
    allied: "Allied Blue",
    soviet: "Soviet Red",
    // Chat actions
    renameChat: "Đổi tên cuộc hội thoại",
    deleteConfirm: "Xóa cuộc hội thoại này?",
    refresh: "Làm mới",
    deleteAll: "Xóa tất cả",
    // Model selector translations
    modelSelector: "Model",
    selectModel: "Chọn Model",
    currentModel: "Model hiện tại",
    modelSelectorProviders: "Nhà cung cấp",
    modelSelectorService: "Dịch vụ",
    modelCategoryReasoning: "Suy luận",
    modelCategoryLowLatency: "Tốc độ cao",
    modelSelectorModelsSuffix: "MÔ HÌNH",
    modelSelectorAvailableLater: "Sẽ có sau",
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
    modelDescLlama33_70b: "Llama 3.3 qua Groq",
    modelDescLlama31_8b: "Llama 3.1 nhanh",
    modelDescDeepSeekV3: "DeepSeek V3 mạnh mẽ (Miễn phí)",
    modelDescDeepSeekR1: "DeepSeek R1 suy luận (Miễn phí)",
    modelDescLlama4Maverick: "Llama 4 mới nhất (Miễn phí)",
    modelDescLlama33Instruct: "Llama 3.3 70B (Miễn phí)",
    modelDescGemma3: "Google Gemma 3 (Miễn phí)",
    modelDescMistralSmall: "Mistral Small 3.1 (Miễn phí)",
    modelDescClaudeHaiku: "Claude 4.5 nhanh nhất",
    modelDescClaudeSonnet: "Claude 4.5 thông minh",
    // Web search
    webSearch: "Tìm kiếm Web",
    webSearchOn: "BẬT",
    webSearchOff: "TẮT",
    alwaysSearch: "Luôn tìm kiếm",
    alwaysSearchTooltip: "AI luôn tìm kiếm web trước khi trả lời (chỉ Gemini)",
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
    // Modal translations
    modalUpgradeTitle: "Mô hình bị hạn chế",
    modalUpgradeRequestedModel: "Mô hình yêu cầu",
    modalUpgradeNoPermission: "Bạn không có quyền sử dụng mô hình này.",
    modalUpgradeContactAdmin: "Vui lòng liên hệ quản trị viên để nâng cấp tài khoản.",
    modalUpgradeGotIt: "Đã hiểu",
    modalDeleteTitle: "Xóa cuộc hội thoại",
    modalDeleteWarning: "Hành động này không thể hoàn tác",
    modalDeleteConfirm: "Bạn có chắc chắn muốn xóa cuộc hội thoại này?",
    modalDeleteButton: "Xóa",
    // Admin Dashboard
    adminDashboard: "Bảng điều khiển Admin",
    adminDescription: "Quản lý người dùng, giới hạn và cấu hình hệ thống",
    adminUsers: "Người dùng",
    adminLimits: "Giới hạn",
    adminGlobalGems: "GEMs hệ thống",
    // User Manager
    userManagement: "Quản lý người dùng",
    userUsers: "người dùng",
    userEmail: "Email",
    userRank: "Xếp hạng",
    userStatus: "Trạng thái",
    userCreated: "Ngày tạo",
    userActions: "Thao tác",
    userNotWhitelisted: "Chưa duyệt",
    userBasic: "Cơ bản",
    userPro: "Pro",
    userAdmin: "Admin",
    userBlocked: "Đã khóa",
    userActive: "Hoạt động",
    userBlock: "Khóa",
    userUnblock: "Mở khóa",
    userLoadingUsers: "Đang tải người dùng...",
    // GEMs Manager
    globalGemsManagement: "Quản lý GEMs hệ thống",
    addGem: "Thêm GEM",
    noGlobalGems: "Chưa có GEM hệ thống nào",
    editGlobalGem: "Sửa GEM hệ thống",
    createGlobalGem: "Tạo GEM hệ thống",
    confirmDeleteGem: "Bạn có chắc chắn muốn xóa GEM này?",
    loadingGems: "Đang tải gems...",
    gems: "gems",
    // Rank Config Manager
    globalLimitConfig: "Cấu hình giới hạn toàn cục",
    saveChanges: "Lưu thay đổi",
    dailyMessageLimit: "Giới hạn tin nhắn/ngày",
    maxFileSize: "Dung lượng tệp tối đa (MB)",
    features: "Tính năng",
    unlimitedGems: "GEMs không giới hạn",
    allowedModels: "Model được phép",
    configureModels: "Cấu hình Model",
    selectModelsForRank: "Chọn các model mà xếp hạng này có thể sử dụng",
    models: "Models",
    contextTokens: "Ngữ cảnh",
    tokens: "tokens",
    done: "Xong",

    configsSaved: "Đã lưu cấu hình thành công!",
    // Dashboard
    greetingMorning: "Chào buổi sáng",
    greetingAfternoon: "Chào buổi chiều",
    greetingEvening: "Chào buổi tối",
    quickActions: "Tác vụ nhanh",
    statsTokenUsage: "Token đã dùng",
    statsNoData: "Chưa có dữ liệu",
    recentActivity: "Hoạt động gần đây",
    suggestionCode: "Review Code",
    descSuggestionCode: "Phân tích & tối ưu mã nguồn",
    suggestionImage: "Tạo hình ảnh",
    descSuggestionImage: "Tạo hình ảnh đẹp với AI",
    suggestionAnalyze: "Phân tích liệu",
    descSuggestionAnalyze: "Phân tích sâu dữ liệu phức tạp",
    suggestionChat: "Trò chuyện vui",
    descSuggestionChat: "Trò chuyện giải trí",
    descStatsTokenUsage: "12,450 / 50,000 (Giả lập)",
    descStatsNoData: "Chưa có dữ liệu hội thoại",
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
    openSidebar: "Open sidebar",
    selectLanguage: "Select Language",
    selectTheme: "Select Theme",
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
    yuri: "Yuri Purple",
    allied: "Allied Blue",
    soviet: "Soviet Red",
    renameChat: "Rename chat",
    deleteConfirm: "Delete this conversation?",
    refresh: "Refresh",
    deleteAll: "Delete All",
    modelSelector: "Model",
    selectModel: "Select Model",
    currentModel: "Current Model",
    modelSelectorProviders: "Providers",
    modelSelectorService: "Service",
    modelCategoryReasoning: "Reasoning",
    modelCategoryLowLatency: "Low Latency",
    modelSelectorModelsSuffix: "MODELS",
    modelSelectorAvailableLater: "Available later",
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
    modelDescLlama33_70b: "Llama 3.3 via Groq",
    modelDescLlama31_8b: "Llama 3.1 fast",
    modelDescDeepSeekV3: "DeepSeek V3 powerful (Free)",
    modelDescDeepSeekR1: "DeepSeek R1 reasoning (Free)",
    modelDescLlama4Maverick: "Llama 4 latest (Free)",
    modelDescLlama33Instruct: "Llama 3.3 70B (Free)",
    modelDescGemma3: "Google Gemma 3 (Free)",
    modelDescMistralSmall: "Mistral Small 3.1 (Free)",
    modelDescClaudeHaiku: "Claude 4.5 fastest",
    modelDescClaudeSonnet: "Claude 4.5 intelligent",
    webSearch: "Web Search",
    webSearchOn: "ON",
    webSearchOff: "OFF",
    alwaysSearch: "Always Search",
    alwaysSearchTooltip: "AI always searches web before answering (Gemini only)",
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
    // Modal translations
    modalUpgradeTitle: "Model Access Restricted",
    modalUpgradeRequestedModel: "Requested Model",
    modalUpgradeNoPermission: "You don't have permission to use this model.",
    modalUpgradeContactAdmin: "Please contact an administrator to upgrade your account.",
    modalUpgradeGotIt: "Got It",
    modalDeleteTitle: "Delete Conversation",
    modalDeleteWarning: "This action cannot be undone",
    modalDeleteConfirm: "Are you sure you want to delete this conversation?",
    modalDeleteButton: "Delete",
    // Admin Dashboard
    adminDashboard: "Admin Dashboard",
    adminDescription: "Manage users, limits, and system configuration",
    adminUsers: "Users",
    adminLimits: "Limits",
    adminGlobalGems: "Global GEMs",
    // User Manager
    userManagement: "User Management",
    userUsers: "users",
    userEmail: "Email",
    userRank: "Rank",
    userStatus: "Status",
    userCreated: "Created",
    userActions: "Actions",
    userNotWhitelisted: "Not Whitelisted",
    userBasic: "Basic",
    userPro: "Pro",
    userAdmin: "Admin",
    userBlocked: "Blocked",
    userActive: "Active",
    userBlock: "Block",
    userUnblock: "Unblock",
    userLoadingUsers: "Loading users...",
    // GEMs Manager
    globalGemsManagement: "Global GEMs Management",
    addGem: "Add GEM",
    noGlobalGems: "No global GEMs found",
    editGlobalGem: "Edit Global GEM",
    createGlobalGem: "Create Global GEM",
    confirmDeleteGem: "Are you sure you want to delete this GEM?",
    loadingGems: "Loading gems...",
    gems: "gems",
    // Rank Config Manager
    globalLimitConfig: "Global Limit Configuration",
    saveChanges: "Save Changes",
    dailyMessageLimit: "Daily Message Limit",
    maxFileSize: "Max File Size (MB)",
    features: "Features",
    unlimitedGems: "Unlimited GEMs",
    allowedModels: "Allowed Models",
    configureModels: "Configure Models",
    selectModelsForRank: "Select which models this rank can access",
    models: "Models",
    contextTokens: "Context",
    tokens: "tokens",
    done: "Done",
    loadingConfigs: "Loading configs...",
    configsSaved: "Rank configs updated successfully!",
    // Dashboard
    greetingMorning: "Good Morning",
    greetingAfternoon: "Good Afternoon",
    greetingEvening: "Good Evening",
    quickActions: "Quick Actions",
    statsTokenUsage: "Token Usage",
    statsNoData: "No Data",
    recentActivity: "Recent Activity",
    suggestionCode: "Code Review",
    descSuggestionCode: "Analyze & refactor code snippets",
    suggestionImage: "Generate Image",
    descSuggestionImage: "Create stunning visuals with AI",
    suggestionAnalyze: "Analyze Data",
    descSuggestionAnalyze: "Deep dive into complex datasets",
    suggestionChat: "Fun Chat",
    descSuggestionChat: "Casual conversation",
    descStatsTokenUsage: "12,450 / 50,000 (Mock)",
    descStatsNoData: "No recent chats",
  },
};

export const tVi = translations.vi;
export const tEn = translations.en;

// Type-safety: Ensure vi and en have the SAME keys at compile time
// If you add a key to vi but forget en (or vice versa), TypeScript will error here
type ViKeys = keyof typeof translations.vi;
type EnKeys = keyof typeof translations.en;
type _AssertViHasAllEnKeys =
  Record<EnKeys, string> extends Record<ViKeys, string>
    ? true
    : "ERROR: translations.vi is missing keys that exist in translations.en";
type _AssertEnHasAllViKeys =
  Record<ViKeys, string> extends Record<EnKeys, string>
    ? true
    : "ERROR: translations.en is missing keys that exist in translations.vi";
// These will cause compile errors if keys don't match:
const _viCheck: _AssertViHasAllEnKeys = true;
const _enCheck: _AssertEnHasAllViKeys = true;
// Suppress unused variable warnings
void _viCheck;
void _enCheck;

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

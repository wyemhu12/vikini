# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

> [!NOTE]
> Các bản ghi lịch sử phát hành từ ngày 2026-10-24 trở về trước (<= 2026-10-24) được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).

---

## 2026-11-10: Vikini 3.0 Phase 3C -- Composer Toggles, Chips, Mobile Options Sheet, Streaming Hairline

- **H2 (`ChatControls.tsx`, `InputForm.tsx`, `ComposerLeadingControls.tsx`, `ComposerChip.tsx`)**: bỏ thanh viên thuốc phía trên ô nhập; toggle "Tìm web" / "Luôn tìm kiếm" thành nút `aria-pressed` có icon và nhãn chữ thường (bỏ "WEB OFF", "ALWAYS SEARCH OFF"), nằm ở hàng dưới ô nhập ngay sau "+". Quy tắc khóa giữ như cũ (vẫn bật/tắt được khi đang stream).
- **Chip (`ThinkingLevelSelector.tsx`, `GemQuickSwitch.tsx`, `PersonaQuickSwitch.tsx`, `thinkingOptions.ts`)**: "Suy luận: Vừa", "Gem: …", "Persona: …"; menu mức suy luận bỏ chữ in hoa, mức tắt ghi "Tắt" (key `thinkingOff`); danh sách mức lấy từ `getAvailableThinkingLevels`.
- **Cột chat hẹp / mobile (`ComposerOptionsSheet.tsx`)**: nút "Tùy chọn" kèm số tùy chọn đang bật, mở bottom sheet: Tìm web, Luôn tìm kiếm (switch + mô tả), Mức suy luận (radiogroup, ←/→), Gem, Persona, Model, Tham số cục bộ, Đính kèm ảnh hoặc tệp. Điểm chuyển theo bề rộng cột chat (`@3xl/chat`), không theo viewport, để ô nhập không chật khi panel ngữ cảnh mở.
- **Vệt stream**: vạch `--accent` 2px trên mép ô nhập khi đang trả lời; tắt nhấp nháy khi `prefers-reduced-motion`.
- **i18n**: thêm `webSearchToggle`, `webSearchDesc`, `alwaysSearchDesc`, `composerOptions`, `composerOptionsActive`, `attachFileOrImage`, `gemChip`, `personaChip`, `thinkingOff`, `conflictWarning` (trước đây cảnh báo Gem + Persona chỉ có chuỗi dự phòng tiếng Anh).

---

## 2026-11-10: Vikini 3.0 Phase 3B -- Unbubbled Messages, Compact Actions, Chat Header

- **Messages (`ChatBubble.tsx`, `BubbleAvatar.tsx`, `ChatMessagesArea.tsx`)**: tin AI không nền, dòng đầu = avatar 24px + tên model đã dịch ("(cũ)" cho id cũ); tin người dùng là bong bóng `--raised`, bỏ avatar "ME"; nhịp dọc 28px (`py-3.5`) thay cho ~120–150px.
- **H6 (`MessageActions.tsx`)**: thanh thao tác chỉ icon (32px, `aria-label` + title), bỏ chữ UPPERCASE; Xóa chuyển vào menu "⋯"; desktop hiện khi hover/focus, luôn hiện với tin AI cuối.
- **Header chat desktop (`ChatHeader.tsx`)**: tiêu đề đoạn chat, dòng "Dự án · tên", menu Đổi tên / Xóa.
- **Disclaimer**: một dòng chữ thường màu `--faint` (bỏ in hoa, giãn chữ).

---

## 2026-11-09: Vikini 3.0 Phase 3A -- Model Picker, Global Command Palette, Legacy Model Names

- **C1 (`ModelSelector.tsx`, `ModelPickerList.tsx`, `lib/core/modelPicker.ts`, `lib/store/recentModelsStore.ts`, `layout/hooks/useIsDesktop.ts`)**: bộ chọn model một danh sách có ô tìm (không phân biệt hoa thường & dấu), bộ lọc `aria-pressed` (Tất cả/Nhanh/Suy luận/Miễn phí/Máy cục bộ), nhóm "Gần đây" (3 model), nhóm theo nhà cung cấp, điều hướng ↑↓ Enter Esc, model bị khóa ghi "Cần nâng hạng"; popover né mép trên desktop, bottom sheet trên mobile; bỏ 2 tab Providers/Service.
- **Command Palette toàn cục (`GlobalCommandPalette.tsx`, `lib/store/commandPaletteStore.ts`)**: ⌘K và nút ⌘K trên thanh icon ở mọi trang đã đăng nhập ngoài Chat (lệnh đi tới khu vực, đổi sáng/tối, ngôn ngữ, đoạn chat gần đây); bỏ qua ⌘K trong ô nhập/editor (Quick Edit Novelcrafter).
- **M1 (`CommandPalette.tsx`)**: bỏ nhãn "Esc" trùng nút ✕, bỏ viền focus lồng, mục ngôn ngữ ghi đích ("Đổi ngôn ngữ → English"); hỗ trợ `extraCommands`.
- **M2 (`ChatBubble.tsx`, `BubbleAvatar.tsx`)**: tooltip model của tin nhắn cũ hiển thị tên model mới + "(cũ)" hoặc id + "(đã ngừng)" thay cho id thô.

---

## 2026-11-09: Vikini 3.0 Phase 2B -- Icon Rail, Context Panel, Sidebar Split

- **App shell (`AppRail.tsx`, `RailMenus.tsx`, `ContextPanelContent.tsx`, `MobileNavDrawer.tsx`, `Sidebar.tsx`)**: thanh icon 64px trên desktop (Đoạn chat mới luôn đứng đầu, Chat, Gems & Persona, Ảnh, Novelcrafter, ⌘K ở Chat, Cài đặt = ngôn ngữ + theme, Tài khoản = Admin/Đăng xuất) + panel ngữ cảnh 272px theo khu vực với nút riêng ("Dự án mới", "Truyện mới"); `Sidebar.tsx` 645 → 222 dòng; bỏ chế độ sidebar icon thu gọn.
- **Layout state (`lib/store/layoutStore.ts`, `lib/utils/safeStorage.ts`, `layout/utils/shellNav.ts`)**: trạng thái ẩn panel theo khu vực, nhớ qua trang (`persist` + `skipHydration`, rehydrate sau mount); Novelcrafter mặc định focus mode; chuỗi padding lặp ở 5 nơi gộp vào `getShellPaddingClass()`.
- **Header desktop** ẩn trên các trang có thanh icon (logo/ngôn ngữ/theme đã lên rail); `useChatShortcuts.openCommandPalette` cho nút ⌘K; trang Gems có link sang Persona.

---

## 2026-11-09: Vikini 3.0 Phase 2A -- Shared Page Frame, Mobile Navigation, Fonts

- **C2 / C6 (`HeaderBar.tsx`, `ChatApp.tsx`, `ImageGenStudio.tsx`, `NovelcrafterStudioApp.tsx`)**: gỡ nút menu nổi kéo-thả (`FloatingMenuTrigger.tsx` đã xóa); header có nút ☰ 44px cố định bên trái trên mobile và nền `--bg` 85% + blur + viền `--line`.
- **C5 (`AppFrame.tsx`, `useAppFrameState.ts`)**: khung trang dùng chung (sidebar + header + vùng cuộn) cho Gallery, Describe, Gems, Personas, Project — hết trang ngõ cụt.
- **M4**: không còn `<main>` lồng nhau; sidebar dùng `<nav aria-label>`; mỗi trang có một `h1` (ẩn ở Chat, Image Studio, Novelcrafter).
- **M8 (`components/ui/page-header.tsx`, `components/ui/empty-state.tsx`)**: tiêu đề trang và trạng thái trống dùng chung; Gallery trống có nút "Tạo ảnh đầu tiên"; tiêu đề Describe bỏ gradient màu thô.
- **Font**: Be Vietnam Pro / Newsreader / JetBrains Mono (subset `vietnamese`) thay Geist; tùy chọn font "serif" của bản thảo Novelcrafter giờ là Newsreader.

---

## 2026-11-08: Vikini 3.0 Phase 1 -- Semantic Tokens & 5 Themes (Dark/Light)

- **Tokens & Themes (`src/app/styles/themes/{hoanghon,muc,reu,sen,than}.css`, `_shared/{base,tokens,utilities}.css`, `src/app/globals.css`)**:
  - Thay 16 theme cũ (`focus/`, `glassmorphism/`, `ra2/`) bằng 5 theme × sáng/tối với 11 token ngữ nghĩa (`--bg`, `--surface`, `--raised`, `--line`, `--text`, `--muted`, `--faint`, `--accent`, `--on-accent`, `--soft`, `--glow`); Hoàng Hôn tối là mặc định.
  - Giữ tên biến cũ dưới dạng alias trong `base.css`; nền trang chuyển sang `--bg` (`--surface` giờ là panel).
- **Theme model & migration (`src/lib/config/theme-config.ts`, `src/app/features/layout/{providers.tsx,hooks/useThemeKeyMigration.ts}`, `src/app/features/chat/hooks/useTheme.ts`)**:
  - Mô hình family × mode; `resolveThemeKey` map 16 id cũ (`Object.hasOwn`); `getThemeClassMap()` (object prototype null) cho phép id cũ được tô đúng ngay lần vẽ đầu, sau đó hook migration ghi đè localStorage.
- **UI (`ThemeMenuItems.tsx`, `HeaderBar.tsx`, `NovelcrafterTopBar.tsx`, `PromptStudioApp.tsx`, `CommandPalette.tsx`, `ChatApp.tsx`)**: menu chọn theme + chế độ dùng chung; Command Palette chuyển sáng/tối; gỡ `ChatThemeBackground` và ảnh RA2.
- **C4 contrast**: `text-white` trên `--accent` → `text-(--on-accent)` tại `error.tsx`, `not-found.tsx`, `InputForm.tsx`, `FileLightbox.tsx` (2 chỗ), `CreateProjectModal.tsx`.
- **i18n**: thêm `themeHoangHon/Muc/Reu/Sen/Than`, `themeMode/Dark/Light`; xóa 16 key theme cũ và 3 key nhóm.

---

## 2026-11-03: Migration -- Gemini 2.5 Deprecation (`gemini-3.5-flash-lite` & `gemini-3.8-flash`)

- **Model Registry & Prototype-Safe Alias Resolution (`src/lib/core/{modelRegistry,modelRegistry.test}.ts`, `src/lib/utils/translations/{vi,en}.ts`, `src/app/features/chat/components/hooks/useChatTranslations.ts`)**:
  - Thay thế `gemini-2.5-flash` bằng `gemini-3.5-flash-lite` (`DEFAULT_MODEL` mới, `1,048,576` context window, `65,536` maxOutputTokens, nhóm `low-latency`, hỗ trợ `minimal`/`low`/`medium`/`high`) và thay thế `gemini-2.5-pro` bằng `gemini-3.8-flash` (`1,048,576` context window, `65,536` maxOutputTokens, nhóm `reasoning`, hỗ trợ `low`/`medium`/`high` — không hỗ trợ `minimal`).
  - Ánh xạ ngược `"gemini-2.5-flash" → "gemini-3.5-flash-lite"` và `"gemini-2.5-pro" → "gemini-3.8-flash"` trong `MODEL_ALIASES`, đồng thời siết `normalizeModelForApi` dùng `Object.hasOwn(MODEL_ALIASES, raw)` để chặn các khóa kế thừa từ `Object.prototype` (`"constructor"`, `"__proto__"`, `"toString"`).
  - Bổ sung khóa dịch song ngữ (`modelDescFlashLite35`, `modelDescFlash38`, `"gemini-3.5-flash-lite"`, `"gemini-3.8-flash"`) và dọn dẹp 2 khóa mô tả cũ (`modelDescFlash25`, `modelDescPro25`).
- **Gemini 3.x Strict Validation Hardening & Legacy `thinkingBudget` Removal (`src/app/api/chat-stream/streaming/{gemini-stream,thought-signatures,types}.ts`, `src/app/features/chat/components/hooks/useThinkingLevel.ts`, `src/lib/features/novelcrafter/{novelcrafterStreamRunner.server,modelGuards.server,modelDisplay}.ts`)**:
  - Gỡ bỏ hoàn toàn nhánh `thinkingBudget: -1` của Gemini 2.5 và các hàm không còn sử dụng (`isGemini25Model`, `isGemini3FlashModel`); chuẩn hóa `apiModel = normalizeModelForApi(model)` cho cả lượt gọi chính và lượt gọi tiếp nối sau Function Call.
  - Bổ sung `buildFunctionResponse` và `ensureFunctionCallSignature` trong `thought-signatures.ts` cùng `contConfig.thinkingConfig` để bảo toàn `thoughtSignature`, `id`, `name` và mức suy luận qua các bước gọi công cụ nhiều lượt.
  - Cập nhật `isValidGenerationModel` và `resolveModelDisplayInfo` của Novelcrafter (kèm `Object.hasOwn(DIRECT_API_MODEL_DISPLAY_MAP, raw)`) để tương thích ngược với các truyện cũ lưu model `gemini-2.5-flash` / `gemini-2.5-pro`.
- **One-Shot Gemini Helpers & Vision/Image Routes (`src/lib/core/{geminiSdkHelpers,autoTitleEngine}.ts`, `src/app/api/{describe-image,generate-image}/route.ts`)**:
  - Tạo module `src/lib/core/geminiSdkHelpers.ts` (`buildMinimalThinkingConfig`, `extractGeminiResponseText`) để kẹp mức suy luận tối thiểu hợp lệ cho từng model (`MINIMAL` trên 3.5 Flash-Lite, `LOW` trên 3.8 Flash) và lọc bỏ mọi part `thought: true` ở nhánh fallback `candidates`.
  - Chuyển `FALLBACK_MODEL` của `autoTitleEngine.ts`, model của `/api/describe-image` và Prompt Enhancer của `/api/generate-image` sang `DEFAULT_MODEL` (`gemini-3.5-flash-lite`), siết guard Enhancer chỉ nhận Gemini text model trong `SELECTABLE_MODELS`, và cố định `export const maxDuration = 30;` tại dòng 18 của `src/app/api/describe-image/route.ts` dưới định dạng chuẩn Prettier (`TC-G4 & TC-G5`).
- **Database Migration (`database-migrations/20261103000000_migrate_gemini_25_to_35_38.sql`)**:
  - Thêm bản migration SQL idempotent cập nhật `rank_configs.allowed_models` (`gemini-3.5-flash-lite` cho `basic`/`pro`/`admin`, `gemini-3.8-flash` cho `admin` và các rank đang có `gemini-2.5-pro`, sau đó gỡ bỏ 2 ID `gemini-2.5-*`).

---

## 2026-11-02: Documentation -- Comprehensive Living Docs Synchronization & Changelog Archival

- **Living Documentation Sync (`docs/{features,models,contracts,architecture,database-schema,security,overview,README}.md`)**:
  - **`docs/features.md`**: Bổ sung **Novelcrafter Studio**, **Prompt Studio**, **Personas System**, **Conversation Branching**, **Image Edit & Vision**, **Message Favorites/Tags**, và **User Templates** vào bảng tổng hợp `## 1` và chi tiết `## 2`; chuẩn hóa tiền tố `src/` cho toàn bộ đường dẫn file, cập nhật đường dẫn `src/app/api/chat-stream/streaming/*`, `src/lib/features/voice/useSpeechSynthesis.ts`, `useTypewriterBuffer.ts`, bảng **Deep Thinking Timeout** (`ARGON` 15m, `STRATA_LOCAL` 5m), `## 3. Roadmap`, và sơ đồ phụ thuộc `## 4`.
  - **`docs/models.md`**: Bổ sung 6 model đang hoạt động trong `SELECTABLE_MODELS` (`gemini-3.1-flash-lite-preview`, `claude-haiku-4.5`, `claude-sonnet-4.5`, `x-ai/grok-4.3`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`); đồng bộ thông số `deepseek/deepseek-v4-pro` (OpenRouter / Baidu Qianfan FP8, `1M` context / `65K` output), `gemini-3-pro-image`, bảng **Gemini 3 / 4 Thinking** (`medium` cho cả Pro & Argon), và đầy đủ 19 `MODEL_ALIASES`.
  - **`docs/contracts.md`**: Đồng bộ toàn bộ 38 API endpoints thực tế (sửa `/api/files/cleanup` → `GET/POST /api/cron/cleanup`, bổ sung `/api/novelcrafter/*`, `/api/personas`, `/api/conversations/[id]/branch`, `/api/messages/*`, `/api/edit-image*`, `/api/describe-image`, `/api/user-templates`, `/api/admin/{audit-log,personas,stats}`); cập nhật wire format SSE (`event: token` `{"t"}`, `event: thinking` `{"thinking"}`, `event: done` `{"ok"}`, và 15 nhánh `event: meta`), `Conversation`, `MessageMeta`, `ChatStreamRequest`, `Project.embeddingModel` (`"gemini-embedding-2"`), và `KnowledgeSearchResult`.
  - **`docs/architecture.md`, `docs/database-schema.md`, `docs/security.md`, `docs/overview.md`, `docs/README.md`**: Cập nhật kiến trúc Compact Chat Composer (`InputModelControls.tsx` trong `InputForm.tsx`), số dòng thực tế của `ChatApp.tsx` / `ChatBubble.tsx`, biến môi trường `CRON_SECRET` & `STRATA_*`, luồng Cross-Model Critic (`Awaiting Critic` → `-Role critic`) trong sơ đồ MAS; bổ sung bảng `personas`, `admin_audit_logs` và các cột `conversations.{project_id,persona_id,last_message_preview}` vào `database-schema.md`; xóa bảng `allowed_mime_types` đã drop khỏi `security.md` và sửa đường dẫn `src/lib/core/supabase.server.ts`.
- **CHANGELOG Archival (`docs/CHANGELOG.md`, `docs/archive/CHANGELOG-legacy.md`)**:
  - Lưu trữ 5 bản ghi ngày `2026-10-24` sang `docs/archive/CHANGELOG-legacy.md` để đưa dung lượng `docs/CHANGELOG.md` về dưới ngưỡng `< 35,000 bytes` của `scripts/verify-docs.mjs`.

---

## 2026-10-30: Cleanup -- Remove 4 Deprecated OpenRouter Free Models

- **OpenRouter Free Model Registry & Translation Cleanup (`src/lib/core/{modelRegistry,modelRegistry.test}.ts`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Gỡ bỏ 4 model không còn miễn phí trên OpenRouter (`meta-llama/llama-4-maverick:free`, `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-3-27b-it:free`, `mistral/mistral-small-3.1-24b-instruct:free`) khỏi `SELECTABLE_MODELS` và `API_ALLOWED` trong `src/lib/core/modelRegistry.ts`, đảm bảo các cuộc trò chuyện hoặc request cũ sử dụng những ID này tự động fallback an toàn về `DEFAULT_MODEL` (`gemini-2.5-flash`).
  - Giữ nguyên tab `OpenRouter (Free)` (`providerId: "openrouter-free"`) trong bộ chọn model để tự động hiển thị trạng thái trống `"Sẽ có sau"` / `"Available later"` giống tab `GPT` cho các model miễn phí bổ sung trong tương lai.
  - Xóa đồng thời 4 khóa dịch mô tả không còn sử dụng (`modelDescLlama4Maverick`, `modelDescLlama33Instruct`, `modelDescGemma3`, `modelDescMistralSmall`) trong `vi.ts` và `en.ts`, đồng thời bổ sung bộ unit test `TC-ORF-01..08` trong `src/lib/core/modelRegistry.test.ts`.

---

## 2026-10-27: Governance & Tooling -- Optimize `@reviewer` for Gemini 4 Argon (High), Add Deterministic `scripts/verify-plan.mjs`, & Enforce Cross-Model Critic Pass

- **Goal-Oriented Reviewer & Implicit-Caching Prompt Architecture (`.agents/agents/{reviewer,planner,qa}/agent.md`, `.agents/scripts/claude-reviewer-prompt.md`, `.agents/agents/reviewer/{allowlist,evidence-bar,mental-simulation}.md`)**:
  - Chuyển `model: pro` sang `model: inherit` trong frontmatter của `@reviewer`, `@planner`, và `@qa` để subagent kế thừa trực tiếp `Gemini 4 Argon (High)` từ phiên chat chính.
  - Thay thế quy trình 7 bước tuần tự thủ công trong `.agents/agents/reviewer/agent.md` bằng cấu trúc hướng mục tiêu (**Objective**, **Fail Criteria**, **Verification Tools**), sắp xếp phần luật tĩnh lên đầu và biến động (`{{PLAN_FILE}}`, `{{REVIEW_MODE}}`) xuống cuối file để tối ưu hóa implicit caching.
  - Chuẩn hóa kỷ luật bằng chứng (`N/A` cho ô không áp dụng, `UNVERIFIED` cho `PASS` thiếu dẫn chứng, cấm trích chính file plan làm bằng chứng, nâng mức lỗi khi phân vân), bắt buộc bảng `#### Critic Findings` có tối thiểu 3 mục kèm `file:line`, loại bỏ câu mệnh lệnh IN HOA / "TUYỆT ĐỐI" kèm câu giải thích lý do kỹ thuật, và định dạng chuẩn Prettier cho bảng mẫu trong `.agents/agents/reviewer/agent.md` để giữ kích thước `< 7,500` ký tự sau khi `lint-staged` chạy.
- **Deterministic Plan Verifier & Cross-Model Critic Workflow (`scripts/verify-plan.mjs`, `scripts/verify-plan.test.ts`, `.agents/scripts/{command-policy.js,command-policy.test.ts,plan-scope.test.ts,run-claude.ps1}`, `.agents/rules/05-plan-review.md`)**:
  - Xây dựng `scripts/verify-plan.mjs` (kèm 19 unit/CLI tests trong `scripts/verify-plan.test.ts`) kiểm tra 7 heading bắt buộc của `## Technical Plan`, xác thực mọi trích dẫn `file:line` trên codebase thật (chặn path traversal và `.env*`), phát hiện cờ `CRITIC_REQUIRED` (Security/Governance/Database), và kiểm tra sàn `#### Critic Findings` (>= 3 dòng có `file:line` hợp lệ).
  - Bổ sung chế độ `-Role critic` vào `.agents/scripts/run-claude.ps1` và mở allowlist cho `node scripts/verify-plan.mjs <plan-path>` trong `.agents/scripts/command-policy.js`: khi kế hoạch nhạy cảm được `@reviewer` duyệt sơ bộ với trạng thái trung gian `- **Status**: Awaiting Critic` (giữ khóa repo fail-safe), Claude CLI chạy thêm lượt phản biện chéo xuất `AGREE` (mở khóa `[PLAN_APPROVED]`) hoặc `DISAGREE_EVIDENCE` (trả về `Changes Requested`).

---

## 2026-10-26: Feature & UI/UX -- Dynamic Prompt Studio Source Tooltips Across All Novelcrafter AI Action Buttons

- **Dynamic Prompt Context Source Resolver (`src/lib/features/novelcrafter/promptSourceSummary.ts`, `src/lib/features/novelcrafter/promptSourceSummary.test.ts`)**:
  - Xây dựng pure function `resolvePromptSourceSummary(actionKey, settings, options)` phân tách 11 nút ngữ cảnh của 37 hành động AI thành nhóm **Hồ sơ Truyện (`<story_bible>`)**, **Ngữ cảnh Chương (`<chapter_context>`)**, và **Đầu vào trực tiếp cố định** (`<braindump>`, `<selected_text>`, `<current_section>`, `<key_details>`), đồng thời tự động bù các required nodes (`preceding_prose`, `scenes`) và đánh dấu cờ `isCustomized` / `hasCustomDirective` theo cấu hình Prompt Studio.
- **Radix Portal Source Tooltip & Full Studio Button Coverage (`src/app/features/novelcrafter/components/{PromptSourceTooltip,PromptSourceTooltip.test,ChapterAiBrainstormMenu,StoryBibleSectionCard,ChapterAiToolbar,ChapterAiToolMenus,ChapterDraftBeatsCard,ChapterEmptyStateActions,ChapterSelectionToolbar}.tsx`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Triển khai component `PromptSourceTooltip` sử dụng `@radix-ui/react-tooltip` `<TooltipPrimitive.Portal>` để chống cắt viền bởi các khung cuộn `overflow-hidden` / `overflow-x-auto`, tự động đồng bộ đa tab qua `ensurePromptStudioHydrated()` trên sự kiện `focus` và `storage`.
  - Tách `ChapterAiBrainstormMenu.tsx` khỏi `ChapterAiToolMenus.tsx` để bảo toàn giới hạn <= 500 dòng và gắn `PromptSourceTooltip` lên toàn bộ nút AI sinh văn bản trên 6 bề mặt của Novelcrafter Studio.
  - Bổ sung 10 khóa dịch song ngữ Việt/Anh (`novelcrafterTooltip*`), hiển thị nhận xét trong `ChapterFeedbackGutter.tsx` dưới dạng danh sách gạch đầu dòng kèm nút đóng `✕`, tự động ẩn thanh định vị đoạn trích (`ChapterEditorWorkspace.tsx`) khi đóng cửa sổ Feedback hoặc khi thẻ nhận xét đã `resolved` kèm fallback nhảy tới `item.suggestion` trong `ChapterManuscriptEditor.tsx`, sửa lỗi khoảng cách dòng trống kép, bổ sung bộ chọn Ngôn ngữ / Giao diện màu trên `NovelcrafterTopBar.tsx` & `PromptStudioApp.tsx`, và loại bỏ circular import giữa `promptStudioLabels.ts` và `ChapterAiToolbar.tsx` gây lỗi TDZ khi `next build` prerender `/novelcrafter`.

---

## 2026-10-25: Refactor & UI/UX -- Remove Deep Research Feature & Compact Chat Composer (Move Model & Thinking Selectors Into Chat Bar)

- **Complete Deep Research Feature Removal (`src/app/api/deep-research/**`, `src/lib/features/research/**`, `src/app/features/research/**`, `src/app/features/chat/components/{ChatDeepResearch,hooks/useDeepResearchMode,hooks/useResearchAwareSend,ChatApp,ChatConversationView,ChatOverlays,DashboardView,ChatMessagesArea}.ts(x)`, `src/lib/core/{genaiClient,limits,modelRegistry}.ts`, `src/app/admin/components/RankConfigManager.tsx`, `src/app/api/admin/rank-configs/route.ts`, `src/lib/utils/translations/{vi,en}.ts`)\*\*:
  - Xóa hoàn toàn 17 file mã nguồn và test của tính năng Nghiên Cứu Sâu (4 API routes `/api/deep-research/**`, `researchService.server.ts`, `types.ts`, 7 UI components trong `src/app/features/research/components/**`, `ChatDeepResearch.tsx`, `useDeepResearchMode.ts`, `useResearchAwareSend.ts`).
  - Dọn dẹp các hàm lõi không còn dùng (`createResearchInteraction`, `getResearchInteraction` trong `genaiClient.ts`; `getResearchDailyCount`, `tryClaimResearchSlot` và các trường `daily_research_limit` / `features.deep_research` trong `limits.ts`; `modelSupportsDeepResearch` trong `modelRegistry.ts`).
  - Gỡ bỏ ô `Daily Research Limit` cùng nút/modal `Configure Features` trong `RankConfigManager.tsx`, bỏ nhánh ghi `daily_research_limit` trong `PATCH /api/admin/rank-configs`, và xóa 46 khóa dịch `deepResearch*` / `configureFeatures` / `dailyResearchLimit` đồng thời ở `vi.ts` và `en.ts`.
- **Compact Chat Toolbar & Inline Composer Controls (`src/app/features/chat/components/{InputModelControls,InputForm,ChatControls,ModelSelector,ThinkingLevelSelector}.tsx`)**:
  - Thu gọn thanh công cụ phía trên khung chat (`ChatControls.tsx`) bằng cách đưa bộ chọn **Model** (`ModelSelector` với `variant="inline"`) và **Mức độ suy luận** (`ThinkingLevelSelector` kèm icon `Brain`) xuống nằm bên trong thanh nhập chat (`InputForm.tsx` qua prop `trailingControls`) ở cụm bên phải trước nút Mic và Send (tương tự giao diện Gemini / ChatGPT).
  - Chuyển `InputForm.tsx` sang bố cục 2 hàng thống nhất trên mọi kích thước màn hình (hàng 1: ô nhập văn bản rộng toàn khung `basis-full`; hàng 2: nút `[+]` bên trái và cụm `[Model ▾] [🧠 Level ▾] [Mic] [Send]` bên phải, tự động ẩn Model/Thinking khi bật chế độ Tạo ảnh).
  - Bổ sung 2 file unit test mới (`genaiClient.test.ts`, `InputModelControls.test.tsx`) và cập nhật 5 file test co-located (`limits.test.ts`, `modelRegistry.test.ts`, `InputForm.test.tsx`, `rank-configs/route.test.ts`, `allowed-models/route.test.ts`).

---

## 2026-10-25: Feature -- Novelcrafter Prompt Studio (`/novelcrafter/prompts`) & Custom Write Word Length (`50–4000` Words)

- **Custom Write Word Count Input & Preset Upgrade (`src/lib/features/novelcrafter/{types,writeLength}.ts`, `src/app/features/novelcrafter/components/{ChapterAiToolbar,ChapterAiToolMenus}.tsx`)**:
  - Nâng các mốc chọn nhanh độ dài từ cho tính năng **Viết tiếp** (`NOVELCRAFTER_WRITE_LENGTH_OPTIONS`) từ `[150, 300, 500, 750]` lên `[300, 600, 1000, 2000]` từ và bổ sung ô nhập số từ tùy ý (`50–4000` từ) ngay trong popover **Viết tiếp**, tự động làm tròn và kẹp biên an toàn qua `clampWriteLengthWords(raw, fallback)`.
- **Story Bible Draft Dependencies Upgrade (`src/lib/features/novelcrafter/{storyBibleDependencies,promptBuilder,pruneStoryBibleForStream}.ts`)**:
  - Tách module `storyBibleDependencies.ts` khỏi `promptBuilder.ts` và bổ sung `<synopsis>` (kèm fallback `<synopsis fallback="braindump">` khi synopsis trống) cùng `<outline>` vào tập ngữ cảnh mặc định của `bible:draft` (**Viết bản thảo chương** trong Story Bible), đồng bộ với `write:first_draft_rough`.
- **Novelcrafter Prompt Studio Engine & Guardrails (`src/lib/features/novelcrafter/{contextNodes,promptActions,promptDirectiveDefaults,promptStudioPresets,promptStudioSettings,promptStudioStore,promptStudioPreview,streamRequestBody,featureDirectives}.ts`)**:
  - Xây dựng danh mục 37 khóa hành động (`NovelcrafterPromptActionKey`) trên 6 nhóm tính năng (`bible`, `write`, `rewrite`, `feedback`, `expand`, `brainstorm`) và 11 nút ngữ cảnh (`NOVELCRAFTER_CONTEXT_NODES`: `synopsis`, `outline`, `characters`, `worldbuilding`, `style`, `genre`, `pov_tense`, `story_so_far`, `scenes`, `previous_chapter_continuity`, `preceding_prose`).
  - Cho phép tùy chỉnh chỉ dẫn gốc (`promptDirectiveOverride`, tối đa `4,000` ký tự) hỗ trợ 4 biến động (`{{tone}}`, `{{criteria}}`, `{{senses}}`, `{{category}}`), lọc chống thoát thẻ XML qua `sanitizeDirectiveOverride` (escape toàn bộ thẻ đóng và `<feature_instruction>`, chỉ khôi phục các thẻ mở tham chiếu trong allowlist), đồng thời khóa cứng các phần đuôi định dạng parser-critical (`FEEDBACK_FORMAT_CONTRACT`, `=== OPENING 1/2/3 ===`, `"Return ONLY the rewritten passage..."`, và chế độ `bible` `actionMode: "rewrite"`).
  - Cung cấp 3 bộ mẫu tích hợp (`default`, `lean_context`, `deep_continuity`) và tối đa 20 bộ mẫu tùy chỉnh lưu trong Zustand `localStorage` (`vikini:novelcrafter:prompt-studio` với `skipHydration: true`, `safeLocalStorage` chống đệ quy `QuotaExceededError`, và `ensurePromptStudioHydrated()` đồng bộ đa tab trước mỗi lần stream).
- **Standalone Prompt Studio Route & Bilingual UI (`src/app/novelcrafter/prompts/page.tsx`, `src/app/features/novelcrafter/{hooks/usePromptStudioController,components/prompt-studio/*,components/NovelcrafterTopBar,components/GemPersonaRoutingModal}.ts(x)`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Tạo trang `/novelcrafter/prompts` với bố cục 2 cột (danh sách 37 nút AI theo 6 nhóm bên trái; trình sửa chỉ dẫn, chèn biến động 1-click, công tắc bật/tắt 11 nút ngữ cảnh, và khung **Live XML Prompt Preview** bên phải) cùng lối vào từ `NovelcrafterTopBar` và `GemPersonaRoutingModal`.
  - Bổ sung 78 khóa dịch song ngữ Việt/Anh và 10 file unit test co-located mới + cập nhật 6 file test hiện hữu (`40/40` test files, `235/235` tests pass).

---

## 2026-10-25: CI & Tooling -- Fix Clean-Checkout `ENOENT` on `.claude/settings.local.json`, Upgrade GitHub Actions to Node.js 24 Runtime & Fast-Track UI Polish

- **CI Test Harness Fix for Gitignored `.claude/settings.local.json` (`.agents/scripts/code-freeze-guard.test.ts`)**:
  - Khắc phục lỗi `ENOENT: no such file or directory, open '.../.claude/settings.local.json'` trên GitHub Actions tại `TC-H & TC-I`: thay lệnh `fs.readFileSync` trực tiếp trên file cấu hình cục bộ (đang bị ignore trong `.gitignore`) bằng helper `readOptionalText(filePath)` kiểm tra `fs.existsSync(filePath)` trước khi đọc, bổ sung assertion xác nhận nhánh file không tồn tại trả về `""`, và giữ nguyên vòng lặp kiểm tra 5 chuỗi cấm (`git add`, `git commit`, `git push`, `git checkout`, `deep-research`).
- **GitHub Actions Node.js 24 Runtime Upgrade (`.github/workflows/ci.yml`)**:
  - Nâng cấp `actions/checkout@v4` → `actions/checkout@v5` và `actions/setup-node@v4` → `actions/setup-node@v5` (chuyển action runtime nội bộ từ `node20` sang `node24`, xử lý triệt để cảnh báo ngừng hỗ trợ Node.js 20 trên GitHub Actions).
  - Thay `node-version: 24` cố định bằng `node-version-file: .nvmrc` để đồng bộ nguồn sự thật phiên bản Node.js (`24`) giữa môi trường local và CI.
- **Fast-Track UI Polish (`src/app/features/chat/components/{DashboardView,ChatControls,ModelSelector}.tsx`, `src/app/features/novelcrafter/components/{NovelcrafterTopBar,ChapterDraftBeatsCard,SheetSubToolbar,ManuscriptTypographyMenu}.tsx`)**:
  - Sửa lỗi không hiển thị bảng chọn model (`ModelSelector.tsx`) khi đặt trong thanh công cụ có `overflow-x-auto`: chuyển `ModelSelector.tsx` sang sử dụng Radix `<Popover>` + `<PopoverContent>` (render qua Portal tại `document.body` với `z-(--z-popover)`) và thêm `sm:overflow-visible` / `md:overflow-visible` tại `NovelcrafterTopBar.tsx` và `ChatControls.tsx`.
  - Sửa lỗi tràn các nút điều khiển ra ngoài viên thuốc khung nhập Chat trên màn hình welcome (`DashboardView.tsx`, `ChatControls.tsx`), căn giữa thẻ Phân cảnh Chương khớp độ rộng trang giấy bản thảo (`MANUSCRIPT_SHEET_CLASS` trong `ChapterDraftBeatsCard.tsx`), và đưa bộ chọn cỡ chữ / giãn dòng / kiểu chữ (`ManuscriptTypographyMenu`) lên thanh `SheetSubToolbar.tsx` hiển thị cố định cho cả chương trống lẫn màn hình desktop.

---

## 2026-10-25: Refactor & UI/UX -- Novelcrafter Rich Manuscript Editor, 4-Tier Responsive Layout & Chat/Bilingual UI Audit (`P1` / `P2` / `P3`)

- **P1 — Zero-Dependency Rich Manuscript Editor (`src/lib/features/novelcrafter/{manuscriptMarkup,manuscriptDecorations,manuscriptHistory,manuscriptTypography,selectionBubblePlacement,quoteScrollPositioning,codexMatcher}.ts`, `src/app/features/novelcrafter/{utils/manuscriptDomOffsets,utils/manuscriptSheetClasses,hooks/useManuscriptEditor,hooks/useManuscriptTypography,hooks/useChapterEditorController,components/ChapterManuscriptEditor,components/ManuscriptTypographyMenu,components/CodexEntityPreview,components/ChapterSelectionToolbar,components/SheetSubToolbar,components/ChapterEditorWorkspace}.ts(x)`)**:
  - Thay thế hoàn toàn `<textarea>` thuần trong `ChapterEditorWorkspace.tsx` bằng trình soạn thảo bản thảo `contentEditable="plaintext-only"` không phụ thuộc thư viện ngoài (`ChapterManuscriptEditor.tsx` + `useManuscriptEditor.ts` + `manuscriptDomOffsets.ts`), bảo toàn bất biến `1:1` chỉ số ký tự giữa chuỗi Markdown gốc và các nút văn bản DOM (kể cả tiếng Việt Telex/VNI, CJK IME composition, và emoji surrogate pairs).
  - Hỗ trợ định dạng trực tiếp trong dòng chữ (`H1`, `H2`, **in đậm**, _in nghiêng_, ~~gạch ngang~~, ngắt cảnh `***`, danh sách), bộ chọn kiểu chữ & trang giấy (`ManuscriptTypographyMenu.tsx`: `serif`/`sans`/`mono`, cỡ chữ `sm`–`xl`, giãn dòng, thụt lề dòng đầu đoạn văn lưu trong `localStorage`), và ngăn xếp Undo/Redo độc lập có gộp phím gõ (`manuscriptHistory.ts`).
  - Triển khai bộ cắt đoạn trang trí nguyên tử không lồng nhau (`manuscriptDecorations.ts`): gạch chân màu hổ phách `<mark data-feedback-id>` cho câu trích dẫn nhận xét mở (click nhảy tới thẻ nhận xét bên lề), tô sáng thực thể `<span data-codex-id>` cho nhân vật/thế giới trong Story Bible (`findCodexMentionRanges` + popover `CodexEntityPreview.tsx`), và giữ vùng chọn `.nc-selection` khi người dùng chuyển tiêu điểm sang menu AI hoặc ô nhập lệnh.
  - Nâng cấp thanh công cụ nổi theo vùng chọn (`ChapterSelectionToolbar.tsx` + `selectionBubblePlacement.ts`) với menu Rewrite 6 chế độ, Describe, Expand, Feedback, và ô nhập Quick Edit `Ctrl+K` ngay tại chỗ; định vị cuộn thẳng tới phần tử DOM `[data-feedback-id]` qua `getBoundingClientRect()` (xóa bỏ hoàn toàn cơ chế đo gương tạm `measureCaretOffsetTop` và `useAutoResizeTextarea.ts`).
- **P2 — Novelcrafter 4-Tier Responsive Layout (`src/lib/features/novelcrafter/studioLayout.ts`, `src/app/features/novelcrafter/{hooks/useDockedPanes,components/NovelcrafterStudioApp,components/ChapterAiToolbar,components/ChapterEmptyStateActions,components/NovelcrafterTopBar,components/NovelcrafterLeftNavigator,components/NovelcrafterHistoryPane,components/ChapterFeedbackGutter}.ts(x)`, `src/app/features/layout/components/HeaderBar.tsx`, `src/app/features/sidebar/components/Sidebar.tsx`)**:
  - Tự động thu gọn Sidebar chính khi vào `/novelcrafter` và ẩn `HeaderBar` toàn cục trên desktop (`hideOnDesktop`); đưa `ChapterAiToolbar` lên toàn chiều rộng phía trên các cột (`flex-nowrap` kèm `DropdownMenu` gom nút tràn trên màn hình nhỏ).
  - Bổ sung `maxDockedSidePanes` (`0` ở `<1180px`, `1` ở `1180–1535px`, `2` ở `1536–1919px`, `3` ở `>=1920px`) và `useDockedPanes` tự động đóng bảng cũ theo thứ tự LRU để trang giấy bản thảo luôn đạt độ rộng tối ưu và căn giữa (`mx-auto`); tự động đóng ngăn `Scenes` khi chương đã có nội dung và thu gọn `ChapterEmptyStateActions` thành 1 hàng chip; khắc phục lỗi cắt chữ tiêu đề truyện trên mobile và lỗi nút đóng `✕` của `Sheet` đè lên nút header (`isInSheet` -> `pr-10`).
- **P3 — Chat Layout, UI Token & Bilingual/A11y Audit (`src/app/features/chat/components/{ChatApp,ChatMessagesArea,ChatConversationView,ChatBubble,ChatDeepResearch,ChatControls,InputForm,TokenBadge}.tsx`, `src/app/features/layout/components/FloatingMenuTrigger.tsx`, `src/app/features/personas/components/PersonaQuickSwitch.tsx`, `src/app/features/novelcrafter/components/{StoryBibleWorkspace,StoryBibleSectionCard,InlineStoryBibleSection}.tsx`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Mở rộng khung hiển thị tin nhắn và thanh điều khiển Chat (`max-w-3xl xl:max-w-4xl 2xl:max-w-5xl`, gỡ bỏ `lg:max-w-[90%]`); gom mảng `controls` và `ControlDivider` có điều kiện trong `ChatControls.tsx` (1 hàng trên desktop, cuộn ngang trên mobile); đưa `<textarea>` trong `InputForm.tsx` lên hàng riêng rộng 100% trên mobile (`order-first basis-full md:order-none md:basis-auto md:flex-1`).
  - Khắc phục lỗi nối chuỗi class `"undefined"` và chuyển `FloatingMenuTrigger` sang mép phải giữa màn hình (`top-[45dvh] right-[calc(0.5rem+var(--sar,0px))]`); sửa các class CSS token trong `TokenBadge.tsx` và `PersonaQuickSwitch.tsx` (kèm xử lý lỗi `toast.error` + `logger.error`); thêm skip link `#main-content`, liên kết `htmlFor`/`useId` trong `StoryBibleWorkspace`, phân cấp thẻ tiêu đề `h2`/`h3`, thay thế chuỗi `"Sudowrite"` hiển thị cho người dùng bằng `"Novelcrafter"`, bổ sung đầy đủ các khóa dịch song ngữ Việt/Anh và 11 file unit test co-located (`1625/1625` tests pass).

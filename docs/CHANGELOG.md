# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

> [!NOTE]
> Các bản ghi lịch sử phát hành từ ngày 2026-10-24 trở về trước (<= 2026-10-24) được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).

---

## 2026-11-13: Gemini 3.1 Deprecation & `gemini-embedding-2` GA Migration

- **Gỡ bỏ hoàn toàn `gemini-3.1-flash-lite-preview` (đã shutdown 25/05/2026) và `gemini-3.1-pro-preview` (`modelRegistry.ts`, `en.ts`, `vi.ts`, `useChatTranslations.ts`, `streaming/utils.ts`)**: loại bỏ khỏi `SELECTABLE_MODELS`, `API_ALLOWED` và các key dịch thuật tương ứng; cập nhật `MODEL_ALIASES` để ánh xạ trực tiếp cả 2 ID cũ và 4 alias trung gian (`gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview` → `gemini-3.8-flash`; `gemini-3.1-flash-lite` → `gemini-3.5-flash-lite`) giúp hội thoại/story cũ trong DB không bị lỗi 404 hay rơi về default.
- **Sửa model gọi API gợi ý prompt (`src/app/api/prompt-suggest/route.ts`)**: chuyển từ `gemini-3.1-flash-lite-preview` (đã tắt) sang `gemini-3.5-flash-lite` và bổ sung bộ test `src/app/api/prompt-suggest/route.test.ts` (4 test cases).
- **Đồng bộ `GEMINI_EMBEDDING_API_MODEL` sang bản GA `gemini-embedding-2` (`src/lib/features/projects/embedding.server.ts`)**: bản `gemini-embedding-2-preview` đã được Google deprecate từ 06/11/2026 và tự động route sang `gemini-embedding-2` phía API nên việc đổi constant giúp mã nguồn khớp chuẩn GA mà không đổi hành vi runtime (nếu chất lượng RAG giảm trên tài liệu cũ, hướng xử lý là re-embed thay vì rollback constant).
- **Kiểm thử & Tài liệu (`modelRegistry.test.ts`, `embedding.server.test.ts`, `generate-image/route.test.ts`, `novelcrafterStreamRunner.server.test.ts`, `gemini-stream.test.ts`, `useThinkingLevel.test.ts`, `thinkingOptions.test.ts`, `docs/models.md`, `docs/database-schema.md`)**: bổ sung invariant `TC-G31-01..07` (bao gồm kiểm tra toàn bộ `MODEL_ALIASES` trỏ tới ID sống) và cập nhật tài liệu kiến trúc/model.

---

## 2026-11-12: Novelcrafter -- Prompt Studio IDE Overhaul (Semantic XML Tag Highlighting, 2-Column Split, Collapsible Sidebar & Shared Back Navigation)

- **Thanh điều hướng dùng chung & Bố cục 2 dải gọn nhẹ không tràn `375px` (`NovelcrafterAiSettingsWorkspace.tsx`, `NovelcrafterInheritanceTable.tsx`, `PromptStudioApp.tsx`, `PromptStudioPresetBar.tsx`)**: đưa nút **Quay lại Studio** (`onClose` / `backHref="/novelcrafter"`) và `PromptStudioPresetBar` lên thanh trên cùng dùng chung của `NovelcrafterAiSettingsWorkspace` để luôn hiển thị xuyên suốt trên cả hai tab (`Mặc định & thừa kế` và `Prompt Studio`), gỡ nút quay lại bị lặp trong `NovelcrafterInheritanceTable`, và truyền `initialTab="studio"` khi truy cập trực tiếp `/novelcrafter/prompts`.
- **Sidebar Hành động AI rộng rãi, nhóm Accordion thu/mở & Từ điển nhãn ngắn gọn (`PromptStudioActionList.tsx`, `promptStudioLabels.ts`, `vi.ts`, `en.ts`)**: mở rộng chiều ngang cột hành động trên desktop lên `md:w-64 lg:w-72` (`256px`–`288px`), gom 37 hành động vào 6 nhóm accordion thu/mở chuẩn ARIA kèm huy hiệu đếm tùy chỉnh, bảo vệ roving `tabIndex` không bị kẹt khi đóng nhóm đang chọn, và bổ sung bộ nhãn ngắn gọn tự nhiên để không còn cắt chữ `...` khi chuyển sang tiếng Việt.
- **Giao diện IDE 2 cột, Tô màu thẻ XML kiểu VS Code & Đồng bộ hai chiều (`xmlPreviewHighlighter.ts` mới, `base.css`, `PromptStudioActionEditor.tsx`, `PromptStudioContextToggles.tsx`, `PromptStudioXmlPreview.tsx`)**: chia đôi màn hình `lg+` thành khung chỉnh sửa bên trái (lưới 2 cột chip ngữ cảnh gắn huy hiệu `<tag>` chuẩn HTML5 `<label>` + sibling `<button>` `Crosshair`) và khung **Live XML Inspector** cao toàn phần bên phải; hiện thực bộ phân tích `parseXmlPreviewNodes` (**2-Pass Innermost LIFO Stack Pairing** lossless 100%) + `normalizeBlockDisplayChildren`, định nghĩa 4 nhóm màu ngữ nghĩa theo theme (`--xml-bible`, `--xml-style`, `--xml-chapter`, `--xml-directive` đạt tương phản WCAG 2.1 AA `>= 4.5` trên toàn bộ `360` phép đo pha alpha ở 10 theme Dark/Light), vẽ đường gióng thụt lề dọc `border-l` và đồng bộ sáng vùng/cuộn hai chiều giữa chip ngữ cảnh và khối `<tag>` tương ứng.

---

## 2026-11-12: Novelcrafter -- Write View UX Cleanup (Own-Scroll Manuscript Box, Fewer AI Entry Points, Visual Hierarchy, AI Settings Tabs, Mobile Header)

- **Khung bản thảo cuộn riêng (`ChapterEditorWorkspace.tsx`, `useManuscriptBoxHeight.ts`, `manuscriptViewport.ts`, `scrollParent.ts`, `ChapterManuscriptEditor.tsx`)**: trên desktop (≥ 768px) khung văn bản có thanh cuộn riêng, cao tới đáy vùng nhìn (trừ bàn phím ảo, tối thiểu 320px), tự tính lại khi đổi cỡ cửa sổ hoặc khi thẻ Beats/banner phía trên đổi cao; thanh cuộn ngoài dùng để xuống khối Story Bible. Nhảy tới trích dẫn Feedback cuộn đúng khung trong. Mobile giữ một thanh cuộn.
- **Ít lối vào AI hơn (`ChapterAiToolbar.tsx`, `ChapterAiToolMenus.tsx`, `ChapterDraftBeatsCard.tsx`, `ChapterEmptyStateActions.tsx`, `NovelcrafterOutlineDetailPanel.tsx`, `NovelcrafterAiComposer.tsx`)**: một nút "Viết bản nháp chương" duy nhất trên màn Write (bỏ nút trong thẻ Beats và thẻ Rough draft); toolbar chỉ còn hành động trên cả chương (Write, Feedback, Brainstorm), Rewrite/Describe & Expand chỉ ở bong bóng bôi đen; menu AI mở trong popover neo vào chính nút (bấm lại/Esc/click ngoài để đóng, trả focus); Composer chỉ còn ô lệnh tự do (chưa bôi đen → viết tiếp có hướng dẫn, có bôi đen → viết lại đoạn chọn).
- **Thứ bậc thị giác (`SheetSubToolbar.tsx`, `ChapterSelectionToolbar.tsx`, `useSelectionBubblePosition.ts`, `selectionBubblePlacement.ts`)**: chỉ một nút nền cam trên màn Write, trạng thái đang chọn dùng viền thay vì tô nền; nút "Phân cảnh" chuyển xuống thanh định dạng; số từ chỉ hiện ở TopBar; nhãn "Nhận xét (N)"; bong bóng bôi đen nổi qua portal `position: fixed`, nằm trên đoạn chọn, tự ẩn khi đoạn chọn cuộn ra khỏi khung (chế độ dính đáy trên pointer thô giữ nguyên); dấu Markdown mờ hơn khi không gõ.
- **Thanh trái & menu "⋯" (`NovelcrafterLeftNavigator.tsx`, `NovelcrafterTopBarMenu.tsx`)**: Story Bible ở thanh trái thành link (bỏ công tắc); Ngôn ngữ/Theme bỏ khỏi menu "⋯" trên desktop (đã có ở menu cài đặt góc trái dưới), vẫn có trên mobile.
- **AI Settings (`NovelcrafterAiSettingsWorkspace.tsx`, `usePromptStudioController.ts`, `promptStudioPreview.ts`, `PromptStudioXmlPreview.tsx`, `PromptStudioApp.tsx`)**: hai tab toàn chiều ngang "Mặc định & thừa kế" / "Prompt Studio"; Prompt preview dùng dữ liệu truyện đang mở (trộn theo mục, cờ ẩn AI lấy từ truyện thật), mục trống mới dùng mẫu và được ghi chú rõ; dữ liệu bất thường thì rơi về preview mẫu.
- **Mobile (`NovelcrafterTopBar.tsx`, `NovelcrafterStudioApp.tsx`)**: bỏ header "Vikini Chat" trên Studio; TopBar mobile có nút mở danh sách truyện và menu "⋯" chứa AI settings, cột trái, Ngôn ngữ, Theme; padding safe-area đặt trên wrapper chung để cả TopBar và AI Settings tránh tai thỏ. TopBar mobile 2 hàng: tên truyện ở hàng 1, tab Write/Outline/Story bible và model ở hàng 2 (nút cột phải ẩn trên mobile vì đã có nút thẻ AI ở dock dưới).
- **Popover menu AI**: tooltip nguồn prompt tắt khi menu của nút đang mở và focus giữ ở nút khi popover mở, để Esc đóng popover ngay lần đầu.

---

## 2026-11-12: Novelcrafter -- AI Prompt Output Contracts (Output Language, Prose-Only, Parser-Compatible Formats) & Vietnamese Refusal Guard

- **Hợp đồng đầu ra cho mọi prompt AI (`outputContracts.ts` mới, `featureDirectives.ts`)**: mọi `<feature_instruction>` giờ kết thúc bằng quy tắc ngôn ngữ (viết bằng ngôn ngữ của văn bản tác giả, giữ nguyên tên riêng và **không dịch** token cấu trúc: thẻ XML, `=== OPENING n ===`, tên category, tiền tố `## `/`- `). Write/First Draft/Rough Draft yêu cầu "chỉ văn bản truyện" (không tiêu đề, lời dẫn, heading/list; cho phép nhấn mạnh inline và `***`); Expand/Describe chỉ trả đoạn thay thế; Characters dùng `## Tên (Vai trò)` và cấm heading phụ (khớp `parseCharacterCardsFromMarkdown`); Scenes mỗi beat một dòng `- ` (khớp `parseSceneBeats`); Synopsis/Worldbuilding/Outline chỉ nội dung mục — áp dụng cả chế độ tạo mới lẫn viết lại. Feedback: chỉ xuất khối `<feedback_item>`, có đoạn chọn thì chỉ nhận xét trong đoạn đó (1–N mục), Developmental dùng tên tiêu chí làm `<category>`, Copy editing tới 10 mục. Brainstorm: danh sách đánh số, không lặp ý đã có trong Story Bible. Các hợp đồng được nối **sau** directive nên override của Prompt Studio không xóa được.
- **Directive mặc định & persona (`promptDirectiveDefaults.ts`, `promptBuilder.ts`)**: Beta Read bỏ tên thương hiệu "Sudowrite"; Describe viết lại đoạn chọn giàu chi tiết giác quan, giữ sự kiện/lời thoại/ý nghĩa; khối `<style_preferences>` ghi rõ quy tắc định dạng và ngôn ngữ trong `<feature_instruction>` luôn được ưu tiên.
- **Nhận diện lời từ chối tiếng Việt (`streamTargetGuard.ts`)**: `isLikelyModelRefusalOutput` chuẩn hóa NFC và nhận thêm lời từ chối tiếng Việt (bắt buộc đuôi "tôi/mình không thể|không được phép + động từ dịch vụ + tân ngữ như yêu cầu/nội dung/câu chuyện + này/đó"), để lời từ chối không bị ghi vào chương/Beats/Story Bible; câu văn truyện ngôi thứ nhất không bị bắt nhầm. Test mới: `outputContracts.test.ts` + TC-P01→TC-P17 trong 4 file test hiện có; 13 Negative Probe đều làm đỏ đúng ca.

---

## 2026-11-11: Novelcrafter -- Scenes (Chapter Beats) Card No Longer Auto-Opens On Chapters With Prose & Display Fixes

- **Thẻ Scenes (Chapter Beats) chỉ tự mở khi chương trống và dữ liệu đã tải xong (`useBeatsAutoOpen.ts`, `useChapterEditorController.ts`, `useNovelcrafterStory.ts`, `useNovelcrafterCatalog.ts`, `useConversation.ts`, `NovelcrafterStudioApp.tsx`, `ChapterEditorWorkspace.tsx`)**: trước đây mỗi lần tải `/novelcrafter` thẻ tự mở dù chương đã có chữ (bản thảo bị đẩy xuống y≈706px trên màn 900px; nay y=266px). Trạng thái tự động được dẫn xuất trong render từ `isStateSettled` (danh sách truyện đã merge xong qua cờ mới `isLoadingConversations` của `useConversation`, không chờ auto-chọn truyện, state truyện đang chọn đã hydrate). Gõ vào bản thảo/ô Beats hoặc AI bắt đầu stream sẽ khóa trạng thái hiện tại; lựa chọn trên bản nháp chưa lưu chỉ chuyển sang đúng truyện được promote. Hết cảnh báo `react-hooks/exhaustive-deps` của controller. Test mới: `useBeatsAutoOpen.test.ts` (14 ca), `useConversation.test.ts` (TC-15 → TC-17); 9 Negative Probe đều làm đỏ đúng ca.
- **Sửa lỗi hiển thị (`vi.ts`, `en.ts`, `StoryBibleTocSidebar.tsx`, `NovelcrafterAiComposer.tsx`)**: bổ sung 5 key dịch bị thiếu (`novelcrafterWriteMenuBtn`, `novelcrafterScenesLabel`, `novelcrafterUntitledStory`, `novelcrafterPromptStudioCustomizedBadge`, `novelcrafterPromptStudioDefaultBadge`) khiến nút Write trên dock mobile và nhãn Scenes ở Outline hiện key thô; tiêu đề cột mục lục Story Bible không còn bị bóp còn 9px; tab chế độ của Composer không còn bị cắt chữ.

---

## 2026-11-11: Vikini 3.0 Phase 6E -- Audit Bug Fixes, Hook Exhaustiveness & Final Brief Polish

- **Chặn vòng lặp gọi API vô hạn khi danh sách Persona/Gem rỗng hoặc lỗi (`PersonaQuickSwitch.tsx`, `GemQuickSwitch.tsx`)**: bổ sung `requestedRef`, `tRef` và cờ dọn dẹp `cancelled` khi đóng popover/unmount, đảm bảo mỗi lượt mở chỉ phát đúng 1 request `/api/personas` hoặc `/api/gems` và không bắn lặp `toast.error` khi đổi ngôn ngữ hoặc khi danh sách rỗng.
- **Phòng thủ 2 lớp chống sập trang Dự Án `M7` & đồng bộ hiển thị biểu tượng/`aria-label` (`src/app/projects/[id]/page.tsx`, `ProjectSettingsModal.tsx`, `KnowledgePanel.tsx`, `ProjectChatView.tsx`)**: chuẩn hóa `Array.isArray(...) ? ... : []` ở cả nơi nhận API `/api/projects/[id]/knowledge` lẫn bên trong `KnowledgePanel` (`safeDocuments` + bảo vệ `size_bytes`), thay thế class shadcn chết `bg-primary text-primary-foreground` trên nút **Chat mới** bằng `bg-(--accent) text-(--on-accent)`, dùng `<ProjectIcon />` ở tiêu đề `/projects/[id]` thay vì in chuỗi ID biểu tượng thô (`"rocket"`, `"folder"`), và bổ sung `type="button"` + `aria-label` cho các nút biểu tượng trong danh sách hội thoại dự án.
- **Đồng bộ `<html lang>` trước khi vẽ & `<RootSkipLink />` song ngữ `M6` (`src/app/layout.tsx`, `LanguageUpdater.tsx`, `RootSkipLink.tsx`, `ChatApp.tsx`)**: chèn inline bootstrap script đồng bộ `document.documentElement.lang` (`"vi"` / `"en"`) từ `"vikini-language"` hoặc `navigator.language` ngay trong `<head>` dùng chung quy tắc `resolveInitialLanguage`, thay skip-link tiếng Anh cứng bằng `<RootSkipLink />` song ngữ (tự ẩn trên `/`, `/novelcrafter`, `/novelcrafter/prompts` đã có skip-link riêng), và thay `bg-surface text-primary` bằng `bg-(--bg) text-(--text)`.
- **Dọn toàn bộ 38 chỗ `uppercase` ngoài thanh bên & bật chốt chặn `vikini-design/no-uppercase` (`scripts/vikini-design-lint.mjs`, `eslint.config.mjs`, `en.ts`, `vi.ts`, 22 file `.tsx`)**: gỡ `uppercase` trên 22 component giao diện (chỉ giữ duy nhất tại tiêu đề nhóm thanh bên `SidebarSection.tsx`), bổ sung khóa dịch song ngữ `localSamplingChip` cho `LocalSamplingSettings.tsx`, dọn nốt token chết ở `PromptBuilder.tsx` & `ChatLoadingScreen.tsx`, và khóa `"vikini-design/no-uppercase": "error"` trên `src/**/*.tsx`.
- **Xử lý dứt điểm 17 cảnh báo `react-hooks/exhaustive-deps` & nâng lên `"error"` (`eslint.config.mjs`, `vitest.config.ts`, 11 file hook/component)**: loại trừ `.claude/**` khỏi ESLint/Vitest ở workspace gốc; dùng `syncedPersonaKeyRef` (`PersonaEditor.tsx`) và `syncedChapterIdRef` (`useChapterEditorController.ts`) để bảo toàn bản nháp đang gõ khi parent re-render; nhấc `parseSSEEvent` ra phạm vi module kết hợp `resetTypewriterBuffer` & `thinkingStatsSnapshotRef` trong `useChatStreamController.ts`; nâng `"react-hooks/exhaustive-deps"` lên `"error"` với `0` warning toàn repo.
- **Đồng bộ nút Dừng `--accent` & quầng sáng chân trời `--glow` phía sau khung nhập (`InputForm.tsx`, `utilities.css`, `ChatControls.tsx`, `ProjectChatView.tsx`)**: đổi nút **Dừng** khi đang stream từ `--danger` sang `bg-(--accent) text-(--on-accent) ring-2 ring-(--accent)/30`, đồng thời bổ sung lớp nền `.composer-horizon-glow` (`var(--glow)`, tự động trong suốt ở các theme ngoài Hoàng Hôn) phía sau khung nhập Chat và nút tạo hội thoại trong Dự Án.

---

## 2026-11-11: Mandatory Playwright Screenshot Visual QA Rule & Novelcrafter Visual Polish

- **Quy tắc bắt buộc kiểm thử giao diện trực quan bằng ảnh chụp (`.agents/rules/03-ui.md`, `.agents/rules/02-quality.md`, `.agents/scripts/code-freeze-guard.test.ts`)**: bắt buộc mọi thay đổi giao diện (`*.tsx`, `*.css`) phải bật `next dev`, dùng Playwright giả lập phiên/dữ liệu qua `page.route`, chụp ảnh `.png` ở cả Desktop (`1440×900`) & Mobile (`375×812`) trên hai chế độ Tối/Sáng, sau đó gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự rà soát bố cục, khoảng cách, tràn chữ và độ tương phản trước khi nghiệm thu; đồng thời cô đọng `02-quality.md` để tổng ký tự `always_on <= 17.000` trên cả CRLF.
- **Vá 5 lỗi hiển thị phát hiện ngay từ lượt chụp & soi ảnh thực tế đầu tiên (`NovelcrafterOutlineDetailPanel.tsx`, `NovelcrafterMobileAiDock.tsx`, `PromptStudioApp.tsx`, `StoryBibleTocSidebar.tsx`, `NovelcrafterAiComposer.tsx`)**: sửa 3 khóa dịch gọi nhầm tên (`novelcrafterScenesLabel` → `novelcrafterChapterBeatsLabel`, `novelcrafterWriteMenuBtn` → `novelcrafterSlotWrite`, `novelcrafterUntitledStory` → `novelcrafterDefaultStoryTitle`); xếp dọc tiêu đề/phụ đề trong cột mục lục `232px` của Hồ sơ Truyện để không ép chữ thành cột dọc 1 ký tự; tách dòng `<select>` hành động phía trên dải 3 chip chế độ trong khung soạn lệnh AI cột phải để hiển thị rõ nhãn.

---

## 2026-11-11: Vikini 3.0 Phase 6D -- Raw Color & Legacy Token Codemod, 12–32 Typography Scale & ESLint Design/Hooks Guards

- **Codemod dọn màu thô & Gỡ dứt điểm 14 biến CSS alias cũ (`base.css`, `tokens.css`, `utilities.css`, `shimmer.css`, `fileDisplayUtils.ts`, 122 component `.tsx`)**: chuyển đổi toàn bộ `656` class bảng màu Tailwind/hex cứng (`bg-blue-*`, `text-white`, `bg-black/*`, `bg-[#0a0a0a]`, v.v.) và `1.369` chỗ dùng biến Vikini 2.x cũ (`--surface-muted`, `--surface-elevated`, `--control-bg`, `--border`, `--text-primary`, `--accent-foreground`, v.v.) sang hệ 14 token ngữ nghĩa Vikini 3.0; bổ sung `--on-overlay: #ffffff` cho lớp phủ ảnh/lightbox (`--overlay`), giữ hiệu ứng lấp lánh `color-mix` ở `shimmer.css`, và khắc phục lỗi chữ đen trên nền đen (`than-light`) tại `GemPreview`, `PersonaPreview`, `ProjectSettingsModal`.
- **Thang chữ 7 bậc `12–32px` & Xóa chữ dưới `12px` (`base.css`)**: khai báo `--type-12` (`0.75rem`), `--type-13` (`0.8125rem`), `--type-14` (`0.875rem`), `--type-16` (`1rem`), `--type-20` (`1.25rem`), `--type-24` (`1.5rem`), `--type-32` (`2rem`) gắn vào khối `@theme` (`text-xs`, `text-13`, `text-sm`, `text-base`, `text-xl`, `text-2xl`, `text-3xl`); nâng toàn bộ `37` chỗ chữ `8–11px` lên tối thiểu `text-xs` (`12px`).
- **Chốt chặn ESLint thiết kế & `eslint-plugin-react-hooks` (`scripts/vikini-design-lint.mjs`, `eslint.config.mjs`, `BubbleMarkdown.tsx`)**: bật `vikini-design/no-raw-tailwind-colors`, `vikini-design/no-legacy-tokens`, `vikini-design/no-sub-12px-text` ở mức `"error"` cho `src/**/*.{ts,tsx}` (trừ file test) và bật `react-hooks/rules-of-hooks: "error"` + `react-hooks/exhaustive-deps: "warn"` trên toàn repo; sửa lỗi gọi `React.useMemo` sau `return` sớm tại `BubbleMarkdown.tsx`.

---

## 2026-11-11: Vikini 3.0 Phase 5E -- Novelcrafter AI Action Composer, Outline Chapter Detail, Mobile AI Dock & Act Grouping

- **Khung soạn lệnh AI neo đáy cột phải & Lọc thẻ theo chương (`NovelcrafterAiComposer.tsx`, `NovelcrafterHistoryPane.tsx`, `NovelcrafterWriteStage.tsx`)**: bổ sung lọc thẻ `Chương này / Tất cả` và `form` soạn lệnh AI cố định ở chân cột phải (chọn nhóm hành động `Viết tiếp / Sửa văn bản / Miêu tả & Mở rộng / Nhận xét / Gợi ý tình tiết`, `radiogroup` chế độ thực thi, ô nhập hướng đi, chip độ dài `Câu / Đoạn / Cảnh` có `aria-pressed`, dòng tóm tắt nguồn prompt kế thừa từ `resolveFeatureInheritanceRows`, nút chọn nhanh model mở Cài đặt AI, và nút chính tự chuyển sang **Dừng** khi đang stream).
- **Nhóm chương theo Hồi & Panel chi tiết chương ở tab Dàn ý (`types.ts`, `stateLimits.ts`, `chapterOutline.ts`, `useNovelcrafterStateMutators.ts`, `NovelcrafterOutlineBoard.tsx`, `NovelcrafterOutlineDetailPanel.tsx`, `NovelcrafterViewPanel.tsx`, `NovelcrafterLeftNavigator.tsx`)**: thêm trường tùy chọn `actTitle` (`<= 120` ký tự, tự kế thừa hồi của chương liền trước khi thêm chương mới); khi có ít nhất một chương gắn hồi, bảng Dàn ý hiển thị các cột theo hồi (`section` có `aria-label`) và mục lục chương bên trái hiển thị nhãn nhóm hồi; bấm thẻ chương ở Dàn ý mở `<aside>` chi tiết chương bên phải trên desktop (`Sheet` trên màn hình nhỏ) để sửa tên/hồi/tóm tắt, thêm/sửa/xóa từng phân cảnh (`scenes`), xem danh sách ngữ cảnh AI sẽ đọc, chạy `Sửa bằng AI` / `Viết bản thảo chương`, hoặc bấm `Mở trong bàn viết` (nhấp đúp thẻ nhảy thẳng về bàn viết).
- **Thanh bước phân cảnh & Thanh công cụ AI cố định đáy trên mobile (`NovelcrafterMobileAiDock.tsx`, `NovelcrafterStudioApp.tsx`)**: hiển thị thanh điều hướng phân cảnh `i/N` ở đầu khung soạn trên mobile khi chương có phân cảnh và thanh `nav` cố định dưới đáy (`Viết tiếp` / `Dừng`, `Viết lại đoạn chọn`, `Gợi ý tình tiết`, `Thẻ AI` kèm huy hiệu đếm mở ngăn kéo chứa cả lịch sử lẫn khung soạn lệnh AI).

---

## 2026-11-11: Vikini 3.0 Phase 5D -- Unified Story AI Settings (Inheritance Table + Prompt Studio)

- **Bảng kế thừa GEM / Persona / Model theo 6 tính năng (`NovelcrafterInheritanceTable.tsx`, `aiInheritanceTable.ts`, `types.ts`, `stateLimits.ts`, `streamRequestBody.ts`, `useNovelcrafterStream.ts`, `useNovelcrafterStateMutators.ts`)**: hợp nhất 2 thẻ chọn nhanh **GEM tổng** và **Persona tổng** ở đầu trang với bảng 6 tính năng × 4 cột (`Tính năng | Persona | Model | AI sẽ nhận`); hỗ trợ ghi đè Model riêng từng tính năng (tự lùi về model mặc định của truyện nếu model không hợp lệ hoặc không được cấp quyền), tô nổi dòng ghi đè bằng `bg-(--soft)` và viền/chữ `--accent`.
- **Prompt Studio neo phải theo token Vikini 3.0 (`NovelcrafterAiSettingsWorkspace.tsx`, `components/prompt-studio/*`)**: menu gọn `Bộ mẫu` trên header (chọn/lưu/xóa preset tùy chỉnh, khôi phục tất cả), danh sách `role="listbox"` **Hành động AI** điều hướng bằng phím `↑/↓/Home/End`, danh sách kiểm **Ngữ cảnh gửi kèm** dạng checkbox, và khung **Xem trước prompt** kèm ước lượng `≈ X token`.
- **Đồng nhất cả hai lối vào (`NovelcrafterStudioApp.tsx`, `PromptStudioApp.tsx`)**: bấm **"Cài đặt AI"** trên thanh trên của `/novelcrafter` mở ngay trang Cài đặt AI toàn khung trong shell (đóng bằng nút quay lại hoặc `Escape` không mất chữ đang gõ); truy cập trực tiếp `/novelcrafter/prompts` hiển thị cùng giao diện kèm `Sidebar`. Gỡ bỏ hộp thoại cũ `GemPersonaRoutingModal.tsx`.

---

## 2026-11-11: Vikini 3.0 Phase 5C -- Two-Column Story Bible, Character Detail Panel & Granular AI Visibility

- **Bố cục Hồ sơ nhiều cột (`StoryBibleWorkspace.tsx`, `StoryBibleTocSidebar.tsx`, `NovelcrafterViewPanel.tsx`)**: ở tab Hồ sơ toàn trang (`embedded={false}`), hiển thị cột mục lục `232px` bên trái trên `md+` (dải chip ngang trên mobile) kèm số lượng thẻ và biểu tượng `EyeOff` cho mục đang ẩn khỏi AI; vùng biên tập giữa rộng tối đa `760px`.
- **"Ẩn khỏi AI" từng mục & từng trường (`types.ts`, `storyBibleLimits.ts`, `storyBibleDependencies.ts`, `pruneStoryBibleForStream.ts`, `storyBibleSerializer.ts`)**: mở rộng cờ `*VisibleToAI` cho đủ 7 mục (Braindump, Thể loại, Văn phong, Tóm tắt cốt truyện, Nhân vật, Bối cảnh, Dàn ý); chặn rò rỉ `braindump` làm fallback khi Tóm tắt cốt truyện hoặc Braindump bị ẩn; thêm 4 trường chi tiết nhân vật (**Ngoại hình**, **Tính cách & Động lực**, **Quan hệ**, **Bí mật**) với công tắc `role="switch"` riêng từng trường (`secret` mặc định ẩn khỏi AI trừ khi bật tường minh).
- **Lưới nhân vật 2 cột & Panel chi tiết (`StoryBibleCharactersSection.tsx`, `StoryBibleCharacterPanel.tsx`, `characterMentions.ts`)**: lưới thẻ nhân vật 2 cột theo canvas `NovelBible` (`aria-pressed`, chữ cái đầu serif `44×44`, vai trò/tính cách, tổng hợp số chương xuất hiện); bấm thẻ mở `<aside>` chi tiết bên phải trên `lg+` (hoặc `Sheet` trên màn hình nhỏ / chế độ nhúng) để sửa tên, tên gọi khác, ghim luôn gửi AI, 4 trường chi tiết và bấm chip chương (`N×` trong bản thảo hoặc dàn ý) để nhảy thẳng về chương đó ở tab Viết.

---

## 2026-11-11: Vikini 3.0 Phase 5B -- Novelcrafter Views: Write / Outline / Story Bible

- **Tab chế độ xem (`NovelcrafterViewTabs.tsx`, `NovelcrafterTopBar.tsx`, `NovelcrafterStudioApp.tsx`)**: `role="tablist"` "Chế độ xem" cạnh tên truyện gồm **Viết / Dàn ý / Hồ sơ** (roving `tabIndex`, phím ←/→/Home/End); ở Dàn ý/Hồ sơ ẩn panel trái/phải và thanh công cụ AI để nội dung chiếm toàn chiều rộng, bấm nút panel đưa về tab Viết.
- **Bảng dàn ý chương (`NovelcrafterOutlineBoard.tsx`, `chapterOutline.ts`)**: tổng chương & từ + nút "+ Chương"; lưới thẻ chương (`auto-fill minmax(260px,1fr)`) hiển thị số thứ tự, tiêu đề, trạng thái suy ra từ nội dung ("Ý tưởng" / "Có dàn ý" / "Bản nháp"), tóm tắt, số cảnh · số từ; thẻ đang mở có `aria-current="true"` và viền `--accent`; bấm thẻ mở chương và về tab Viết.
- **Hồ sơ toàn trang (`NovelcrafterViewPanel.tsx`, `StoryBibleWorkspace.tsx`)**: dùng lại `StoryBibleWorkspace` (`embedded={false}`) không lồng vùng cuộn; đổi tiêu đề `h1` → `h2`, các mục `h3` để giữ đúng một `h1` trên trang; "Đẩy sang Phân cảnh Chương" nối vào `scenes` chương đang mở rồi về tab Viết.

---

## 2026-11-11: Vikini 3.0 Phase 6C -- Keyboard-Operable Library Cards

- **`GalleryView.tsx`**: thẻ ảnh là `<button>` (tên = prompt), Enter/Space mở chi tiết hoặc chọn ảnh khi So sánh (`aria-pressed`); có viền focus; lớp phủ prompt hiện cả khi focus bằng bàn phím.
- Chưa làm (cần codemod trước): lint chặn màu thô / chữ nhỏ (còn 298 class màu thô, 37 chỗ chữ < 12px), gỡ alias token cũ (1.421 chỗ dùng), type scale, `eslint-plugin-react-hooks`.

---

## 2026-11-11: Vikini 3.0 Phase 6B -- Sign-in & Auth Error on Theme (H7, C4)

- **H7**: huy hiệu "MÃ HÓA ĐẦU-CUỐI" (sai với kiến trúc) → **"Mã hóa dữ liệu khi lưu trữ"**; xóa key `encryptedE2E`.
- **`AuthShell.tsx`** (mới) dùng chung cho `/auth/signin` và `/auth/error`: nền và quầng sáng theo theme người dùng (bỏ đen cứng, vàng gold, gradient đỏ, `styled-jsx`), nút ngôn ngữ có `aria-pressed`.
- **C4**: bỏ chữ 10px in hoa giãn chữ mờ 20–30%; mọi chữ ≥ 12px theo token; "Đăng nhập với Google", "Chỉ dành cho tài khoản được cấp phép" chữ thường.
- Trang lỗi: thông báo trong `role="alert"`, icon Lucide, "whitelist" → "danh sách được cấp phép".
- Chưa đổi (để PM quyết): khẩu hiệu "Ít kiểm duyệt hơn. AI được mã hóa."

---

## 2026-11-11: Vikini 3.0 Phase 6A -- Gems & Personas Card Grid (H3)

- **`components/ui/library-card.tsx`** (mới, dùng chung): tên tối đa 2 dòng (không cắt "Writ…"), mô tả 3 dòng, **một nút chính** + menu "⋯" (Xem trước, Sửa; Xóa tách riêng ở cuối, màu `--danger`).
- **`GemList.tsx`, `PersonaList.tsx`**: lưới `auto-fill minmax(280px,1fr)`; nút "Dùng Gem" / "Dùng Persona" ("Đang dùng" + `aria-pressed`); nhãn "Có sẵn" thay "Premade"; bỏ màu tím, chữ 10px, tiêu đề in hoa.
- **Trang không gắn đoạn chat**: nút chính là "Xem trước" kèm dòng "Mở từ một đoạn chat để dùng cho đoạn chat đó." — trước đây bấm "Chọn" báo "Error: No conversation ID".
- **`GemManager.tsx`, `PersonaManager.tsx`**: bỏ vùng cuộn lồng nhau (`max-h-[60vh]`); "Global Mode" và hộp "GEM vs Persona" tiếng Anh thay bằng mô tả trang đã dịch; "Reset Default" → "Gỡ Gem/Persona" (chỉ hiện khi đang dùng trong một đoạn chat); lỗi tải dùng token + "Thử lại".

---

## 2026-11-11: Vikini 3.0 Phase 5A -- Novelcrafter Top Bar (H1)

- **`NovelcrafterTopBar.tsx`**: thanh trên từ 11 còn 6 control — panel mục lục, tiêu đề (serif nghiêng), trạng thái lưu, Model, **"Cài đặt AI"** (thay 2 huy hiệu GEM/Persona + nút accent; tóm tắt GEM/Persona tổng trong `title` và mô tả cho trình đọc màn hình), menu **"⋯ Thêm"**, panel thẻ AI. Không còn cuộn ngang trên mobile.
- **`NovelcrafterTopBarMenu.tsx`** (mới): Quản lý Prompt, Xuất bản thảo (2 tùy chọn + Markdown / văn bản thuần), Ngôn ngữ, Giao diện — Ngôn ngữ/Giao diện giờ dùng được cả trên mobile.
- Hộp thoại ghép tầng đổi tên "Cài đặt AI của truyện".
- Chưa làm (canvas, cần plan riêng 5B–5E): tab Viết/Dàn ý/Hồ sơ + bảng dàn ý theo hồi, trang Hồ sơ truyện, trang Cài đặt AI dạng bảng kế thừa, khung soạn lệnh AI + dock mobile.

---

## 2026-11-11: Vikini 3.0 Phase 4B -- Studio Form per Canvas

- **Tỷ lệ (`AspectRatioPicker.tsx`)**: thẻ có hình minh họa tỷ lệ, `role="radiogroup"` + phím mũi tên; tỷ lệ mở rộng vẫn nằm sau nút "Mở rộng".
- **`ControlPanel.tsx`**: "Để AI làm giàu prompt" thành hàng switch gọn dưới ô prompt (bấm được trực tiếp, có nhãn); nhãn "Mô tả ảnh bạn muốn", "Tỷ lệ"; nút "Tạo N ảnh"; dòng "Hoặc nhấn Ctrl Enter" nằm dưới nút.
- **`StyleSelector.tsx`**: `aria-pressed`, viền chọn `--accent`, chữ 12px, bỏ trường màu không dùng. **`Canvas.tsx`**: tiêu đề "Kết quả" là `h2`, thêm liên kết "Xem thư viện".
- Giữ nguyên (khác canvas, có chủ đích): chế độ Guided, Quick add, Exclude, độ phân giải, lưới phong cách có ảnh mẫu, mặc định 1 ảnh.

---

## 2026-11-11: Vikini 3.0 Phase 4 -- Images Section Header & Tabs, Studio Tokens, M3, M5

- **Header khu Ảnh (`ImageSectionHeader.tsx`)**: `h1` "Ảnh" + tab liên kết Tạo ảnh / Thư viện / Mô tả ảnh (`aria-current`) dùng chung cho `/images`, `/gallery`, `/describe`; mobile gọn 48px, `h1` chỉ cho trình đọc màn hình. Panel ngữ cảnh đổi nhãn khớp tab.
- **Studio theo token (`ControlPanel.tsx`, `Canvas.tsx`, `DescribeImageView.tsx`)**: bỏ gradient tím/xanh/hồng, nút Tạo/Phân tích dùng `--accent`; nhãn nhóm chữ thường; chữ tối thiểu 12px; overlay trên ảnh giữ nền đen mờ chữ trắng. `ControlPanel` tách thành `ControlPanelPromptSection.tsx` + `ControlPanelReferenceImages.tsx` (772 → 415 dòng).
- **M5**: nút Tạo bị khóa có dòng "Nhập prompt để bắt đầu" (`aria-describedby`); gợi ý Ctrl+Enter ẩn trên thiết bị cảm ứng (`pointer-coarse:hidden`, cả `EditPanel`); tên model trong ô chọn căn trái.
- **M3 (`GalleryView.tsx`)**: thư viện chưa có ảnh chỉ hiện EmptyState + "Tạo ảnh đầu tiên" (ẩn tìm kiếm, bộ lọc, So sánh); bộ lọc cao bằng nhau `h-10`; "Yêu thích" là nút bật/tắt `aria-pressed` màu `--accent`; nhãn chi tiết ảnh chữ thường.

---

## 2026-11-11: Vikini 3.0 Phase 3D -- Accessible Names (C3) & axe E2E Gate

- **C3**: thêm tên truy cập cho nút ⚙ / switch AI Enhance / ô chọn model của Studio, 2 bộ lọc Gallery, nút "Cài đặt GEM & Persona", "Mở rộng/Thu gọn tất cả", "Đẩy sang Phân cảnh Chương" (Novelcrafter, chỉ còn icon trên mobile); logo provider trong avatar AI thành trang trí (`aria-hidden`).
- **Test chặn tái diễn (`tests/e2e/a11y.spec.ts`)**: axe-core 4.11.1 (devDependency mới) quét 7 route × desktop/mobile + sheet composer; fail với nhóm lỗi tên truy cập.
- **Dọn từ 3C**: `GemQuickSwitch` dịch đủ chuỗi, lỗi tải/áp dụng Gem có `logger.error` + toast (bỏ catch câm) và chỉ tải một lần mỗi lần mở popover; nhãn mức suy luận "off" khi tạo lại dùng "Tắt"; nhãn chế độ tạo ảnh chữ thường.

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

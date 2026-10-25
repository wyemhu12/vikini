# Kế Hoạch Triển Khai: Novelcrafter Rich Manuscript Editor, Layout 4 Viewport & Chat/Bilingual UI Audit Fixes

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-25
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1 Mục tiêu

Nâng cấp Novelcrafter và Chat cho đủ 4 viewport (Mobile 390×844, Laptop 1366–1440px, FHD 1920×1080, QHD 2560×1440), dựa trên bản so sánh với Sudowrite và UI Audit. **Không thêm npm dependency nào vào `package.json`.**

Plan chia thành **3 trụ cột (Pillar)**, triển khai qua **4 Phase**:

| Pillar                             | Phạm vi                                                                                                                                                                         | Kết quả nghiệm thu chính                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1 — Rich Manuscript Editor**    | Thay `<textarea>` của chapter editor bằng một editor tự viết, không dùng thư viện: `contentEditable="plaintext-only"` có kiểm soát, cộng một lớp decoration ngay trong dòng chữ | Định dạng trực tiếp (H1, H2, **bold**, _italic_, ~~strike~~, scene break `***`). Tùy chỉnh typography: font family, size, line-height, paragraph indent. Gạch chân amber cho đoạn được Feedback trích dẫn (`data-feedback-id`, click để chọn thẻ Feedback). Highlight nhân vật/thế giới trong Codex (hover/click để xem trước). Vùng chọn vẫn được tô sáng khi editor mất focus. Floating bubble gồm Rewrite, Describe, Expand, Feedback, Quick Edit (Ctrl+K). Cuộn trực tiếp tới DOM node `[data-feedback-id]`, thay cho `measureCaretOffsetTop` |
| **P2 — Layout Novelcrafter**       | `/novelcrafter` trên 2560/1920/1440/1366/390                                                                                                                                    | Sidebar 320px tự thu gọn. Ẩn global HeaderBar trên desktop. `ChapterAiToolbar` rộng full-width phía trên các cột, không bao giờ xuống dòng. Beats drawer thu gọn khi đã có văn bản. Empty state gọn hơn để văn bản bắt đầu ở y≈208px. Manuscript sheet căn giữa (hết khoảng trống lệch 190px bên phải). Trên viewport <1536px chỉ được mở 1 side pane tại một thời điểm. Sửa TopBar mobile và chỗ nút đóng Sheet bị đè                                                                                                                            |
| **P3 — Chat + UI/Bilingual Audit** | Chat 2560/390, các primitive dùng chung, i18n                                                                                                                                   | Message list rộng theo breakpoint, bỏ `lg:max-w-[90%]`. ChatControls nằm 1 dòng trên desktop, cuộn ngang trên mobile, không còn divider treo. Textarea mobile chiếm 100% chiều rộng. Sửa class `undefined` và vị trí của FloatingMenuTrigger. Sửa token của TokenBadge và PersonaQuickSwitch. Thêm 7 key dịch còn thiếu. Sửa a11y của StoryBible. Thay chuỗi "Sudowrite" hiển thị cho người dùng bằng "Novelcrafter"                                                                                                                              |

#### 1.2 Out of Scope (What We're NOT Doing)

- **KHÔNG** thêm npm package (TipTap, Lexical, ProseMirror, Slate, CodeMirror, `react-contenteditable`, font packages…). Editor tự viết bằng DOM API chuẩn.
- **KHÔNG** đổi định dạng lưu trữ: `chapter.content` vẫn là chuỗi Markdown thuần (`types.ts:220`). Không migration DB, không đổi Zod schema, không đổi API route và không đổi SSE contract.
- **KHÔNG** ẩn ký hiệu Markdown kiểu "live preview" như Obsidian, vì khi ẩn thì mapping caret phải xử lý thêm nhiều trường hợp. Ký hiệu vẫn hiển thị nhưng mờ đi, giống iA Writer (xem D1 trong §3.3).
- **KHÔNG** sửa prompt LLM có chữ "Sudowrite" (`featureDirectives.ts:174`, `promptBuilder.ts`), vì sửa có thể làm đổi chất lượng output của AI. Chỉ sửa chuỗi hiển thị cho người dùng và comment trong các file UI mà plan này vốn đã chạm tới.
- **KHÔNG** đồng bộ cài đặt typography lên server. Cài đặt chỉ lưu `localStorage` theo thiết bị (D5).
- **KHÔNG** hỗ trợ bảng, ảnh hay link trong manuscript. Bullet/numbered list vẫn chèn được qua toolbar, nhưng chỉ được làm mờ ký hiệu, không render thành list thật.
- **KHÔNG** refactor virtualization của Chat, hay logic stream/persistence của Novelcrafter (`useNovelcrafterStream`, `useDirectStreamBridge`, `storySyncCoordinator`).
- **KHÔNG** sửa các Sheet/Dialog primitive trong `src/components/ui/` ngoài cách dùng (chỉ dùng `SheetDescription` có sẵn tại `sheet.tsx:98`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1 Tài liệu đã đọc

| File                                           | Mục đích                                 | Phát hiện chính                                                                                                                                                                                                                                           |
| :--------------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                     | Tech stack, boundary, git                | Cấm `any`/`console.log`. Bắt buộc test co-located cho `src/lib/features/`. Hard max: 500 dòng cho UI, 350 cho hook, 400 cho `lib/`                                                                                                                        |
| `.agents/rules/01-coding.md`                   | Coding standards                         | Hàm < 50 dòng. Infrastructure hook không được import i18n (`01-coding.md:142-143`). Test UI chỉ bắt buộc khi có logic đáng kể (`:72`)                                                                                                                     |
| `.agents/rules/02-quality.md`                  | Pre-Work triggers, Test Triage           | Bắt buộc đọc UI rules, bilingual, add-translation, investigate. Test Triage Loại C áp dụng cho `studioLayout.test.ts` và `quoteScrollPositioning.test.ts`                                                                                                 |
| `.agents/rules/03-ui.md`                       | Token, a11y, anti-pattern                | Cấm `style={{}}`, raw color (`purple-500`), class shadcn đã chết, text <12px. Toggle cần `aria-pressed`. Button icon-only cần `aria-label`. Không lặp control giữa mobile và desktop                                                                      |
| `.agents/rules/04-bilingual.md`                | i18n                                     | Chỉ dùng `useLanguage()` + `t("key")`. Không truyền `t` qua prop (đã có nợ cũ ở `VoiceButton`/`FileManagerPanel`, ngoài scope)                                                                                                                            |
| `.agents/rules/05-plan-review.md`              | Cấu trúc plan                            | Header, 2 phân khu, nhãn `[NEW]/[MODIFY]/[DELETE]` cho Plan Scope Guard                                                                                                                                                                                   |
| `.agents/agents/reviewer/evidence-bar.md`      | §4.5.3 Negative Probe, §4.5.4 Risk Table | Mọi rủi ro Cao/Trung bình phải ánh xạ tới control kèm `file:line` hoặc Negative Probe                                                                                                                                                                     |
| `.agents/agents/reviewer/mental-simulation.md` | S1–S6                                    | S3/S5/S6 phần lớn N/A, vì plan không chạm DB, API hay provider (xem §3.4)                                                                                                                                                                                 |
| `src/lib/utils/translations/index.ts:22-34`    | Parity check                             | `vi`/`en` được kiểm tra parity 2 chiều ở compile-time. Tuy nhiên `t()` nhận `string` (`useLanguage.ts:20`), nên key **không tồn tại** sẽ không làm type-check fail mà rơi về chuỗi fallback hoặc tên key (`useLanguage.ts:23-27`) → cần test runtime (§9) |

#### 2.2 Skills Loaded & Applied

| SKILL.md                                                                           | Lý do nạp                                                                                                              | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                     |
| :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`                                          | Thêm khoảng 40 key UI mới và 7 key audit                                                                               | Mỗi key được thêm **đồng thời** vào `vi.ts` và `en.ts`. Chạy `npm run type-check` để kiểm tra parity. Thêm test runtime `requiredKeys.test.ts` vì `t(string)` không bắt được key thiếu |
| `.agents/skills/vikini-investigate/SKILL.md` (Mode 4 `/blast-radius`)              | Sửa export trong `src/lib/features/novelcrafter/` (`quoteScrollPositioning.ts`, `studioLayout.ts`, `codexMatcher.ts`)  | Bảng blast radius ở §3.2. Mọi caller được đánh `No` đều có bước migration riêng (§7)                                                                                                   |
| `.agents/skills/vikini-audit/SKILL.md` (trigger "UI token / bilingual compliance") | P3 là remediation từ UI audit                                                                                          | Dùng checklist token, bilingual và a11y làm tiêu chí trong Test Contract §8                                                                                                            |
| `.agents/skills/add-feature/SKILL.md`                                              | P1 là tính năng mới (editor)                                                                                           | Đặt file theo boundary: logic thuần ở `src/lib/features/novelcrafter/`, UI và hook DOM ở `src/app/features/novelcrafter/`                                                              |
| `.agents/skills/streaming-patterns/SKILL.md`                                       | **Không nạp**. Plan không đổi SSE hay stream handler; editor chỉ nhận `chapter.content` đã được stream bridge cập nhật | —                                                                                                                                                                                      |
| `.agents/skills/api-patterns`, `database-migration`                                | **Không nạp**. Không có API route hay migration                                                                        | —                                                                                                                                                                                      |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1 Giả định kỹ thuật (kèm bằng chứng)

| #   | Giả định                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Bằng chứng                                                                                                                                                                                                                                                                                                                                    |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Chapter editor hiện là `<textarea>` controlled, nằm trong một file 654 dòng (vượt hard max 500 cho UI)                                                                                                                                                                                                                                                                                                                                                                                    | `[SRC] ChapterEditorWorkspace.tsx:587-609` (textarea), tổng file 654 dòng                                                                                                                                                                                                                                                                     |
| A2  | Mọi thao tác AI (replace selection, accept suggestion, append) đều dùng **offset trên chuỗi thô** `chapter.content`                                                                                                                                                                                                                                                                                                                                                                       | `[SRC] NovelcrafterStudioApp.tsx:132-142` (`current.slice(0, selection.start) + text + …`), `ChapterEditorWorkspace.tsx:157-163` (`EditorSelectionRange {start,end,text}`), `feedbackParser.ts:101-137` (`findQuoteRangeInText` trả `{start,end}`) → editor mới **bắt buộc** giữ bất biến "offset trong DOM ≡ offset trong `chapter.content`" |
| A3  | Feedback scroll hiện đo caret bằng một DOM mirror ẩn có 24 thuộc tính                                                                                                                                                                                                                                                                                                                                                                                                                     | `[SRC] quoteScrollPositioning.ts:4-29, 61-114`; caller duy nhất `ChapterEditorWorkspace.tsx:210-220`                                                                                                                                                                                                                                          |
| A4  | Codex matcher hiện chỉ trả Set ID, chưa có vị trí (range) trong văn bản                                                                                                                                                                                                                                                                                                                                                                                                                   | `[SRC] codexMatcher.ts:71-94`. `doesCodexTermMatchContext` dùng Unicode boundary (`:43`) và fallback `includes` cho CJK (`:38-40`)                                                                                                                                                                                                            |
| A5  | Giới hạn dữ liệu: chương tối đa 150.000 ký tự; tối đa 15 character card và 15 world element; mỗi card tối đa `MAX_CODEX_ALIASES` alias                                                                                                                                                                                                                                                                                                                                                    | `[SRC] types.ts:130-133, 148, 159` → tokenize O(n) cho 150k ký tự là chấp nhận được, còn codex scan cần debounce (R3)                                                                                                                                                                                                                         |
| A6  | Layout hiện tại: sidebar mặc định **mở** (`sidebarCollapsed=false`). Left và right pane mặc định **cùng mở**. `allowDualDockedSidebars=true` từ 1180px                                                                                                                                                                                                                                                                                                                                    | `[SRC] NovelcrafterStudioApp.tsx:60-62`, `studioLayout.ts:51-62`. Sidebar rộng 18rem/20rem (`Sidebar.tsx:549-551`, `NovelcrafterStudioApp.tsx:252-254`)                                                                                                                                                                                       |
| A7  | `ChapterAiToolbar` render **bên trong** cột editor (giữa navigator và history), nên bị ép hẹp và wrap                                                                                                                                                                                                                                                                                                                                                                                     | `[SRC] ChapterEditorWorkspace.tsx:325-382` (toolbar nằm trong workspace), `NovelcrafterStudioApp.tsx:311-362` (flex-row 3 cột), `ChapterAiToolbar.tsx:196-197` (`flex-wrap`)                                                                                                                                                                  |
| A8  | Beats card mặc định mở, empty state 3 thẻ cao, sheet căn trái với `max-w-7xl`                                                                                                                                                                                                                                                                                                                                                                                                             | `[SRC] ChapterEditorWorkspace.tsx:109` (`useState(true)`), `ChapterEmptyStateActions.tsx:48-72`, `ChapterEditorWorkspace.tsx:416-424, 606` (không có `mx-auto`)                                                                                                                                                                               |
| A9  | Global HeaderBar `md:sticky`, render ở mọi viewport của Novelcrafter                                                                                                                                                                                                                                                                                                                                                                                                                      | `[SRC] HeaderBar.tsx:73-81`, `NovelcrafterStudioApp.tsx:257`                                                                                                                                                                                                                                                                                  |
| A10 | Nút đóng của Sheet nằm `absolute top-3 right-3`, đè lên nút ở header của pane. Các Sheet chưa có `SheetDescription`                                                                                                                                                                                                                                                                                                                                                                       | `[SRC] sheet.tsx:63-69, 98-108`, `NovelcrafterStudioApp.tsx:314-321, 352-361`, `ChapterEditorWorkspace.tsx:630-639`                                                                                                                                                                                                                           |
| A11 | Ô tiêu đề truyện trên TopBar mobile bị ép còn khoảng 18px do `flex-wrap` cạnh tranh với cụm control bên phải. Font 14px (`text-sm`) còn gây iOS auto-zoom                                                                                                                                                                                                                                                                                                                                 | `[SRC] NovelcrafterTopBar.tsx:121, 139-153, 159`                                                                                                                                                                                                                                                                                              |
| A12 | Vấn đề ở Chat: width cố định `max-w-3xl`, bubble `lg:max-w-[90%]`, divider render vô điều kiện trước mỗi nhóm control, textarea dùng chung hàng với 3 nút trên mobile                                                                                                                                                                                                                                                                                                                     | `[SRC] ChatMessagesArea.tsx:198, 316`, `ChatBubble.tsx:214`, `ChatDeepResearch.tsx:45, 61`, `ChatConversationView.tsx:51`, `ChatControls.tsx:149, 159-163, 172, 199, 216, 227, 238, 290, 304`, `InputForm.tsx:250-319`                                                                                                                        |
| A13 | `FloatingMenuTrigger` nối `${className}` khi prop không được truyền → sinh class `"undefined"`. Vị trí `bottom-[6rem] left-4` đè lên ChatControls fixed ở đáy. `aria-label` đang hardcode                                                                                                                                                                                                                                                                                                 | `[SRC] FloatingMenuTrigger.tsx:35, 59-68`; ChatControls fixed bottom tại `ChatControls.tsx:153`                                                                                                                                                                                                                                               |
| A14 | TokenBadge dùng class không tồn tại (`text-secondary/60`, `bg-surface-elevated`, `border-token`) và lặp `transition-*`                                                                                                                                                                                                                                                                                                                                                                    | `[SRC] TokenBadge.tsx:67, 82, 94`                                                                                                                                                                                                                                                                                                             |
| A15 | PersonaQuickSwitch: màu raw `purple-500`, chuỗi hardcode, `.catch(() => {})` câm lỗi, `catch (_e)`, span icon rỗng                                                                                                                                                                                                                                                                                                                                                                        | `[SRC] PersonaQuickSwitch.tsx:36, 55-56, 64, 89, 97`                                                                                                                                                                                                                                                                                          |
| A16 | 7 key đang được gọi nhưng **chưa tồn tại** (`manageGems`, `startListening`, `stopListening`, `readAloud`) hoặc **chưa có** (`skipToMainContent`, `openMenu`, `yourStories`)                                                                                                                                                                                                                                                                                                               | `[SRC] GemQuickSwitch.tsx:122`, `VoiceButton.tsx:147-148`, `MessageActions.tsx:183-184`. Grep `skipToMainContent\|openMenu\|yourStories` trong `src/` = 0 kết quả. Sidebar hardcode `t("yourChats")` (`Sidebar.tsx:460`) cả trong Novelcrafter                                                                                                |
| A17 | Các lỗi a11y ở StoryBible: `<label>` không có `htmlFor` (`StoryBibleWorkspace.tsx:252-273`); POV/Tense trùng `aria-label` ở 2 section (`:395-412` so với `:252-273`); heading đảo cấp h3→h2 (`InlineStoryBibleSection.tsx:66` h3 bọc `StoryBibleSectionCard.tsx:86` h2); Feedback gutter có prev/next trùng label (`ChapterFeedbackGutter.tsx:139, 148`), nút "More" trùng label của `<aside>` (`:100, :157`), thumbs up/down mượn label Accept/Dismiss (`:334, :350` trùng `:240, :250`) | `[SRC]` như cột trái                                                                                                                                                                                                                                                                                                                          |
| A18 | Chuỗi "Sudowrite" hiển thị cho người dùng chỉ có ở `en.ts` (3 chỗ). Comment "Sudowrite" nằm ở các file UI                                                                                                                                                                                                                                                                                                                                                                                 | `[SRC] en.ts:1007, 1022, 1056`. `NovelcrafterTopBar.tsx:158`, `NovelcrafterLeftNavigator.tsx:99, 217`, `ChapterFeedbackGutter.tsx:103, 264`, `quoteScrollPositioning.ts:2`                                                                                                                                                                    |
| A19 | Môi trường test là `happy-dom` 20.3.4. Có hỗ trợ `document.createTreeWalker`, `Range`, `Selection` đủ cho unit test offset (không đo layout thật)                                                                                                                                                                                                                                                                                                                                         | `[SRC] vitest.config.ts:8`, `node_modules/happy-dom/package.json:3`                                                                                                                                                                                                                                                                           |
| A20 | `contenteditable="plaintext-only"` được hỗ trợ ở Chromium/WebKit từ lâu và Firefox ≥136 (03/2025). `beforeinput` + `inputType` (`insertParagraph`, `insertFromPaste`, `historyUndo`) là chuẩn W3C                                                                                                                                                                                                                                                                                         | `[URL]` §4                                                                                                                                                                                                                                                                                                                                    |

#### 3.2 Blast Radius (`vikini-investigate` Mode 4)

| Symbol                                                                                                                                        | Caller                                       | `file:line`                                                                      | Tầng   | Cách tham chiếu                              | Compatible?                                                                         |
| :-------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------- | :----- | :------------------------------------------- | :---------------------------------------------------------------------------------- |
| `measureCaretOffsetTop` (DELETE)                                                                                                              | `ChapterEditorWorkspace`                     | `ChapterEditorWorkspace.tsx:18, 210`                                             | 1      | static import                                | **No** → chuyển sang `scrollFeedbackMarkIntoView` (§7 B5)                           |
| `measureCaretOffsetTop`, `MIRROR_STYLE_PROPERTIES`                                                                                            | test                                         | `quoteScrollPositioning.test.ts:5-6, 11, 41, 50`                                 | 1      | static import                                | **No** → test Loại C, viết lại theo Test Contract TC-SCROLL                         |
| `computeQuoteScrollTop` (đổi input shape)                                                                                                     | `ChapterEditorWorkspace`, test               | `ChapterEditorWorkspace.tsx:17, 213`, `quoteScrollPositioning.test.ts:4, 13, 25` | 1      | static import                                | **No** → migrate cả 2                                                               |
| `resolveStudioLayout` / `StudioLayoutConfig` (thêm `maxDockedSidePanes`, đổi `allowDualDockedSidebars` tại 1180–1535 và `feedbackGutterMode`) | `useStudioLayout`                            | `useStudioLayout.ts:6, 62, 67-69`                                                | 1      | static import                                | Yes (thêm field). Hành vi thay đổi được hook tiêu thụ                               |
| ″                                                                                                                                             | test                                         | `studioLayout.test.ts:25-37`                                                     | 1      | static import                                | **No** → Loại C (1280px: `allowDual` true→false, `feedbackGutterMode` sheet→docked) |
| `useStudioLayout` → `NovelcrafterStudioApp`                                                                                                   | `NovelcrafterStudioApp.tsx:41, 172-173, 346` | 2                                                                                | static | Yes (thêm field `config.maxDockedSidePanes`) |
| `matchCodexEntitiesInContext` (giữ nguyên) + `findCodexMentionRanges` (NEW)                                                                   | test                                         | `codexMatcher.test.ts:7, 121`                                                    | 1      | static                                       | Yes (chỉ thêm export)                                                               |
| `useAutoResizeTextarea` (DELETE)                                                                                                              | `ChapterEditorWorkspace`                     | `ChapterEditorWorkspace.tsx:37, 118`                                             | 1      | static                                       | **No** → bỏ cùng textarea                                                           |
| `ChapterSelectionToolbar` (props đổi thành bubble)                                                                                            | `ChapterEditorWorkspace`                     | `ChapterEditorWorkspace.tsx:33, 523`                                             | 1      | static                                       | **No** → chuyển sang `ChapterManuscriptEditor`                                      |
| `HeaderBar` (thêm prop tùy chọn `hideOnDesktop`)                                                                                              | `ChatApp`, `NovelcrafterStudioApp`, test     | `ChatApp.tsx:290`, `NovelcrafterStudioApp.tsx:257`, `HeaderBar.test.tsx`         | 1      | static                                       | Yes (prop optional, mặc định `false`)                                               |
| `Sidebar` (thêm prop tùy chọn `conversationsLabel`)                                                                                           | `ChatApp`, `NovelcrafterStudioApp`, test     | `Sidebar.tsx:460`, `Sidebar.test.tsx`                                            | 1      | static                                       | Yes                                                                                 |
| `FloatingMenuTrigger`                                                                                                                         | `ChatApp`, `NovelcrafterStudioApp`           | `ChatApp.tsx:285`, `NovelcrafterStudioApp.tsx:248`                               | 1      | static                                       | Yes (props không đổi)                                                               |
| `vi.mock` liên quan                                                                                                                           | —                                            | grep `vi\.mock\(.*(quoteScrollPositioning\|studioLayout\|codexMatcher)` = 0      | —      | mock                                         | N/A                                                                                 |

**Co-Located Tests Affected**: `quoteScrollPositioning.test.ts`, `studioLayout.test.ts`, `codexMatcher.test.ts`, `HeaderBar.test.tsx`, `Sidebar.test.tsx`, `ChatBubble.test.tsx` (chỉ assert token màu ở `:77-83`, không assert max-w → Compatible), `InputForm.test.tsx`, `ChatMessagesArea.test.tsx`.

#### 3.3 `[NEEDS_PRODUCT_DECISION]` (kèm Default Assumption)

| ID  | Câu hỏi                                                                          | Default Assumption (sẽ triển khai nếu PM không phản hồi)                                                                                              |
| :-- | :------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Ký hiệu Markdown (`**`, `#`, `~~`) trong editor: ẩn hẳn hay hiện mờ?             | **Hiện mờ** (`opacity-40`, nhỏ hơn 0.85em), giống iA Writer. Giữ mapping offset 1:1, rủi ro thấp nhất                                                 |
| D2  | Ẩn global HeaderBar ở `/novelcrafter` thì đổi ngôn ngữ/theme ở đâu trên desktop? | Ẩn HeaderBar ở `md+` trong Novelcrafter. Mobile vẫn giữ (menu Settings). Desktop đổi ngôn ngữ/theme qua trang Chat, vì cài đặt lưu global trong store |
| D3  | Vị trí mặc định của FloatingMenuTrigger (mobile)                                 | Mép phải, giữa màn hình: `top-[45dvh] right-[calc(0.5rem+var(--sar,0px))]`. Không đè input dưới đáy hay TopBar phía trên. Vẫn kéo thả được            |
| D4  | Có highlight Codex cho entity `visibleToAI=false` không?                         | **Có**. Highlight là công cụ hỗ trợ người viết; preview hiển thị badge "Ẩn với AI" khi `visibleToAI === false`                                        |
| D5  | Cài đặt typography lưu theo story hay theo thiết bị?                             | Theo thiết bị (`localStorage` key `vikini:nc-manuscript-typography:v1`), không đổi schema                                                             |
| D6  | Sidebar tự thu gọn có ghi nhớ không?                                             | Mỗi lần mở `/novelcrafter` đều mặc định `collapsed=true`. Người dùng vẫn mở lại được. Không persist                                                   |

#### 3.4 Cross-Task Dependencies & S1–S6 Applicability

- Phụ thuộc vào trạng thái code sau commit `647d69d` (fix streaming Novelcrafter/Chat). Không có plan nào khác đang ở trạng thái Approved chạm các file này.
- **S1**: `npm run type-check` làm baseline. Không thêm dependency, không đổi toolchain.
- **S2**: Cleanup cho editor gồm `cancelAnimationFrame`, `clearTimeout` debounce codex, remove listener `selectionchange` (§6, §10).
- **S3**: N/A (không đụng DB).
- **S4**: State flow `selection` (StudioApp) ↔ editor ↔ `handleReplaceSelection` được giữ nguyên (A2). Stream direct-to-chapter cập nhật `chapter.content` qua props, editor reconcile mà không phá caret (§6.3).
- **S5**: N/A cho auth. Bề mặt XSS của editor được xử lý: render bằng `createElement` + `textContent`, **không** dùng `innerHTML` (R1).
- **S6**: N/A (không gọi provider mới).

---

### 4. Bảng Verified Versions

| Thư viện / API                                                                  | `package.json` `[SRC]`        | Installed `[SRC]`                           | Tra cứu 2026 `[URL]`                                                                                           | Ghi chú dùng trong plan                                                                                                     |
| :------------------------------------------------------------------------------ | :---------------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `next`                                                                          | `^16.4.0` (`package.json:64`) | 16.4.0 (`node_modules/next/package.json:3`) | https://nextjs.org/blog (16.x LTS; 16.2 phát hành 03/2026)                                                     | Không dùng API mới. Chỉ client component (`"use client"`)                                                                   |
| `react` / `react-dom`                                                           | `^19.2.3` (`:69-70`)          | 19.2.3                                      | https://react.dev/blog                                                                                         | `useId`, `useSyncExternalStore` không cần thiết; dùng `useRef`/`useLayoutEffect`                                            |
| `tailwindcss`                                                                   | `^4.1.18` (`:113`)            | 4.1.18                                      | https://tailwindcss.com/docs                                                                                   | Arbitrary `bg-(--token)`, `min-[2200px]:` variant, `max-md:` variant                                                        |
| `framer-motion`                                                                 | `^12.23.26` (`:59`)           | —                                           | https://motion.dev/docs                                                                                        | Bubble fade/scale ≤150ms dùng `DURATION`/`EASE` từ `lib/utils/motion.ts`                                                    |
| `@radix-ui/react-popover`                                                       | `^1.1.15` (`:46`)             | —                                           | https://www.radix-ui.com/primitives/docs/components/popover                                                    | Codex preview và Typography menu dùng `@/components/ui/popover` sẵn có                                                      |
| `@radix-ui/react-dialog` (Sheet)                                                | `^1.1.15` (`:43`)             | —                                           | https://www.radix-ui.com/primitives/docs/components/dialog                                                     | `SheetDescription` (`sheet.tsx:98`)                                                                                         |
| `lucide-react`                                                                  | `^0.562.0` (`:62`)            | —                                           | https://lucide.dev/icons                                                                                       | `UserX` (Persona remove), `Type`, `Pilcrow`, `BookUser`, `Globe2`                                                           |
| `happy-dom` (test env)                                                          | `^20.0.11` (`:106`)           | 20.3.4                                      | https://github.com/capricorn86/happy-dom                                                                       | TreeWalker, Range, Selection cho `manuscriptDomOffsets.test.ts`                                                             |
| `vitest`                                                                        | `^4.1.12` (`:117`)            | —                                           | https://vitest.dev                                                                                             | `--reporter=dot`                                                                                                            |
| **Web API** `contenteditable="plaintext-only"`                                  | —                             | —                                           | https://caniuse.com/mdn-html_global_attributes_contenteditable_plaintext-only (Firefox 136+, Chromium, Safari) | Chặn rich paste và Ctrl+B native                                                                                            |
| **Web API** `beforeinput` / `InputEvent.inputType`                              | —                             | —                                           | https://www.w3.org/TR/input-events-2/                                                                          | Chặn `insertParagraph`, `insertLineBreak`, `insertFromPaste`, `insertFromDrop`, `historyUndo`, `historyRedo`, `formatBold`… |
| **Web API** `Selection`/`Range.getBoundingClientRect`, `Element.scrollIntoView` | —                             | —                                           | https://developer.mozilla.org/en-US/docs/Web/API/Range/getBoundingClientRect                                   | Vị trí bubble, cuộn tới mark                                                                                                |

**Không thêm dependency** → `package.json` và `package-lock.json` **không** nằm trong danh sách file.

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### 5.1 `src/lib/features/novelcrafter/` (logic thuần, bắt buộc co-located test)

- [NEW] `src/lib/features/novelcrafter/manuscriptMarkup.ts`: tokenizer Markdown, chia theo dòng thành block và inline segment. Bất biến: nối toàn bộ text của segment phải bằng đúng `content`.
- [NEW] `src/lib/features/novelcrafter/manuscriptMarkup.test.ts`
- [NEW] `src/lib/features/novelcrafter/manuscriptDecorations.ts`: dựng decoration (feedback, codex, selection) và chia nhỏ thành atomic segment để render. Kiểm tra định dạng ID, tính chữ ký (signature) cho từng dòng.
- [NEW] `src/lib/features/novelcrafter/manuscriptDecorations.test.ts`
- [NEW] `src/lib/features/novelcrafter/manuscriptHistory.ts`: undo/redo stack thuần, có gộp thao tác gõ liên tiếp (coalescing) và giới hạn dung lượng.
- [NEW] `src/lib/features/novelcrafter/manuscriptHistory.test.ts`
- [NEW] `src/lib/features/novelcrafter/manuscriptTypography.ts`: kiểu dữ liệu, giá trị mặc định, `sanitizeManuscriptTypography(unknown)`, storage key.
- [NEW] `src/lib/features/novelcrafter/manuscriptTypography.test.ts`
- [NEW] `src/lib/features/novelcrafter/selectionBubblePlacement.ts`: hàm toán thuần tính vị trí bubble (lật trên/dưới, clamp ngang).
- [NEW] `src/lib/features/novelcrafter/selectionBubblePlacement.test.ts`
- [MODIFY] `src/lib/features/novelcrafter/quoteScrollPositioning.ts`: xóa mirror. `computeQuoteScrollTop` nhận `targetRectTop`.
- [MODIFY] `src/lib/features/novelcrafter/quoteScrollPositioning.test.ts`
- [MODIFY] `src/lib/features/novelcrafter/codexMatcher.ts`: thêm `findCodexMentionRanges`.
- [MODIFY] `src/lib/features/novelcrafter/codexMatcher.test.ts`
- [MODIFY] `src/lib/features/novelcrafter/studioLayout.ts`: thêm `maxDockedSidePanes`, `DockedPaneId`, `applyDockedPaneToggle`, `resolveInitialDockedPanes`.
- [MODIFY] `src/lib/features/novelcrafter/studioLayout.test.ts`

#### 5.2 `src/app/features/novelcrafter/` (UI và hook DOM)

- [NEW] `src/app/features/novelcrafter/utils/manuscriptDomOffsets.ts`: chuyển đổi giữa offset trong chuỗi và vị trí DOM, đọc/ghi selection, serialize, dựng element cho từng dòng bằng `createElement`.
- [NEW] `src/app/features/novelcrafter/utils/manuscriptDomOffsets.test.ts`
- [NEW] `src/app/features/novelcrafter/hooks/useManuscriptEditor.ts`: reconcile DOM, xử lý input/beforeinput/composition, history, lưu selection, phím tắt.
- [NEW] `src/app/features/novelcrafter/hooks/useManuscriptTypography.ts`: persist `localStorage` cho typography.
- [NEW] `src/app/features/novelcrafter/hooks/useChapterEditorController.ts`: state và handler AI được nâng lên (lifted) từ Workspace, dùng chung cho Toolbar full-width và Workspace.
- [NEW] `src/app/features/novelcrafter/hooks/useDockedPanes.ts`: state máy loại trừ lẫn nhau giữa navigator, history và feedback.
- [NEW] `src/app/features/novelcrafter/components/ChapterManuscriptEditor.tsx`: editor `contentEditable` + bubble + codex preview.
- [NEW] `src/app/features/novelcrafter/components/CodexEntityPreview.tsx`: nội dung popover xem trước một entity trong Codex.
- [NEW] `src/app/features/novelcrafter/components/ManuscriptTypographyMenu.tsx`: popover chọn font family, size, line-height, indent.
- [NEW] `src/app/features/novelcrafter/utils/manuscriptSheetClasses.ts`: hằng class dùng chung cho sheet căn giữa.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`: bỏ textarea và toolbar, dùng controller và editor mới (mục tiêu ≤ 320 dòng).
- [MODIFY] `src/app/features/novelcrafter/components/ChapterSelectionToolbar.tsx`: chuyển thành floating bubble.
- [MODIFY] `src/app/features/novelcrafter/components/SheetSubToolbar.tsx`: format gọi editor command; nút font-size được thay bằng `ManuscriptTypographyMenu`.
- [MODIFY] `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`
- [MODIFY] `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`
- [MODIFY] `src/app/features/novelcrafter/components/ChapterAiToolbar.tsx`: một dòng full-width, `flex-nowrap` + overflow menu.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`: dạng compact.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterFeedbackGutter.tsx`: `data-feedback-card-id`, auto `scrollIntoView` thẻ đang active, aria-label, `isInSheet`, comment.
- [MODIFY] `src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx`: `isInSheet` → `pr-10`, comment.
- [MODIFY] `src/app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx`: `isInSheet` → `pr-10`.
- [MODIFY] `src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx`: h3→h2.
- [MODIFY] `src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx`: prop `headingLevel`.
- [MODIFY] `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`: `htmlFor`/`useId`, aria-label riêng cho Outline, `headingLevel`.
- [DELETE] `src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts`

#### 5.3 Layout / Chat / Shared

- [MODIFY] `src/app/features/layout/components/HeaderBar.tsx`: prop `hideOnDesktop`.
- [MODIFY] `src/app/features/layout/HeaderBar.test.tsx`: thêm case `hideOnDesktop`.
- [MODIFY] `src/app/features/layout/components/FloatingMenuTrigger.tsx`
- [MODIFY] `src/app/features/sidebar/components/Sidebar.tsx`: prop `conversationsLabel`.
- [MODIFY] `src/app/features/chat/components/ChatApp.tsx`: skip link + `id="main-content"`.
- [MODIFY] `src/app/features/chat/components/ChatMessagesArea.tsx`
- [MODIFY] `src/app/features/chat/components/ChatBubble.tsx`
- [MODIFY] `src/app/features/chat/components/ChatDeepResearch.tsx`
- [MODIFY] `src/app/features/chat/components/ChatConversationView.tsx`
- [MODIFY] `src/app/features/chat/components/ChatControls.tsx`
- [MODIFY] `src/app/features/chat/components/InputForm.tsx`
- [MODIFY] `src/app/features/chat/components/TokenBadge.tsx`
- [MODIFY] `src/app/features/personas/components/PersonaQuickSwitch.tsx`
- [MODIFY] `src/lib/utils/translations/vi.ts`
- [MODIFY] `src/lib/utils/translations/en.ts`
- [NEW] `src/lib/utils/translations/requiredKeys.test.ts`: test runtime chống key thiếu.

#### 5.4 Living docs

- [MODIFY] `docs/CHANGELOG.md`
- [MODIFY] `docs/features.md`: mục Novelcrafter (editor, layout tiers).

> File nhạy cảm (`*.test.ts(x)`) trong danh sách sẽ trả `ask` theo hook (05-plan-review §1.3(d)). Đây là hành vi mong đợi.

---

### 6. Caller-First Design Sketch

#### 6.1 Từ phía caller: `NovelcrafterStudioApp` (P2 layout)

```tsx
const layout = useStudioLayout();                       // + config.maxDockedSidePanes
const panes = useDockedPanes(layout.config);            // { isOpen(id), toggle(id), open(id), close(id) }
const editor = useChapterEditorController({
  chapter: story.activeChapter, selection, onSelectionChange: setSelection,
  isStreaming: stream.isStreaming, isLoadLocked, onTriggerStream: stream.triggerStream,
  onUpdateChapter: story.updateChapter, onUpdateFeedbackItems: story.updateChapterFeedbackItems,
  feedbackPane: { isOpen: panes.isOpen("feedback"), open: () => panes.open("feedback"),
                  toggle: () => panes.toggle("feedback") },
});

<HeaderBar hideOnDesktop onToggleSidebar={…} />
<NovelcrafterTopBar … />
<ChapterAiToolbar {...editor.toolbarProps} onStopStream={stream.stopStream} />   {/* full-width, above columns */}
<div className="flex-1 min-h-0 flex …">
  {panes.isOpen("navigator") && navigatorNode}
  <ChapterEditorWorkspace controller={editor} … />
  {panes.isOpen("history") && historyNode}
</div>
```

#### 6.2 Từ phía caller: `ChapterEditorWorkspace` → `ChapterManuscriptEditor` (P1)

```tsx
<ChapterManuscriptEditor
  ref={editorHandleRef} // ManuscriptEditorHandle
  chapterId={chapter.id}
  content={chapter.content}
  readOnly={isDirectStreamingToChapter || isLoadLocked}
  typography={typography} // ManuscriptTypography
  feedbackItems={feedbackItems}
  activeFeedbackId={controller.activeFeedbackId}
  storyBible={storyBible}
  selection={selection}
  onChangeContent={(next) => onUpdateChapter(chapter.id, { content: next })}
  onSelectionChange={onSelectionChange}
  onFeedbackMarkClick={(id) => controller.selectFeedbackById(id)}
  onOpenCodexEntity={(kind) =>
    onJumpToBibleSection(kind === "character" ? "characters" : "worldbuilding")
  }
  bubble={{ disabled, onRewrite, onDescribe, onExpand, onFeedback, onQuickEdit }}
  ariaLabel={chapter.title}
/>;

// imperative handle consumed by SheetSubToolbar & feedback jump:
interface ManuscriptEditorHandle {
  applyFormat(fmt: ManuscriptFormat): void; // bold|italic|strike|h1|h2|ul|ol|hr
  scrollToFeedback(feedbackId: string): boolean; // false → quote not found
  focusRange(start: number, end: number): void;
}
```

#### 6.3 Từ phía test: các hàm thuần (contract, xem §8)

```ts
// manuscriptMarkup.ts
export type ManuscriptBlockKind = "paragraph" | "h1" | "h2" | "sceneBreak" | "bullet" | "ordered" | "blank";
export type ManuscriptInlineKind = "text" | "marker" | "bold" | "italic" | "strike";
export interface ManuscriptInlineSegment { kind: ManuscriptInlineKind; start: number; end: number }
export interface ManuscriptLine { index: number; start: number; end: number; /* excl. "\n" */ block: ManuscriptBlockKind; segments: ManuscriptInlineSegment[] }
export function tokenizeManuscriptLines(content: string): ManuscriptLine[];
export function applyManuscriptFormat(content: string, start: number, end: number, fmt: ManuscriptFormat):
  { content: string; selectionStart: number; selectionEnd: number };

// manuscriptDecorations.ts
export type ManuscriptDecoration =
  | { kind: "feedback"; id: string; start: number; end: number; active: boolean }
  | { kind: "codex"; entityId: string; entityKind: "character" | "world"; start: number; end: number }
  | { kind: "selection"; start: number; end: number };
export interface RenderSegment { text: string; start: number; end: number; classes: string[];
  feedbackId?: string; codexId?: string; codexKind?: "character" | "world"; }
export interface RenderLine { index: number; block: ManuscriptBlockKind; segments: RenderSegment[]; signature: string; hasTrailingNewline: boolean }
export function buildFeedbackDecorations(content: string, items: NovelcrafterFeedbackItem[], activeId: string | null): ManuscriptDecoration[];
export function buildRenderLines(content: string, lines: ManuscriptLine[], decorations: ManuscriptDecoration[]): RenderLine[];
export function isSafeDecorationId(id: string): boolean;   // /^[A-Za-z0-9_-]{1,100}$/

// codexMatcher.ts
export interface CodexMentionRange { entityId: string; entityKind: "character" | "world"; start: number; end: number }
export function findCodexMentionRanges(storyBible: StoryBible, text: string, maxRanges?: number): CodexMentionRange[];

// manuscriptHistory.ts
export interface ManuscriptHistoryEntry { content: string; selectionStart: number; selectionEnd: number; at: number }
export interface ManuscriptHistoryState { past: ManuscriptHistoryEntry[]; future: ManuscriptHistoryEntry[] }
export function pushHistory(s: ManuscriptHistoryState, e: ManuscriptHistoryEntry, opts?: { coalesceMs?: number; cap?: number }): ManuscriptHistoryState;
export function undoHistory(s: ManuscriptHistoryState, current: ManuscriptHistoryEntry): { state: ManuscriptHistoryState; entry: ManuscriptHistoryEntry | null };
export function redoHistory(…): same shape;

// manuscriptTypography.ts
export interface ManuscriptTypography { fontFamily: "serif" | "sans" | "mono"; fontSize: "sm" | "md" | "lg" | "xl";
  lineHeight: "compact" | "normal" | "relaxed"; paragraphIndent: boolean }
export const DEFAULT_MANUSCRIPT_TYPOGRAPHY: ManuscriptTypography; // serif, md, normal, false
export const MANUSCRIPT_TYPOGRAPHY_STORAGE_KEY = "vikini:nc-manuscript-typography:v1";
export function sanitizeManuscriptTypography(raw: unknown): ManuscriptTypography;

// selectionBubblePlacement.ts
export function computeSelectionBubblePosition(input: { selectionRect: RectLike; containerRect: RectLike;
  containerScrollTop: number; bubbleWidth: number; bubbleHeight: number; gapPx?: number; edgePaddingPx?: number }):
  { top: number; left: number; placement: "above" | "below" };

// quoteScrollPositioning.ts
export function computeQuoteScrollTop(input: { targetRectTop: number; containerRectTop: number;
  containerScrollTop: number; containerClientHeight: number }): number;

// studioLayout.ts
export type DockedPaneId = "navigator" | "history" | "feedback";
export interface StudioLayoutConfig { …existing; maxDockedSidePanes: 0 | 1 | 2 | 3 }
export function applyDockedPaneToggle(openOrder: readonly DockedPaneId[], pane: DockedPaneId, maxDocked: number): DockedPaneId[];
export function resolveInitialDockedPanes(maxDocked: number): DockedPaneId[];   // ["navigator","history"].slice(0,max)
```

#### 6.4 Kiến trúc render DOM của editor (cốt lõi P1)

```
<div contenteditable="plaintext-only" role="textbox" aria-multiline="true" spellcheck
     class="whitespace-pre-wrap break-words …typography classes" data-nc-manuscript>
  <div data-line="0" data-sig="…" class="nc-line nc-h1">            ← block element per source line
    <span class="nc-marker"># </span><span class="nc-text">Chương 1</span>"\n"   ← trailing "\n" text node (except last line)
  </div>
  <div data-line="1" class="nc-line nc-paragraph">
    <span>Lan bước vào </span>
    <span data-codex-id="c1" data-codex-kind="character" class="nc-codex">Minh</span>
    <mark data-feedback-id="fb_12" class="nc-feedback">ánh trăng bạc</mark> …"\n"
  </div>
</div>
```

- **Bất biến I1**: `root.textContent === content`. Mọi text node (gồm cả `"\n"`) đều được tính; `<br>` placeholder của dòng rỗng không đóng góp ký tự. Nhờ vậy offset trong DOM bằng offset trong chuỗi, `selection`/`handleReplaceSelection`/`findQuoteRangeInText` giữ nguyên.
- **Reconcile theo từng dòng**: với mỗi `RenderLine`, so `signature` với `lineEl.dataset.sig`. Chỉ thay những dòng khác chữ ký. Sau một sự kiện `input` bình thường, nếu cấu trúc segment mà DOM tạo ra (đọc bằng `deriveDomLineSignature`) đã khớp chữ ký mong muốn thì **không chạm DOM**. Cách này giữ caret native, IME và autocorrect trên iOS khi gõ chữ thường.
- **Luồng input**:
  - `beforeinput`: các inputType `insertParagraph`/`insertLineBreak` được chặn và chèn `"\n"` qua model. `insertFromPaste`/`insertFromDrop` được chặn và chèn `text/plain`. `historyUndo`/`historyRedo` được chuyển sang history riêng. `format*` bị chặn.
  - `input` (khi không đang composition): `serialize` → `onChangeContent`, rồi reconcile và khôi phục caret theo offset đã lưu.
  - `compositionstart`..`compositionend`: tạm dừng reconcile. Khi `compositionend` thì làm một lượt `input`.
- **Content thay đổi từ ngoài** (stream, accept suggestion, replace selection): khi `content !== lastEmittedRef` thì reconcile. Nếu editor đang focus thì khôi phục caret theo offset đã clamp. Đồng thời `pushHistory` để Ctrl+Z hoàn tác được cả thao tác AI.
- **Persisted selection**: khi editor blur mà `selection` khác null, thêm decoration `selection` (class `nc-selection`, nền `--accent` 25%). Khi focus lại thì bỏ decoration và khôi phục native selection bằng `setSelectionOffsets`.

---

### 7. Các Bước Thực Hiện Tuần Tự

#### Phase A — Logic thuần `src/lib/features/novelcrafter/` (TDD: viết test trước)

- [ ] **A1** `manuscriptMarkup.ts`: `tokenizeManuscriptLines`. Tách theo `"\n"`. Block: `^# ` → h1, `^## ` → h2, `^(\*\s*){3,}$|^-{3,}$` → sceneBreak, `^[-*] ` → bullet, `^\d+\. ` → ordered, chuỗi rỗng → blank, còn lại → paragraph. Inline (chỉ quét trong dòng, không lồng phức tạp): `**…**` → marker/bold/marker, `~~…~~` → strike, `*…*`/`_…_` → italic (không khớp nếu cặp chưa đóng). Hàm < 50 dòng; chia thành `classifyBlock` và `tokenizeInline`.
- [ ] **A2** `applyManuscriptFormat`: chuyển logic từ `ChapterEditorWorkspace.tsx:165-186` sang hàm thuần, trả thêm vị trí selection mới. Có thêm cơ chế toggle: nếu vùng chọn đã được bọc `**` thì gỡ bọc.
- [ ] **A3** `manuscriptDecorations.ts`: `isSafeDecorationId`, `buildFeedbackDecorations` (chỉ lấy item `status==="open"` có `quote`; gọi `findQuoteRangeInText`; ID không hợp lệ thì bỏ qua). `buildRenderLines`: cắt boundary của segment cộng boundary của decoration thành atomic segment, gộp class. Thứ tự ưu tiên class khi chồng nhau: selection > feedback > codex, nhưng vẫn giữ đủ data-attr. Nếu codex và feedback chồng nhau thì một atomic segment có cả hai attribute. `signature` = chuỗi ổn định `block|kind:classes:text…`.
- [ ] **A4** `codexMatcher.ts`: `findCodexMentionRanges`. Với mỗi card (character trước, world sau), lấy tên và alias độ dài ≥2. Dựng regex Unicode boundary với cờ `giu` (CJK thì dùng vòng lặp `indexOf`). Chọn non-overlapping theo "match dài nhất thắng, sau đó vị trí sớm hơn thắng". Cắt ở `maxRanges` (mặc định 2000). Không đổi `doesCodexTermMatchContext` hay `matchCodexEntitiesInContext`.
- [ ] **A5** `manuscriptHistory.ts`: coalesce khi 2 lần push cách nhau < 800ms **và** cả hai đều là thay đổi nhỏ (`|Δlen| ≤ 2`). Cap 200 entry, bỏ entry cũ nhất. Push mới thì xóa `future`.
- [ ] **A6** `manuscriptTypography.ts`: các literal union, default, `sanitize` (input không phải object hoặc giá trị lạ thì trả default từng field).
- [ ] **A7** `selectionBubblePlacement.ts`: mặc định đặt bubble phía trên selection. Lật xuống dưới nếu `top < edgePadding`. Clamp `left` trong `[edgePadding, containerWidth - bubbleWidth - edgePadding]`. Tọa độ tính tương đối với nội dung cuộn (`+ scrollTop`).
- [ ] **A8** `quoteScrollPositioning.ts`: xóa `MIRROR_STYLE_PROPERTIES` và `measureCaretOffsetTop`. `computeQuoteScrollTop` = `targetRectTop - containerRectTop + containerScrollTop - clamp(100, 0.3·clientHeight, 220)`, kết quả ≥ 0. Comment đầu file đổi "Sudowrite Golden Third" → "Golden Third".
- [ ] **A9** `studioLayout.ts`: `maxDockedSidePanes`: <1180 → 0 (drawer/sheet); 1180–1535 → 1; 1536–1919 → 2; ≥1920 → 3. `allowDualDockedSidebars = max ≥ 2`. `feedbackGutterMode`: compact → `bottom-sheet`; medium → `sheet`; expanded → `docked` (vì đã có loại trừ lẫn nhau). Thêm `applyDockedPaneToggle` (đóng nếu đang mở; nếu mở mà vượt max thì loại pane mở lâu nhất) và `resolveInitialDockedPanes`.
- [ ] **A10** Viết hoặc cập nhật 7 file test ở §5.1 theo Test Contract §8. Chạy `npx vitest run src/lib/features/novelcrafter --reporter=dot`.

#### Phase B — Editor P1 (`src/app/features/novelcrafter/`)

- [ ] **B1** `utils/manuscriptDomOffsets.ts`:
  - `getOffsetFromDomPosition(root, node, offset)`: TreeWalker `SHOW_TEXT`, cộng dồn `length`. Nếu `node` là element thì đổi sang text node con thứ `offset`.
  - `resolveDomPosition(root, offset)`: clamp `[0, len]`; ưu tiên vị trí trước `"\n"` ở cuối dòng.
  - `readSelectionOffsets(root)`: trả `null` nếu selection nằm ngoài root.
  - `setSelectionOffsets(root, start, end)`.
  - `serializeManuscriptRoot(root)`: `root.textContent ?? ""`, chuẩn hóa `\r\n`.
  - `buildLineElement(doc, line: RenderLine)`: **chỉ** dùng `createElement`/`textContent`/`dataset`. Dòng rỗng chèn `<br data-nc-placeholder>`.
  - `deriveDomLineSignature(lineEl)`.
- [ ] **B2** `hooks/useManuscriptEditor.ts` (≤ 300 dòng; chia nhỏ hàm nội bộ < 50 dòng):
  - Ref: `rootRef`, `lastEmittedRef`, `isComposingRef`, `historyRef`, `rafRef`, `codexTimerRef`.
  - `reconcile(content, decorations, caret?)`: thay theo dòng, xóa các dòng thừa.
  - Handler: `onBeforeInput`, `onInput`, `onCompositionStart/End`, `onKeyDown` (Ctrl/Cmd+Z, Shift+Z, Y, B, I, K, Enter khi có modifier), `onFocus`/`onBlur` (bật/tắt persisted selection), `onClick` (dùng `closest('[data-feedback-id]')` hoặc `closest('[data-codex-id]')` để dispatch).
  - Lắng nghe `document` `selectionchange`, throttle bằng rAF, để gọi `onSelectionChange` (offset + text).
  - Codex ranges debounce 250ms khi `content` đổi; feedback decorations tính ngay (số item nhỏ).
  - Cleanup khi unmount: `cancelAnimationFrame`, `clearTimeout`, `removeEventListener("selectionchange")`.
  - Đổi `chapterId` thì reset history và `lastEmittedRef`.
- [ ] **B3** `components/ChapterManuscriptEditor.tsx` (≤ 350 dòng):
  - `forwardRef` + `useImperativeHandle` (`applyFormat`, `scrollToFeedback`, `focusRange`).
  - Root `contentEditable={readOnly ? "false" : "plaintext-only"}`, `role="textbox"`, `aria-multiline`, `aria-label`, `aria-readonly`. Placeholder qua `data-placeholder` + CSS `empty:before` (Tailwind `before:content-[attr(data-placeholder)]`), chỉ khi content rỗng.
  - Class typography map: font `font-serif` / `font-sans` / `font-mono`; size `text-[16px]…text-[20px]`; leading `leading-[1.6|1.8|2.0]`; indent `[&_.nc-paragraph]:indent-[1.5em]`. Class cho từng dòng: `.nc-h1 text-[1.6em] font-semibold`, `.nc-h2 text-[1.3em] font-semibold`, `.nc-sceneBreak text-center tracking-[0.5em] text-(--text-secondary)`, `.nc-marker opacity-40`, `.nc-bold font-bold`, `.nc-italic italic`, `.nc-strike line-through`, `.nc-feedback bg-(--warning)/15 underline decoration-(--warning) decoration-2 underline-offset-4 cursor-pointer`, `.nc-feedback-active bg-(--warning)/30`, `.nc-codex underline decoration-dotted decoration-(--accent) cursor-help`, `.nc-selection bg-(--accent)/25`. Tất cả khai báo qua arbitrary variant `[&_.nc-x]:…` trên root, nên **không cần file CSS mới**.
  - Floating bubble: dùng `ChapterSelectionToolbar` ở chế độ absolute. Vị trí tính từ `computeSelectionBubblePosition` với `Range.getBoundingClientRect()`. Trên pointer `coarse` hoặc khi `feedbackMode==="bottom-sheet"` thì bubble chuyển thành thanh cố định đáy `bottom-[calc(var(--nc-kb-offset,0px)+0.75rem)]`, để không đụng menu native của iOS/Android.
  - Codex preview: `Popover` (anchor là span được click; hover mở sau 300ms trên pointer `fine`), nội dung `CodexEntityPreview`.
  - Quick Edit inline input nằm trong bubble. Enter → `onQuickEdit(prompt)`; Esc → đóng.
- [ ] **B4** `components/ChapterSelectionToolbar.tsx`: props mới `{ placement: {top,left,placement} | "docked-bottom"; disabled; onRewrite(mode,label); onDescribe(label); onExpand(label); onFeedback(label); quickEdit: {open,prompt,onToggle,onChangePrompt,onSubmit} }`. Bubble gồm: Rewrite (dropdown: rephrase / show-don't-tell / shorter, dùng `DropdownMenu`), Describe, Expand, Feedback, Quick Edit (Ctrl+K). `role="toolbar"`, có `aria-label`, mỗi nút có focus ring, chuyển focus bằng phím mũi tên trái/phải.
- [ ] **B5** `hooks/useChapterEditorController.ts`:
  - Chuyển từ Workspace các state `activeMenu`, `beatsOpen`, `activeFeedbackId`, `quickEditOpen/Prompt`.
  - Chuyển các handler `handleRunFirstDraft/Rewrite/Write/Feedback/Expand/Brainstorm`, `requireSelectionText`, `handleAcceptSuggestion`, gutter callbacks (`ChapterEditorWorkspace.tsx:225-321, 337-381`).
  - `beatsOpen` khởi tạo bằng `chapter.content.trim().length === 0`, reset khi `chapter.id` đổi.
  - `selectFeedbackById(id)` = set active, mở pane feedback, gọi `editorHandle.scrollToFeedback(id)`.
  - Trả về `toolbarProps` (đúng kiểu `ChapterAiToolbarProps` trừ `onStopStream`).
  - Hook ≤ 300 dòng; nếu vượt thì tách `useChapterGutterHandlers`.
- [ ] **B6** `scrollToFeedback(id)` trong editor: `root.querySelector('[data-feedback-id="'+CSS.escape(id)+'"]')`. Nếu không có thì `return false`. Có thì dùng `computeQuoteScrollTop({ targetRectTop: el.getBoundingClientRect().top, … })` → `container.scrollTo({top, behavior:"smooth"})`, sau đó `focusRange(start,end)` lấy từ decoration. `ChapterFeedbackGutter`: nếu `scrollToFeedback` trả false thì hiện `toast.info(t("novelcrafterQuoteModifiedBadge"))` (key sẵn có), giữ nguyên hành vi hiện tại khi quote đã bị sửa.
- [ ] **B7** `hooks/useManuscriptTypography.ts` + `components/ManuscriptTypographyMenu.tsx`:
  - Popover có 4 nhóm radio (`role="radiogroup"`, nút `aria-pressed`).
  - Đọc `localStorage` trong `useEffect` (tránh hydration mismatch), parse trong try/catch → `sanitizeManuscriptTypography`. Ghi trong try/catch; lỗi thì `logger.warn` (không phải hành động người dùng chủ động lưu, nên không toast).
  - `SheetSubToolbar`: thay nút cycle font-size (`SheetSubToolbar.tsx:108-117`) bằng menu này. Format button gọi `onApplyFormat(fmt)` → `editorHandle.applyFormat`.
- [ ] **B8** `ChapterEditorWorkspace.tsx`:
  - Xóa textarea, `useAutoResizeTextarea`, `measureCaretOffsetTop`, toolbar và quick-edit row.
  - Áp `MANUSCRIPT_SHEET_CLASS = "w-full mx-auto max-w-5xl xl:max-w-6xl 2xl:max-w-7xl min-[2200px]:max-w-[88rem]"` cho title, banner, empty state, beats, editor và InlineStoryBible.
  - Padding ngang đối xứng `px-4 md:px-10 xl:px-14`.
  - Mục tiêu ≤ 320 dòng.
- [ ] **B9** [DELETE] `useAutoResizeTextarea.ts`. Chạy `rg "useAutoResizeTextarea" src` phải trả 0 kết quả.

#### Phase C — Layout P2

- [ ] **C1** `NovelcrafterStudioApp.tsx`:
  - `useState(true)` cho `sidebarCollapsed` (D6).
  - `<HeaderBar hideOnDesktop … />`.
  - Thay `showLeftPane`/`showRightPane` bằng `useDockedPanes(layout.config)`.
  - Render `<ChapterAiToolbar>` **giữa** TopBar và hàng cột.
  - Truyền `conversationsLabel={t("yourStories")}` vào Sidebar.
  - Thêm skip link `<a href="#nc-manuscript" className="sr-only focus:not-sr-only …">{t("skipToMainContent")}</a>`.
  - Thêm `SheetDescription className="sr-only"` cho 2 Sheet, truyền `isInSheet` cho navigator và history.
  - Sau khi ẩn header desktop, `pt-[calc(3.5rem+var(--sat,0px))] md:pt-0` vẫn đúng.
  - Mục tiêu ≤ 430 dòng.
- [ ] **C2** `hooks/useDockedPanes.ts`:
  - State `openOrder: DockedPaneId[]`, khởi tạo bằng `resolveInitialDockedPanes(max)`.
  - Khi `max` đổi (resize) thì cắt bớt theo thứ tự mới nhất trước.
  - `toggle(id)` → `applyDockedPaneToggle`. `open(id)` chỉ thêm khi chưa mở.
  - Với `max===0`, pane hoạt động ở chế độ drawer với state `drawerOpen` riêng, nên giữ nhánh Sheet hiện có.
- [ ] **C3** `ChapterAiToolbar.tsx`:
  - Container `flex-nowrap overflow-hidden`, nhóm trái `flex-nowrap`.
  - Ở `xl+` hiện đủ 4 secondary tool. Từ `lg` đến `xl` chỉ hiện Rewrite và Feedback, còn lại vào nút More.
  - Ở <lg, giữ More toggle hiện có nhưng mở `DropdownMenu` (thay vì wrap inline như hiện tại, `ChapterAiToolbar.tsx:255-291`).
  - Divider `h-4 w-px` chỉ render giữa 2 nhóm đều đang hiển thị.
  - Mobile: `overflow-x-auto` + `[scrollbar-width:none]`, các nút giữ `shrink-0`.
- [ ] **C4** `ChapterEmptyStateActions.tsx`:
  - Một hàng pill compact `flex flex-wrap gap-2`, cao khoảng 40px.
  - Mô tả đưa vào `title` + `aria-describedby` (span `sr-only`); chỉ hiện thành text phụ ở `2xl`.
  - Bỏ khung dashed `p-4`. Giữ `data-testid`.
- [ ] **C5** `NovelcrafterTopBar.tsx`:
  - Nhóm trái: `basis-full sm:basis-0 sm:flex-1 min-w-0`. Ô title: `text-base sm:text-base md:text-base` (16px, tránh iOS zoom), `min-w-32`.
  - Nhóm phải: `w-full sm:w-auto flex-nowrap overflow-x-auto [scrollbar-width:none]`.
  - Trên mobile, nút history toggle chuyển sang nhóm trái (cạnh title) để hàng 2 chỉ còn Model, Routing, Export.
  - Comment `:158` bỏ chữ "Sudowrite".
- [ ] **C6** Sheet close overlap: thêm prop `isInSheet?: boolean` cho `NovelcrafterLeftNavigator`, `NovelcrafterHistoryPane` và `ChapterFeedbackGutter`; khi bật thì header của pane có thêm `pr-10`. Mỗi `SheetContent` trong StudioApp và Workspace có `SheetDescription` sr-only dùng key mới `novelcrafter{Navigator,History,Feedback}SheetDesc`.
- [ ] **C7** `HeaderBar.tsx`: prop `hideOnDesktop?: boolean` (mặc định false) → thêm `md:hidden`. Thêm test case.
- [ ] **C8** `Sidebar.tsx`: prop `conversationsLabel?: string` → `label={conversationsLabel || t("yourChats")}` (`:460`).

#### Phase D — Chat P3 + Bilingual/a11y

- [ ] **D1** Message width:
  - `ChatMessagesArea.tsx:198` và `ChatConversationView.tsx:51`: `max-w-3xl` → `max-w-3xl xl:max-w-4xl 2xl:max-w-5xl`.
  - Bỏ `lg:max-w-[90%]` ở `ChatMessagesArea.tsx:316`, `ChatBubble.tsx:214`, `ChatDeepResearch.tsx:45, 61` (giữ `max-w-[95%]` cho mobile).
  - `ChatControls.tsx:149`: `max-w-4xl` → `max-w-3xl xl:max-w-4xl 2xl:max-w-5xl` để thẳng hàng với message list.
- [ ] **D2** `ChatControls.tsx`:
  - Gom control thành mảng `controls: { key: string; node: ReactNode }[]`, chỉ push khi điều kiện hiển thị đúng.
  - Render `controls.map((c, i) => <Fragment key={c.key}>{i > 0 && <ControlDivider/>}{c.node}</Fragment>)`. `ControlDivider` là `hidden md:block h-3 w-px bg-(--border) mx-1 shrink-0`. Xóa 7 divider vô điều kiện.
  - Container: `flex-nowrap overflow-x-auto [scrollbar-width:none] justify-start md:justify-center md:overflow-visible`. Chip có `shrink-0` và `whitespace-nowrap`.
  - `WEB` hardcode (`:185`) → `t("webSearchLabel")` (key mới, "Web"/"Web").
  - Ghi chú: `GemQuickSwitch` và `PersonaQuickSwitch` cũng có divider đứng trước (sửa lỗi thiếu divider hiện tại).
- [ ] **D3** `InputForm.tsx`:
  - Hàng input: `flex flex-wrap md:flex-nowrap items-end gap-2`.
  - Wrapper textarea (`:296`): `order-first basis-full md:order-none md:basis-auto md:flex-1 min-w-0`.
  - Nút Plus giữ trái. Voice và Send dùng `ml-auto` trên mobile (Voice: `max-md:ml-auto`).
  - Desktop giữ nguyên 1 hàng.
- [ ] **D4** `FloatingMenuTrigger.tsx`:
  - `cn("…", className)` thay cho chuỗi template, hết class `undefined`.
  - Vị trí theo D3: `top-[45dvh] right-[calc(0.5rem+var(--sar,0px))]`, bỏ `bottom-[6rem] left-4`.
  - `aria-label={t("openMenu")}` (dùng `useLanguage`).
  - Thêm `type="button"` và `focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - `text-(--surface)` → `text-(--accent-foreground)` (dùng đúng token foreground).
- [ ] **D5** `TokenBadge.tsx`:
  - `text-secondary/60` → `text-(--text-secondary)`.
  - `hover:text-secondary` → `hover:text-(--text-primary)`.
  - `bg-surface-elevated border-token` → `bg-(--surface-elevated) border-(--border)`.
  - Gộp 2 `transition-*` thành `transition-[color,opacity]`.
  - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - Thêm `aria-label={t("tokenUsageAria")}` (key mới).
- [ ] **D6** `PersonaQuickSwitch.tsx`:
  - Màu `purple-500` → `bg-(--accent)/15 text-(--accent) border-(--accent)/25 hover:bg-(--accent)/25`.
  - `"No Personas found"` → `t("personaNoneFound")`. `"Remove Persona"` → `t("personaRemove")` kèm icon `UserX` (thay span rỗng `:97`).
  - `toast.error("Failed to apply persona")` → `toast.error(t("personaApplyFailed"))`, `catch (error: unknown)` + `logger.error`.
  - `.catch(() => {})` (`:36`) → log lỗi + `toast.error(t("personaLoadFailed"))` + `setPersonas([])`.
  - Thêm `type="button"` cho mọi nút và `aria-haspopup`.
- [ ] **D7** Translations `vi.ts` + `en.ts` (thêm đồng thời; danh sách đầy đủ ở §8 TC-I18N):
  - 7 key audit: `manageGems`, `startListening`, `stopListening`, `readAloud`, `skipToMainContent`, `openMenu`, `yourStories`.
  - Key mới cho Chat: `webSearchLabel`, `tokenUsageAria`, `personaNoneFound`, `personaRemove`, `personaApplyFailed`, `personaLoadFailed`.
  - Key mới cho Novelcrafter (editor, typography, codex, sheet, gutter, StoryBible).
  - Sửa 3 chuỗi Sudowrite ở `en.ts:1007, 1022, 1056`, và kiểm tra đoạn tương ứng trong `vi.ts` (grep hiện 0 kết quả) → "Novelcrafter".
- [ ] **D8** a11y StoryBible + Gutter:
  - `StoryBibleWorkspace.tsx:252-286`: `useId()` → `<label htmlFor={povId}>`/`<select id={povId}>` (tương tự cho tense).
  - `:398, :412`: `aria-label={t("novelcrafterOutlinePovLabel")}` / `t("novelcrafterOutlineTenseLabel")`.
  - `StoryBibleSectionCard`: prop `headingLevel?: 2 | 3`, mặc định 2, render `<h2>`/`<h3>`. `StoryBibleWorkspace` truyền `embedded ? 3 : 2`. `InlineStoryBibleSection.tsx:66`: `h3` → `h2`.
  - `ChapterFeedbackGutter.tsx`:
    - `:139` → `t("novelcrafterFeedbackPrevItem")`; `:148` → `t("novelcrafterFeedbackNextItem")`.
    - `:157` → `t("novelcrafterFeedbackMoreActions")`, kèm `aria-haspopup="menu"`.
    - `:334/:350` → `t("novelcrafterFeedbackRateUp")` / `t("novelcrafterFeedbackRateDown")`.
    - `<article>` thêm `data-feedback-card-id={item.id}`. `useEffect` khi `activeFeedbackId` đổi thì `scrollIntoView({block:"nearest", behavior:"smooth"})`.
    - Comment `:103, :264` bỏ chữ "Sudowrite".
  - `NovelcrafterLeftNavigator.tsx:99, 217`: comment bỏ chữ "Sudowrite".
- [ ] **D9** `ChatApp.tsx`: skip link `sr-only focus:not-sr-only` (mục tiêu `#main-content`) đặt đầu tiên trong root; vùng message scroll container có `id="main-content"` và `tabIndex={-1}`.
- [ ] **D10** `requiredKeys.test.ts` (§8 TC-I18N).

#### Phase E — Verification & Living Docs

- [ ] **E1** `npm run type-check; npm run lint; npm run test:run`, đều phải 0 lỗi và 0 warning mới.
- [ ] **E2** Chạy các Wiring Probe và Negative Probe ở §9.3–9.4.
- [ ] **E3** QA thủ công trên 4 viewport theo bảng §9.5 (Chrome DevTools device mode + Firefox ≥136 + Safari/iOS nếu có).
- [ ] **E4** Cập nhật `docs/CHANGELOG.md` và `docs/features.md`.
- [ ] **E5** Đổi Header plan sang `- **Status**: Completed` sau khi `@qa` PASS.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

> Quy ước: mọi test là `vitest` co-located. "PASS" chỉ khi **toàn bộ** `expect` đúng như mô tả; cấm nới matcher (`toEqual` → `toBeDefined`) hay dùng `.skip`/`.only`.

#### TC-MARKUP (`manuscriptMarkup.test.ts`)

| ID                  | Input                                                                                                            | Output kỳ vọng                                                                                                                                                                | Loại           |
| :------------------ | :--------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- |
| MK-1                | `"# Title\nBody **bold** and *it* ~~x~~\n\n***\n## Sub"`                                                         | 5 dòng, block lần lượt `h1, paragraph, blank, sceneBreak, h2`. Dòng 1 có segment `marker("**")`, `bold("bold")`, `marker("**")`, `italic`, `strike` với offset tuyệt đối đúng | Happy          |
| MK-2 (**bất biến**) | 500 chuỗi ngẫu nhiên (PRNG seed cố định 42, alphabet gồm `#*~_-\n ` + tiếng Việt có dấu + CJK + emoji surrogate) | Với mọi chuỗi: nối `content.slice(seg.start, seg.end)` của mọi segment, cộng `"\n"` giữa các dòng, phải `===` input. Các segment liên tiếp, không hở, không chồng             | Property       |
| MK-3                | `"**unclosed"`, `"*"`, `"~~"`                                                                                    | Toàn bộ là `text`/`paragraph`. Không throw                                                                                                                                    | Boundary       |
| MK-4                | `""`                                                                                                             | `[ { index:0, start:0, end:0, block:"blank", segments:[] } ]`                                                                                                                 | Boundary       |
| MK-5                | Chuỗi 150.000 ký tự (`MAX_CHAPTER_PROSE_CHARS`)                                                                  | Hoàn thành < 50ms (`performance.now()`, ngưỡng nới ×3 trên CI = 150ms)                                                                                                        | Perf           |
| MK-6                | `applyManuscriptFormat("abc", 0, 3, "bold")` → bọc rồi gọi lần 2 trên vùng chọn mới                              | Lần 1: `"**abc**"`, selection `[2,5]`. Lần 2: `"abc"` (toggle gỡ)                                                                                                             | Happy          |
| MK-7                | `applyManuscriptFormat("abc", 5, 9, "h1")` (offset vượt độ dài)                                                  | Offset được clamp, không throw, kết quả chứa `"# "`                                                                                                                           | Error/Boundary |

#### TC-DECOR (`manuscriptDecorations.test.ts`)

| ID                  | Input                                                                  | Output kỳ vọng                                                                                       |
| :------------------ | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| DC-1                | content có quote "ánh trăng", feedback open id `fb_1`                  | `RenderSegment` chứa text "ánh trăng", `feedbackId:"fb_1"`, class `nc-feedback`                      |
| DC-2                | feedback `status:"resolved"` hoặc `quote:""`                           | Không có decoration feedback                                                                         |
| DC-3 (**Negative**) | feedback id `'x" onclick="alert(1)'` hoặc `"a b"` hoặc chuỗi 101 ký tự | `isSafeDecorationId` = false; **không** segment nào có `feedbackId`. Text vẫn render đủ              |
| DC-4                | feedback và codex chồng một phần nhau                                  | Atomic segment ở vùng giao có cả `feedbackId` và `codexId`. Tổng text vẫn bằng content (bất biến I1) |
| DC-5                | decoration `selection [3,7]`                                           | Segment [3,7] có class `nc-selection`                                                                |
| DC-6                | 2 lần `buildRenderLines` cùng input                                    | `signature` giống hệt. Đổi 1 ký tự ở dòng 2 thì chỉ signature dòng 2 thay đổi                        |

#### TC-CODEX (`codexMatcher.test.ts`, thêm mới)

| ID                  | Input                                                       | Output                                                                        |
| :------------------ | :---------------------------------------------------------- | :---------------------------------------------------------------------------- |
| CX-1                | Card "Minh" (alias "Tiểu Minh"), text "Tiểu Minh gặp Minh." | 2 range: `[0,9]` (alias dài hơn thắng) và `[14,18]`, `entityKind:"character"` |
| CX-2                | "Minhanh"                                                   | 0 range (Unicode boundary)                                                    |
| CX-3                | Card CJK "李明", text "他叫李明。"                          | 1 range                                                                       |
| CX-4 (**Negative**) | Tên 1 ký tự "A"; tên chứa regex meta `"C++ (x)"`            | "A" bị bỏ qua. Meta được escape, không throw, khớp literal                    |
| CX-5                | 15 card × 10 alias; text chứa 5000 lần nhắc                 | `length === 2000` (cap `maxRanges`)                                           |
| CX-6                | world element "Hà Thành"                                    | `entityKind:"world"`                                                          |
| CX-7                | Test cũ `matchCodexEntitiesInContext`                       | Không đổi, vẫn PASS                                                           |

#### TC-HISTORY (`manuscriptHistory.test.ts`)

- HS-1: push A, B, C (cách nhau >800ms) → undo trả C→B, undo tiếp →A, redo →B.
- HS-2: 5 lần push, mỗi lần cách 100ms, Δlen=1 → gộp thành 1 entry.
- HS-3 (**Negative**/cap): push 250 entry → `past.length === 200`, entry cũ nhất bị loại.
- HS-4: undo khi `past` rỗng → `entry: null`, state không đổi.
- HS-5: push sau undo → `future` rỗng.

#### TC-TYPO (`manuscriptTypography.test.ts`)

- TY-1: `sanitize(undefined|null|42|"x")` → `DEFAULT_MANUSCRIPT_TYPOGRAPHY`.
- TY-2 (**Negative**): `{fontFamily:"comic", fontSize:"xxl", lineHeight:"tight", paragraphIndent:"yes"}` → mọi field trả về giá trị default.
- TY-3: object hợp lệ thì giữ nguyên. Field lạ thừa (`__proto__`, `evil`) bị loại khỏi output (`Object.keys` đúng 4 key).

#### TC-BUBBLE (`selectionBubblePlacement.test.ts`)

- BB-1: selection ở giữa → `placement:"above"`, `top = selRect.top - containerRect.top + scrollTop - bubbleHeight - gap`.
- BB-2: selection sát mép trên → `placement:"below"`.
- BB-3: selection sát mép phải hoặc trái → `left` bị clamp vào `[edge, width - bubbleWidth - edge]`.
- BB-4 (Boundary): container hẹp hơn bubble → `left === edgePadding`, không ra số âm.

#### TC-SCROLL (`quoteScrollPositioning.test.ts`, Loại C, viết lại)

- SC-1: `{targetRectTop:900, containerRectTop:100, containerScrollTop:200, containerClientHeight:600}` → `900-100+200-180 = 820`.
- SC-2: kết quả âm thì clamp về 0.
- SC-3: `clientHeight` rất nhỏ (200) → padding = 100; rất lớn (2000) → padding = 220.
- SC-4 (**Negative**): module **không** còn export `measureCaretOffsetTop`/`MIRROR_STYLE_PROPERTIES` (`expect(Object.keys(mod)).not.toContain("measureCaretOffsetTop")`).

#### TC-LAYOUT (`studioLayout.test.ts`, Loại C)

| ID   | Width            | `maxDockedSidePanes` | `allowDualDockedSidebars` | `feedbackGutterMode` |
| :--- | :--------------- | :------------------- | :------------------------ | :------------------- |
| LY-1 | 390              | 0                    | false                     | `bottom-sheet`       |
| LY-2 | 900              | 0                    | false                     | `sheet`              |
| LY-3 | 1366             | 1                    | false                     | `docked`             |
| LY-4 | 1440             | 1                    | false                     | `docked`             |
| LY-5 | 1535 / 1536      | 1 / 2                | false / true              | `docked`             |
| LY-6 | 1920             | 3                    | true                      | `docked`             |
| LY-7 | 2560             | 3                    | true                      | `docked`             |
| LY-8 | `NaN`, `-1`, `0` | fallback 1280 → 1    | false                     | `docked`             |

- LY-9 `applyDockedPaneToggle(["navigator"], "history", 1)` → `["history"]` (loại navigator).
- LY-10 `applyDockedPaneToggle(["navigator","history"], "feedback", 2)` → `["history","feedback"]`.
- LY-11 `applyDockedPaneToggle(["navigator"], "navigator", 1)` → `[]` (đóng).
- LY-12 (**Negative**) max=0 → `[]` với mọi toggle (không cho dock).
- LY-13 `resolveInitialDockedPanes(1)` → `["navigator"]`; `(3)` → `["navigator","history"]`.

#### TC-DOM (`manuscriptDomOffsets.test.ts`, happy-dom)

- DM-1: dựng root từ `buildLineElement` cho `"ab\n\ncd"` → `serialize(root) === "ab\n\ncd"`. Dòng rỗng có `<br data-nc-placeholder>` và textContent của dòng đó là `"\n"`.
- DM-2: `resolveDomPosition(root, 4)` → text node của "cd", offset 0. `getOffsetFromDomPosition` của chính vị trí đó trả 4 (round-trip cho mọi offset 0..len).
- DM-3: `setSelectionOffsets(root,1,5)`, rồi `readSelectionOffsets(root)` → `{start:1,end:5}`.
- DM-4: selection nằm ngoài root → `null`.
- DM-5 (**Negative**/XSS): `buildLineElement` với text `<img src=x onerror=alert(1)>` → `lineEl.querySelector("img") === null`, `lineEl.textContent` chứa nguyên chuỗi.
- DM-6: offset vượt độ dài → clamp về cuối, không throw.

#### TC-I18N (`src/lib/utils/translations/requiredKeys.test.ts`)

- I18-1: Với mảng `REQUIRED_KEYS` (7 key audit + toàn bộ key mới của plan), mỗi key tồn tại trong `vi` **và** `en`, `typeof === "string"` và `trim().length > 0`.
- I18-2 (**Negative**): `Object.values(en)` không string nào match `/sudowrite/i`. Tương tự với `vi`.
- I18-3: `vi[k] !== k` (không để tên key làm giá trị).

#### Error messages và failure mode ở UI (kiểm thủ công bởi `@qa`)

| Tình huống                                | Kỳ vọng                                                                     |
| :---------------------------------------- | :-------------------------------------------------------------------------- |
| Click thẻ Feedback có quote đã bị sửa     | `toast.info(t("novelcrafterQuoteModifiedBadge"))`, không cuộn, không throw  |
| Bubble action khi chưa chọn text (Ctrl+K) | `toast.info(t("novelcrafterSelectTextHint"))`                               |
| `localStorage` bị chặn (Safari private)   | Typography dùng default, chỉ `logger.warn`, UI vẫn chạy                     |
| Persona load hoặc apply lỗi               | `toast.error(t("personaLoadFailed"/"personaApplyFailed"))` + `logger.error` |
| Đang stream trực tiếp vào chương          | Editor `contentEditable="false"`, `aria-readonly="true"`, bubble ẩn         |

**Tiêu chí chống specification gaming cho `@qa`**:

1. MK-2 phải dùng ≥500 chuỗi ngẫu nhiên với seed cố định. Cấm hardcode output.
2. TC-LAYOUT phải assert **cả 3 field** của mỗi hàng.
3. DM-5 và DC-3 phải chứng minh payload độc hại **không** tạo element hay attribute, chứ không chỉ "không throw".
4. Grep probe ở §9.3 phải ra đúng kết quả mô tả.

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Test co-located

| Source                          | Test                                 | Ghi chú                                       |
| :------------------------------ | :----------------------------------- | :-------------------------------------------- |
| `manuscriptMarkup.ts`           | `manuscriptMarkup.test.ts`           | TC-MARKUP                                     |
| `manuscriptDecorations.ts`      | `manuscriptDecorations.test.ts`      | TC-DECOR                                      |
| `manuscriptHistory.ts`          | `manuscriptHistory.test.ts`          | TC-HISTORY                                    |
| `manuscriptTypography.ts`       | `manuscriptTypography.test.ts`       | TC-TYPO                                       |
| `selectionBubblePlacement.ts`   | `selectionBubblePlacement.test.ts`   | TC-BUBBLE                                     |
| `quoteScrollPositioning.ts`     | `quoteScrollPositioning.test.ts`     | TC-SCROLL (Loại C)                            |
| `codexMatcher.ts`               | `codexMatcher.test.ts`               | TC-CODEX                                      |
| `studioLayout.ts`               | `studioLayout.test.ts`               | TC-LAYOUT (Loại C)                            |
| `utils/manuscriptDomOffsets.ts` | `utils/manuscriptDomOffsets.test.ts` | TC-DOM (có logic đáng kể → bắt buộc)          |
| `translations/{vi,en}.ts`       | `translations/requiredKeys.test.ts`  | TC-I18N                                       |
| `HeaderBar.tsx`                 | `HeaderBar.test.tsx`                 | Thêm case `hideOnDesktop` → class `md:hidden` |

Component render thuần (bubble, typography menu, codex preview) **không** viết test UI, theo `01-coding.md:72`. Logic của chúng đã nằm trong các hàm thuần được test ở trên.

#### 9.2 Lệnh kiểm thử (PowerShell 5.1, dùng `;`)

```powershell
npx vitest run src/lib/features/novelcrafter src/app/features/novelcrafter/utils src/lib/utils/translations src/app/features/layout --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

#### 9.3 Wiring Probes (chứng minh code mới thực sự được nối vào)

| #   | Lệnh                                                                                                                                                                              | Kỳ vọng                                        |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| W1  | `rg -n "<textarea" src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx src/app/features/novelcrafter/components/ChapterManuscriptEditor.tsx`                      | 0 kết quả                                      |
| W2  | `rg -n "measureCaretOffsetTop\|MIRROR_STYLE_PROPERTIES\|useAutoResizeTextarea" src`                                                                                               | 0 kết quả                                      |
| W3  | `rg -n "plaintext-only" src/app/features/novelcrafter`                                                                                                                            | ≥1 kết quả trong `ChapterManuscriptEditor.tsx` |
| W4  | `rg -n "data-feedback-id\|feedbackId" src/app/features/novelcrafter/utils/manuscriptDomOffsets.ts`                                                                                | ≥1 kết quả (dataset được gắn)                  |
| W5  | `rg -n "<ChapterAiToolbar" src/app/features/novelcrafter`                                                                                                                         | Chỉ có trong `NovelcrafterStudioApp.tsx`       |
| W6  | `rg -n "lg:max-w-\[90%\]" src/app/features/chat`                                                                                                                                  | 0 kết quả                                      |
| W7  | `rg -n "hideOnDesktop" src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`                                                                                        | 1 kết quả                                      |
| W8  | `rg -n "useDockedPanes\|applyDockedPaneToggle" src/app/features/novelcrafter`                                                                                                     | ≥2 kết quả                                     |
| W9  | `rg -in "sudowrite" src/lib/utils/translations src/app/features/novelcrafter`                                                                                                     | 0 kết quả                                      |
| W10 | `rg -n "innerHTML\|dangerouslySetInnerHTML" src/app/features/novelcrafter`                                                                                                        | 0 kết quả                                      |
| W11 | `rg -n "purple-\|text-secondary/\|bg-surface-elevated\|border-token" src/app/features/personas/components/PersonaQuickSwitch.tsx src/app/features/chat/components/TokenBadge.tsx` | 0 kết quả                                      |
| W12 | `rg -n "\\\$\{className\}" src/app/features/layout/components/FloatingMenuTrigger.tsx`                                                                                            | 0 kết quả                                      |

#### 9.4 Negative Probes (evidence-bar §4.5.3)

| #   | Guard/Control                                                           | Probe                                                    | Kết quả bắt buộc                                                                                                                                                                     |
| :-- | :---------------------------------------------------------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Chống XSS khi render editor (`buildLineElement` chỉ dùng `textContent`) | DM-5                                                     | Không có `<img>`; payload chỉ là text                                                                                                                                                |
| N2  | Lọc ID decoration (`isSafeDecorationId`)                                | DC-3                                                     | Không có `feedbackId` cho ID độc hại                                                                                                                                                 |
| N3  | Bất biến offset I1                                                      | MK-2 (500 chuỗi fuzz) + DM-1/DM-2 round-trip             | 100% khớp                                                                                                                                                                            |
| N4  | Loại trừ pane (`applyDockedPaneToggle`)                                 | LY-9…LY-12                                               | Số pane không vượt max; max=0 thì `[]`                                                                                                                                               |
| N5  | Sanitize typography từ `localStorage`                                   | TY-2/TY-3                                                | Giá trị độc hại hoặc lạ trả về default, key lạ bị loại                                                                                                                               |
| N6  | Translation key bắt buộc (vì `t(string)` không bị typecheck)            | I18-1/I18-2                                              | Thiếu key hoặc còn "Sudowrite" thì test fail. Kiểm chứng: tạm xóa `openMenu` khỏi `vi.ts` trên máy local thì `npx vitest run src/lib/utils/translations` phải FAIL (sau đó hoàn tác) |
| N7  | Cap codex (`maxRanges`)                                                 | CX-5                                                     | `length === 2000`                                                                                                                                                                    |
| N8  | Cap history                                                             | HS-3                                                     | `past.length === 200`                                                                                                                                                                |
| N9  | Parity vi/en compile-time (`index.ts:24-33`)                            | Tạm thêm key chỉ ở `en.ts` rồi chạy `npm run type-check` | Exit ≠ 0 với lỗi `_AssertTranslationsParity` (sau đó hoàn tác)                                                                                                                       |

#### 9.5 QA thủ công theo viewport (`@qa`)

| Viewport                | Kiểm tra                   | Tiêu chí PASS                                                                                                                                                                                                                          |
| :---------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2560×1440**           | `/novelcrafter` có văn bản | Sidebar thu gọn (80px). Không có HeaderBar. Toolbar AI 1 dòng full-width. Văn bản bắt đầu ở y ≤ 220px. Sheet căn giữa, chênh lệch khoảng trống trái/phải ≤ 8px. Nav + history + feedback cùng mở được                                  |
| **2560×1440**           | `/chat`                    | Message column ≤ `max-w-5xl` (1024px), căn giữa. ChatControls 1 dòng, không có divider ở đầu/cuối hàng                                                                                                                                 |
| **1920×1080**           | `/novelcrafter`            | Có thể mở đồng thời 3 pane; editor ≥ 640px                                                                                                                                                                                             |
| **1440×900 / 1366×768** | `/novelcrafter`            | Mặc định chỉ mở Navigator. Bấm History thì Navigator đóng. Bấm Feedback thì History đóng (tối đa 1 pane). Toolbar AI không wrap (More menu chứa phần còn lại)                                                                          |
| **390×844**             | `/novelcrafter`            | Ô title ≥ 128px rộng, font 16px (không zoom iOS). Nút đóng Sheet không đè nút Add chapter / More. Bubble hiện ở đáy, trên bàn phím. Typing tiếng Việt Telex hoặc bàn phím iOS không mất ký tự, caret không nhảy                        |
| **390×844**             | `/chat`                    | Textarea chiếm 100% chiều rộng hàng đầu; các nút ở hàng dưới. ChatControls cuộn ngang. FloatingMenuTrigger không đè input                                                                                                              |
| Tất cả                  | Editor                     | Ctrl+B/I bọc ký hiệu. Ctrl+Z/Y hoạt động (cả sau Accept suggestion). Paste HTML ra plain text. Click mark amber thì chọn đúng thẻ Feedback và cuộn tới. Hover/click tên nhân vật thì có preview. Blur editor thì vùng chọn vẫn tô sáng |
| Firefox ≥136, Safari    | Editor                     | `plaintext-only` hoạt động; Enter chèn đúng 1 `\n`                                                                                                                                                                                     |

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                                                    | Mức        | Technical Control (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                          |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **XSS** khi render nội dung truyện hoặc ID feedback (lấy từ output AI) vào DOM                                                            | **Cao**    | `buildLineElement` (`src/app/features/novelcrafter/utils/manuscriptDomOffsets.ts`, NEW) chỉ dùng `createElement` + `textContent` + `dataset`. ID đi qua `isSafeDecorationId` (`src/lib/features/novelcrafter/manuscriptDecorations.ts`, NEW). Kiểm chứng bằng **N1 (DM-5)**, **N2 (DC-3)** và **W10** (0 `innerHTML`/`dangerouslySetInnerHTML`)       |
| R2  | **Lệch offset DOM ↔ chuỗi**, khiến `handleReplaceSelection` (`NovelcrafterStudioApp.tsx:132-142`) thay sai đoạn → **mất dữ liệu văn bản** | **Cao**    | Bất biến I1 bảo đảm bởi `tokenizeManuscriptLines` + `serializeManuscriptRoot` = `textContent`. Kiểm chứng bằng **N3** (MK-2 fuzz 500 case, DM-1/DM-2 round-trip). Lưới an toàn: snapshot chương sẵn có (`ChapterEditorWorkspace.tsx:642-651`) và history undo mới (HS-1)                                                                              |
| R3  | **Hiệu năng** khi gõ ở chương 150k ký tự (tokenize + codex scan mỗi phím)                                                                 | Trung bình | Reconcile theo từng dòng, chỉ thay dòng đổi signature (DC-6). Codex debounce 250ms (`useManuscriptEditor.ts` `codexTimerRef`). Cap 2000 range (**N7**). Perf budget **MK-5** (<50ms / 150ms CI)                                                                                                                                                       |
| R4  | **IME / Telex tiếng Việt, autocorrect iOS** bị phá khi re-render DOM giữa lúc composition                                                 | Trung bình | `isComposingRef` tạm dừng reconcile từ `compositionstart` đến `compositionend`. Bỏ qua chạm DOM khi `deriveDomLineSignature === signature` (§6.4). QA thủ công 390×844 (§9.5). Có fallback dự phòng: nếu QA FAIL thì đặt `IME_SAFE_MODE` (chỉ reconcile khi blur hoặc idle 400ms). Đây là cờ hằng trong `useManuscriptEditor.ts`, không đổi kiến trúc |
| R5  | Native undo bị mất do DOM bị thay                                                                                                         | Trung bình | History riêng (`manuscriptHistory.ts`) + chặn `beforeinput` `historyUndo/Redo` và Ctrl+Z/Y. Kiểm chứng HS-1…HS-5, **N8**                                                                                                                                                                                                                              |
| R6  | Thay đổi hành vi layout ở 1180–1535px (trước được mở 2 pane, nay tối đa 1) làm người dùng bất ngờ                                         | Trung bình | Logic tập trung ở `applyDockedPaneToggle` (`src/lib/features/novelcrafter/studioLayout.ts`) và được kiểm chứng bằng **N4** (LY-3…LY-12). Đây là yêu cầu trực tiếp của task brief                                                                                                                                                                      |
| R7  | Key dịch thiếu render ra tên key thô, vì `t()` nhận `string` (`useLanguage.ts:20-27`)                                                     | Trung bình | `requiredKeys.test.ts` (**N6**), parity compile-time `index.ts:24-33` (**N9**)                                                                                                                                                                                                                                                                        |
| R8  | Ẩn HeaderBar desktop làm mất lối vào đổi ngôn ngữ/theme trong Novelcrafter                                                                | Thấp       | D2 (PM quyết định); prop opt-in `hideOnDesktop` nên Chat không bị ảnh hưởng (`HeaderBar.test.tsx` case mới)                                                                                                                                                                                                                                           |
| R9  | `plaintext-only` không được hỗ trợ trên trình duyệt cũ (Firefox <136)                                                                     | Thấp       | Fallback: nếu `root.contentEditable !== "plaintext-only"` sau khi gán thì đặt `"true"`. `beforeinput` vẫn chặn paste/format nên kết quả tương đương (`useManuscriptEditor.ts`)                                                                                                                                                                        |
| R10 | File vượt giới hạn kích thước sau refactor                                                                                                | Thấp       | Ngân sách dòng ở §7 (Workspace ≤320, StudioApp ≤430, hook ≤300, editor ≤350); kiểm khi review diff                                                                                                                                                                                                                                                    |
| R11 | `scrollIntoView` của gutter và scroll của editor cùng chạy gây giật                                                                       | Thấp       | Gutter dùng `block:"nearest"`; editor dùng `computeQuoteScrollTop` trên container riêng (TC-SCROLL)                                                                                                                                                                                                                                                   |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ

_Đây là Audit Run đầu tiên (Run 1) cho kế hoạch này. Không có lỗi tồn đọng từ các lượt audit trước._

| Mã Lỗi | Trạng Thái | Mô Tả                                | Bằng Chứng (`[SRC]` / `[CMD]`) |
| :----- | :--------- | :----------------------------------- | :----------------------------- |
| N/A    | N/A        | Lượt thẩm định đầu tiên (Revision 1) | N/A                            |

#### 2. Phát Hiện Mới

- Không phát hiện lỗi `[BLOCKER]` hay `[MAJOR]`. Kế hoạch tuân thủ đầy đủ ranh giới kiến trúc Vikini, bảo vệ bất biến character offset string-to-DOM, cách ly styling qua design tokens chuẩn, và có chiến lược kiểm thử TDD chặt chẽ.
- **Ghi chú vi mô `[MINOR]`**:
  - `[MINOR-01]`: Trong `useManuscriptEditor.ts` khi lắng nghe sự kiện `selectionchange` trên toàn `document`, cần kiểm tra kỹ `document.activeElement === rootRef.current` hoặc selection range nằm bên trong root trước khi phát sinh cập nhật state selection cho parent để tránh trigger re-render ngoài ý muốn khi người dùng tương tác với các component khác (như TopBar hoặc Sidebar). Bản phác thảo đã có `readSelectionOffsets` trả về `null` khi selection nằm ngoài root (`manuscriptDomOffsets.ts:394`), khuyến nghị giữ đúng guard này khi cài đặt.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

Đã thực hiện 3 kịch bản đối kháng chuyên sâu nhằm tìm kiếm lỗ hổng trong thiết kế nhưng không phá vỡ được:

1. **Attack Probe 1 (Lệch Offset do Ký Tự Ngắt Dòng `\r\n` hoặc IME Composition)**:
   - _Mục tiêu_: Làm sai lệch mapping giữa DOM offset và chỉ số ký tự trong `chapter.content`, khiến `handleReplaceSelection` (`NovelcrafterStudioApp.tsx:132-142`) cắt ghép nhầm đoạn văn bản khi dán từ clipboard Windows (`\r\n`) hoặc gõ tiếng Việt Telex.
   - _Kết quả_: **KHÔNG THÀNH CÔNG**. Thiết kế áp dụng Invariant I1 (`root.textContent === content`), chặn sự kiện `beforeinput` với `insertFromPaste` để chuẩn hóa toàn bộ xuống `\n` và plain text; sự kiện composition tạm dừng reconcile qua `isComposingRef` cho đến `compositionend`. Kèm theo đó là property test MK-2 với 500 chuỗi ngẫu nhiên (chữ tiếng Việt có dấu, CJK, surrogate pairs) và round-trip test DM-1/DM-2 (`[SRC] docs/plans/2026-10-25-novelcrafter-sudowrite-refactor-and-ui-audit-implementation-plan.md:363,544,622`).

2. **Attack Probe 2 (Khai Thác XSS qua Dữ Liệu Feedback & Entity Codex từ AI)**:
   - _Mục tiêu_: Chèn payload HTML độc hại (`<img src=x onerror=alert(1)>`, selector injection) thông qua thuộc tính trích dẫn (quote) hoặc ID của feedback item do AI trả về vào cây DOM của editor.
   - _Kết quả_: **KHÔNG THÀNH CÔNG**. Hàm `buildLineElement` tuyệt đối không sử dụng `innerHTML` hay `dangerouslySetInnerHTML` mà chỉ dựng node qua `document.createElement`, gán văn bản bằng `textContent` và gán thuộc tính an toàn qua `dataset`. ID của feedback được lọc qua regex nghiêm ngặt `/^[A-Za-z0-9_-]{1,100}$/` (`isSafeDecorationId`) và escape bằng `CSS.escape()`. Xác thực bằng Negative Probes N1 (DM-5), N2 (DC-3) và Wiring Probe W10 (`[SRC] docs/plans/2026-10-25-novelcrafter-sudowrite-refactor-and-ui-audit-implementation-plan.md:311,380,397,627,703`).

3. **Attack Probe 3 (Xung Đột Đóng/Mở Pane Đồ Họa và Bóp Nghẹt Màn Hình 1180–1535px)**:
   - _Mục tiêu_: Ép hệ thống mở đồng thời cả 3 docked panes (navigator, history, feedback) trên màn hình laptop 1366px khiến chiều rộng editor bị nén dưới ngưỡng tối thiểu `minEditorWidthPx: 460`.
   - _Kết quả_: **KHÔNG THÀNH CÔNG**. Module `studioLayout.ts` xác định `maxDockedSidePanes: 1` cho dải 1180–1535px, và hàm chuyển trạng thái `applyDockedPaneToggle` tự động loại bỏ pane cũ nhất khi số pane vượt quá giới hạn. Đảm bảo editor luôn có không gian tối thiểu hiển thị theo đúng quy định responsive. Xác thực bằng Negative Probe N4 và Test Contract LY-9..LY-12 (`[SRC] docs/plans/2026-10-25-novelcrafter-sudowrite-refactor-and-ui-audit-implementation-plan.md:342,386,608,615`).

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục)

| Hạng Mục                                               | Kết Quả  | Loại Bằng Chứng   | Chi Tiết                                                                                                                                                                                              |
| :----------------------------------------------------- | :------- | :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verified Versions                                   | **PASS** | `[SRC]` / `[URL]` | Đối chiếu `package.json:64,69,113`, `node_modules/next/package.json:3`, `node_modules/happy-dom/package.json:3`; tra cứu Baseline 2025 cho `contenteditable="plaintext-only"` (Firefox 136+).         |
| 2. Checklist Tuần Tự (`[NEW]`, `[MODIFY]`, `[DELETE]`) | **PASS** | `[SRC]`           | Đầy đủ 5 Phase A–E, phân tách rõ ràng giữa `lib/` (logic thuần) và `app/` (UI/hook), gắn cờ rõ ràng cho Plan Scope Guard.                                                                             |
| 3. Kế Hoạch Kiểm Thử (Verification Plan)               | **PASS** | `[CMD]` / `[SRC]` | Cú pháp PowerShell 5.1 (dùng dấu `;`), 12 Wiring Probes (W1–W12), 9 Negative Probes (N1–N9) và ma trận QA thủ công 4 viewport.                                                                        |
| 4. Test Contract                                       | **PASS** | `[SRC]`           | Định nghĩa rõ ràng 10 bộ contract (TC-MARKUP, TC-DECOR, TC-CODEX, TC-HISTORY, TC-TYPO, TC-BUBBLE, TC-SCROLL, TC-LAYOUT, TC-DOM, TC-I18N) kèm input, output, failure modes, boundary & property tests. |
| 5. Assumptions & Cross-Task Dependencies               | **PASS** | `[SRC]`           | 20 giả định kỹ thuật A1–A20 có trích dẫn `file:line` chính xác; bảng Blast Radius 3 tầng; 6 quyết định kỹ thuật D1–D6 kèm default assumptions.                                                        |
| 6. Out of Scope                                        | **PASS** | `[SRC]`           | Ranh giới rõ ràng: không thêm thư viện npm, không đổi DB/schema, không đổi contract SSE, không ẩn ký hiệu Markdown kiểu live preview.                                                                 |
| 7. Skills Loaded & Applied                             | **PASS** | `[SRC]`           | Nạp và ánh xạ đầy đủ 4 skill cốt lõi: `add-translation`, `vikini-investigate`, `vikini-audit`, `add-feature`.                                                                                         |

##### Mental Simulation Matrix (S1–S6 + Domain)

| Kịch Bản                      | Trạng Thái | Bằng Chứng        | Chi Tiết Đánh Giá                                                                                                                                                                                                                             |
| :---------------------------- | :--------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**    | **PASS**   | `[CMD]` / `[SRC]` | `npm run type-check` exit 0; `node scripts/verify-docs.mjs` exit 0; không có phụ thuộc hay biến môi trường mới.                                                                                                                               |
| **S2: Lifecycle & Teardown**  | **PASS**   | `[SRC]`           | Quản lý hủy bỏ đầy đủ: `cancelAnimationFrame`, `clearTimeout` (debounce 250ms), gỡ listener `selectionchange` trên unmount; test DOM cách ly độc lập trên Happy DOM.                                                                          |
| **S3: Database & Temporal**   | **N/A**    | `[SRC]`           | Không thay đổi database schema, Supabase table, RPC hay múi giờ lưu trữ (`chapter.content` giữ nguyên kiểu chuỗi Markdown).                                                                                                                   |
| **S4: Cross-Task State Flow** | **PASS**   | `[SRC]`           | Duy trì bất biến Invariant I1 giúp mapping offset trực tiếp tới `NovelcrafterStudioApp.tsx:132-142` (`handleReplaceSelection`) và `feedbackParser.ts:101`.                                                                                    |
| **S5: Security Boundary**     | **PASS**   | `[SRC]`           | Phòng vệ XSS đa tầng: chỉ dùng `createElement`/`textContent`/`dataset`, regex lọc ID an toàn `isSafeDecorationId`, kiểm tra W10 (zero `innerHTML`).                                                                                           |
| **S6: External Resilience**   | **N/A**    | `[SRC]`           | Không thay đổi streaming contract, timeout hay provider LLM ngoài.                                                                                                                                                                            |
| **Domain: Open Inquiry**      | **PASS**   | `[SRC]`           | Thay thế toàn diện các token màu lỗi thời/raw (`purple-500`, `text-secondary/60`, `border-token`) bằng CSS tokens chuẩn; giải quyết 7 key dịch thiếu; thêm test runtime `requiredKeys.test.ts` loại bỏ chuỗi "Sudowrite" hiển thị người dùng. |

#### 5. Adversarial Timelines & Commands Executed

##### 4 Trục Đối Kháng (Adversarial Timelines)

- **Trục 1: Đồng thời (Concurrent Stream & User Typing)**
  - T1: Người dùng đang gõ văn bản trong `ChapterManuscriptEditor`.
  - T2: Direct stream bridge gửi chunk văn bản mới qua prop `chapter.content`.
  - T3: Hệ thống kích hoạt thuộc tính `readOnly={isDirectStreamingToChapter || isLoadLocked}` chuyển `contentEditable` sang `"false"`, vô hiệu hóa nhập liệu đồng thời trong lúc AI đang stream trực tiếp vào chương.
  - Kết cục: **AN TOÀN**.
- **Trục 2: TOCTOU (Chỉnh sửa văn bản trong khoảng thời gian chờ AI xử lý)**
  - T1: Người dùng bôi đen đoạn văn bản tại offset [10, 25] và bấm Rewrite/Quick Edit.
  - T2: Người dùng gõ thêm ký tự trước khi AI phản hồi, làm lệch vị trí offset ban đầu.
  - T3: Khi gợi ý hoàn tất, bộ lọc `findQuoteRangeInText` phát hiện đoạn quote đã bị biến đổi; nếu không khớp, hệ thống không cuộn sai vị trí và thông báo `toast.info(t("novelcrafterQuoteModifiedBadge"))`.
  - Kết cục: **AN TOÀN**.
- **Trục 3: Thất bại giữa chừng & Dọn dẹp (Component unmount khi đang gõ/debounce)**
  - T1: Người dùng đang gõ dở, timer debounce Codex (250ms) và requestAnimationFrame của selection đang chờ thực thi.
  - T2: Người dùng đột ngột đổi chương hoặc chuyển trang sang Chat.
  - T3: Hook cleanup thực hiện `cancelAnimationFrame(rafRef.current)`, `clearTimeout(codexTimerRef.current)` và `document.removeEventListener("selectionchange", ...)`.
  - Kết cục: **AN TOÀN** (không rò rỉ bộ nhớ hay unhandled callback).
- **Trục 4: Môi trường Client / Mobile Storage (Safari Private Mode)**
  - T1: Người dùng mở Novelcrafter trong chế độ Duyệt web riêng tư (Private Browsing) trên iOS Safari và thay đổi cài đặt Typography.
  - T2: Trình duyệt ném ngoại lệ khi ghi `localStorage.setItem`.
  - T3: Hàm ghi trong `useManuscriptTypography` được bọc try/catch an toàn, ghi nhận cảnh báo qua `logger.warn` và giữ state tạm trong bộ nhớ, không làm vỡ giao diện người dùng.
  - Kết cục: **AN TOÀN**.

##### Commands Executed (Nhóm Allowlist Read-Only)

1. `npm run type-check` (Exit code: 0)
2. `npx vitest run src/lib/features/novelcrafter` (Exit code: 0 - 23 test files, 148 tests passed)
3. `node scripts/verify-docs.mjs` (Exit code: 0 - All documentation verification checks passed)

#### 6. Kết Luận

Kế hoạch triển khai đạt toàn bộ tiêu chuẩn Plan Completeness Gate (7/7) và các tiêu chí khắt khe của Giao thức Thẩm định Vikini. Mã nguồn và cấu hình thực tế hoàn toàn tương thích với các giải pháp kỹ thuật đề xuất.

Chính thức phê chuẩn kế hoạch để chuyển sang pha thực thi (Execution Phase).

[PLAN_APPROVED]

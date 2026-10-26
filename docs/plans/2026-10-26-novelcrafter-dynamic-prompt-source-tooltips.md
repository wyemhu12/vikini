# Kế Hoạch Kỹ Thuật: Dynamic Prompt Source Tooltips Cho Novelcrafter Studio

- **Status**: Completed
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-10-26
- **Task**: Ghi chú động (dynamic Prompt Studio tooltips) khi hover/focus vào bất kỳ nút AI text generation nào trong Novelcrafter Studio.

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1 Mục Tiêu (Goal)

- Khi người dùng rê chuột (hover) hoặc di chuyển tiêu điểm bàn phím (focus) vào **bất kỳ nút bấm nào có khả năng kích hoạt AI tạo hoặc sửa văn bản** trong Novelcrafter Studio, hiển thị một ghi chú / tooltip động (`PromptSourceTooltip`) giải thích chi tiết và trực quan:
  1. Tên hành động AI chuẩn hóa (dịch song ngữ Việt/Anh).
  2. Huy hiệu trạng thái Prompt Studio: **Tùy biến** (`Customized`) hoặc **Mặc định** (`Default`), kèm nhãn nếu có chỉ thị riêng (`Custom Directive`).
  3. Danh sách các nút ngữ cảnh `<story_bible>` đang được đưa vào prompt (`synopsis`, `outline`, `characters`, `worldbuilding`, `style`, `genre`, `pov_tense`).
  4. Danh sách các nút ngữ cảnh `<chapter_context>` đang được đưa vào prompt (`story_so_far`, `scenes`, `previous_chapter_continuity`, `preceding_prose`).
  5. Các dữ liệu cố định đặc thù theo hành động (`<braindump>`, `<selected_text>`, `<current_<target>>`, `<key_details>`).
- Tooltip phản ánh **thời gian thực (live)** theo cấu hình người dùng trong **Prompt Studio** (`usePromptStudioStore`), tự động đồng bộ ngay lập tức khi người dùng chỉnh sửa tại `/novelcrafter/prompts` từ tab khác mà không cần tải lại trang.
- Đảm bảo an toàn bố cục: Tooltip hiển thị qua Radix UI Portal, không bị cắt cụt (clipping) bởi các container có `overflow-hidden` hay `overflow-x-auto` trong `StoryBibleSectionCard`, `ChapterAiToolbar`, hay `ChapterSelectionToolbar`.
- Kiểm soát nghiêm ngặt kích thước file: Giữ `ChapterAiToolMenus.tsx` dưới ngưỡng cứng 500 dòng (hiện tại 487 dòng) bằng cách tách menu Brainstorm thành subcomponent `ChapterAiBrainstormMenu.tsx`.

#### 1.2 Out of Scope (Những Gì Chúng Ta KHÔNG Làm)

- **KHÔNG thay đổi logic sinh prompt**: Không sửa logic ghép chuỗi prompt bên trong `promptBuilder.ts`, `featureDirectives.ts`, hoặc `storyBibleDependencies.ts`.
- **KHÔNG thêm action keys mới**: Giữ nguyên danh mục 37 khóa hành động hiện có của Novelcrafter Prompt Studio.
- **KHÔNG gắn tooltip cho các nút không sinh văn bản AI**: Không gắn tooltip cho các nút điều khiển thuần giao diện như nút bật/tắt mục (toggle accordion), nút xem trước typography, nút đóng mở thẻ nhận xét, nút undo/redo, nút ẩn/hiện nhân vật trong Bible.
- **KHÔNG dùng thư viện tooltip bên ngoài**: Tái sử dụng primitive Radix Tooltip đã có sẵn tại `src/components/ui/tooltip.tsx`.
- **KHÔNG lưu cấu hình Prompt Studio lên Supabase**: Tiếp tục duy trì lưu trữ client-side cục bộ qua Zustand `persist` trong `localStorage` theo đúng kiến trúc hiện hành.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

| Tài liệu / Skill                                                            | Mục đích đọc                         | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                           |
| :-------------------------------------------------------------------------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/02-quality.md`                                               | Pre-Work Protocol & Quality Gates    | Xác định quy trình lập plan, ngưỡng chất lượng, cấm hạ chuẩn test, bắt buộc co-located tests.                                                                                |
| `.agents/rules/00-core.md`                                                  | Nguyên tắc bất biến & Tech stack     | TypeScript strict mode, cấm `any`, cấm mutating git, kiến trúc boundaries `src/lib/features/` vs `src/app/features/`.                                                        |
| `.agents/rules/01-coding.md`                                                | Quy chuẩn code, file size limits     | Giới hạn 500 dòng cho UI components (`ChapterAiToolMenus.tsx` 487 dòng ➔ bắt buộc tách `ChapterAiBrainstormMenu.tsx`). Co-located tests cho module `promptSourceSummary.ts`. |
| `.agents/rules/03-ui.md`                                                    | Design tokens, Accessibility, Radix  | Dùng biến CSS Tailwind v4 (`bg-(--surface-elevated)`, `text-(--text-primary)`), Radix Portal chống tràn viền overflow, `focus-visible:ring-2`.                               |
| `.agents/rules/04-bilingual.md` & `.agents/skills/add-translation/SKILL.md` | Quy chuẩn dịch song ngữ              | Mọi nhãn tooltip (tên nhóm nguồn, cố định, badge) đều có khóa dịch trong `vi.ts` và `en.ts`, kiểm thử parity qua `index.test.ts`.                                            |
| `.agents/skills/vikini-investigate/SKILL.md`                                | Phân tích blast-radius               | Khảo sát toàn bộ 6 vị trí nút bấm AI text generation trong Novelcrafter Studio để bao phủ 100% không sót.                                                                    |
| `.agents/agents/reviewer/evidence-bar.md` & `mental-simulation.md`          | Bằng chứng kiểm thử & mô phỏng S1–S6 | Thiết lập Test Contract với concrete test IDs, Negative Probes, và Adversarial Timeline cho cơ chế rehydrate đa tab.                                                         |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Hydration Lifecycle của `promptStudioStore`**:
   - `[SRC]` `src/lib/features/novelcrafter/promptStudioStore.ts:130`: Store được cấu hình `skipHydration: true` để tránh SSR hydration mismatch.
   - Do đó, component `PromptSourceTooltip` hoặc hook tiêu thụ phải gọi `ensurePromptStudioHydrated()` trên `useEffect` mount và gắn listener vào `window.addEventListener("focus", ...)` và `window.addEventListener("storage", ...)` để lập tức cập nhật khi người dùng vừa chỉnh sửa cấu hình ở tab `/novelcrafter/prompts`.
2. **Phân nhóm Canonical Context Nodes**:
   - `[SRC]` `src/lib/features/novelcrafter/contextNodes.ts:4-16`: Danh sách 11 nodes canonical:
     - **Story Bible Nodes** (7 nodes): `["synopsis", "outline", "characters", "worldbuilding", "style", "genre", "pov_tense"]`.
     - **Chapter Context Nodes** (4 nodes): `["story_so_far", "scenes", "previous_chapter_continuity", "preceding_prose"]`.
3. **Các nguồn dữ liệu cố định (Action Fixed Inputs)**:
   - `[SRC]` `src/lib/features/novelcrafter/storyBibleDependencies.ts:70,90` & `promptBuilder.test.ts:142`: `bible:synopsis` khi `actionMode !== "rewrite"` luôn nạp `<braindump>`.
   - `[SRC]` `src/lib/features/novelcrafter/featureDirectives.ts:130-134`: Các mục `bible:<target>` khi `actionMode === "rewrite"` luôn nạp `<current_<target>>`.
   - `[SRC]` `src/lib/features/novelcrafter/promptBuilder.ts:322-327`: Các hành động `rewrite:*`, `expand:*`, và `feedback:*` nạp `<selected_text>` khi có lựa chọn đoạn văn.
   - `[SRC]` `src/lib/features/novelcrafter/promptBuilder.ts:273-275`: `write:guided` nạp `<key_details>`.
4. **Ngưỡng dòng file UI `ChapterAiToolMenus.tsx`**:
   - `[SRC]` `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx:487`: File hiện dài 487 dòng (Hard Max là 500 dòng). Nếu chèn trực tiếp 10 nút tooltip của Brainstorm vào file này sẽ vi phạm quy tắc. Do đó, tách bảng Brainstorm thành `ChapterAiBrainstormMenu.tsx` (~60 dòng) giúp giảm file gốc xuống ~430 dòng.

---

### 4. Bảng Verified Versions

| Thư viện / Công nghệ      | Phiên bản thực tế (`package.json`)       | Trạng thái & Link xác minh                               |
| :------------------------ | :--------------------------------------- | :------------------------------------------------------- |
| `next`                    | `^16.4.0` (`[SRC]` `package.json:64`)    | Next.js 16 App Router, React 19 Server/Client Components |
| `react` / `react-dom`     | `^19.2.3` (`[SRC]` `package.json:69-70`) | React 19 stable                                          |
| `@radix-ui/react-tooltip` | `^1.2.8` (`[SRC]` `package.json:51`)     | Radix UI Tooltip Primitive với Portal rendering          |
| `zustand`                 | `^5.0.9` (`[SRC]` `package.json:81`)     | Zustand v5 client store với persist middleware           |
| `lucide-react`            | `^0.562.0` (`[SRC]` `package.json:62`)   | Icon set chính thức của dự án                            |
| `vitest`                  | `^4.1.12` (`[SRC]` `package.json:97`)    | Test runner cho unit và component tests (`happy-dom`)    |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Tạo mới (`[NEW]`)

1. `[NEW]` `src/lib/features/novelcrafter/promptSourceSummary.ts`
   - Chứa pure function `resolvePromptSourceSummary(actionKey, settings, options)` tính toán danh sách ngữ cảnh `<story_bible>`, `<chapter_context>`, các nguồn cố định `<braindump>`, `<selected_text>`, v.v., và cờ `isCustomized`.
2. `[NEW]` `src/lib/features/novelcrafter/promptSourceSummary.test.ts`
   - Co-located unit test cho `promptSourceSummary.ts` phủ đầy đủ 37 actions, override states, fallback inputs, và Negative Probes.
3. `[NEW]` `src/app/features/novelcrafter/components/PromptSourceTooltip.tsx`
   - Component bọc nút bấm AI, hiển thị Radix Portal Tooltip dạng popover card gồm: tiêu đề action, badge Customized/Default, pills cho Story Bible, Chapter Context và Fixed Inputs.
4. `[NEW]` `src/app/features/novelcrafter/components/PromptSourceTooltip.test.tsx`
   - Co-located component test cho `PromptSourceTooltip.tsx` kiểm thử render trigger, hiển thị nội dung hover, đồng bộ store, và hành vi disabled.
5. `[NEW]` `src/app/features/novelcrafter/components/ChapterAiBrainstormMenu.tsx`
   - Trích xuất bảng Brainstorm 10 danh mục từ `ChapterAiToolMenus.tsx` kèm bọc `PromptSourceTooltip` cho từng danh mục để giảm tải số dòng cho `ChapterAiToolMenus.tsx`.

#### Chỉnh sửa (`[MODIFY]`)

6. `[MODIFY]` `src/lib/utils/translations/vi.ts`
   - Bổ sung các khóa dịch cho Tooltip (`novelcrafterTooltipSourcesTitle`, `novelcrafterTooltipStoryBible`, `novelcrafterTooltipChapterContext`, `novelcrafterTooltipFixedInputs`, `novelcrafterTooltipFixedBraindump`, `novelcrafterTooltipFixedSelectedText`, `novelcrafterTooltipFixedCurrentSection`, `novelcrafterTooltipFixedKeyDetails`, `novelcrafterTooltipCustomDirectiveBadge`, `novelcrafterTooltipPromptStudioHint`).
7. `[MODIFY]` `src/lib/utils/translations/en.ts`
   - Bổ sung các khóa dịch tiếng Anh tương ứng với `vi.ts` (đảm bảo parity 100%).
8. `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx`
   - Bọc `PromptSourceTooltip` quanh nút `Generate` (`bible:${aiTarget}`, mode: generate) và nút `Run Action` trong drawer Rewrite (`bible:${aiTarget}`, mode: rewrite).
9. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiToolbar.tsx`
   - Bọc `PromptSourceTooltip` quanh nút `First Draft` (`bible:draft`) và nút bấm nhanh `Write` (`write:auto`).
10. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx`
    - Nhập `ChapterAiBrainstormMenu`, thay thế phần render Brainstorm, và bọc `PromptSourceTooltip` cho các nút: `Auto Write` (`write:auto`), `Guided Write` (`write:guided`), các nút `Tone Shift` (`write:tone_shift`), 6 nút `Rewrite Preset` (`rewrite:${mode}`), nút `Custom Rewrite` (`rewrite:custom`), các nút `Feedback Mode` và nút chạy Feedback (`feedback:${mode}`), `Expand Passage` (`expand:expand`) và `Describe Sensory` (`expand:describe`).
11. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx`
    - Bọc `PromptSourceTooltip` quanh nút `Summarize Chapter` (`bible:chapter_summary`), nút `Generate Beats` (`bible:scenes`, generate), nút `Rewrite Beats` (`bible:scenes`, rewrite), và nút `Generate Draft` (`bible:draft`).
12. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`
    - Bọc `PromptSourceTooltip` quanh 3 nút card khởi đầu: `Auto Write Opening` (`write:auto`), `Suggest 3 Openings` (`write:openings_3`), `Rough Draft from Beats` (`write:first_draft_rough`).
13. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterSelectionToolbar.tsx`
    - Bọc `PromptSourceTooltip` quanh các mục trong menu `Rewrite` dropdown (`rewrite:${mode}`), nút `Describe` (`expand:describe`), nút `Expand` (`expand:expand`), nút `Feedback` (`feedback:line_editing`), và nút submit `Quick Edit` (`rewrite:custom`).
14. `[MODIFY]` `docs/features.md`
    - Bổ sung tài liệu đặc tả tính năng Dynamic Prompt Source Tooltips trong Novelcrafter Studio.
15. `[MODIFY]` `docs/CHANGELOG.md`
    - Ghi nhận nhật ký cập nhật tính năng.

#### Xóa (`[DELETE]`)

- Không có file nào bị xóa.

---

### 6. Caller-First Design Sketch

#### 6.1 Interface `promptSourceSummary.ts`

```typescript
import type { NovelcrafterContextNode } from "./contextNodes";
import type { NovelcrafterPromptActionKey } from "./promptActions";
import type { PromptStudioSettings } from "./promptStudioSettings";
import type { NovelcrafterActionMode, NovelcrafterBibleTarget } from "./types";

export type PromptFixedInputKind =
  | "braindump"
  | "current_section"
  | "selected_text"
  | "guided_notes";

export interface PromptSourceSummary {
  actionKey: NovelcrafterPromptActionKey;
  actionMode?: NovelcrafterActionMode;
  storyBibleNodes: NovelcrafterContextNode[];
  chapterContextNodes: NovelcrafterContextNode[];
  fixedInputs: PromptFixedInputKind[];
  isCustomized: boolean;
  hasCustomDirective: boolean;
  hasCustomContextNodes: boolean;
  effectiveNodes: NovelcrafterContextNode[];
}

export interface ResolvePromptSourceSummaryOptions {
  actionMode?: NovelcrafterActionMode;
  bibleTarget?: NovelcrafterBibleTarget;
}

export function resolvePromptSourceSummary(
  actionKey: NovelcrafterPromptActionKey,
  settings: PromptStudioSettings,
  options?: ResolvePromptSourceSummaryOptions
): PromptSourceSummary;
```

#### 6.2 Component `PromptSourceTooltip.tsx`

```tsx
export interface PromptSourceTooltipProps {
  actionKey: NovelcrafterPromptActionKey;
  actionMode?: NovelcrafterActionMode;
  bibleTarget?: NovelcrafterBibleTarget;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

/**
 * Caller usage example:
 *
 * <PromptSourceTooltip actionKey="write:auto" side="top">
 *   <button type="button" onClick={onRunAutoWrite}>
 *     Auto Write
 *   </button>
 * </PromptSourceTooltip>
 */
export function PromptSourceTooltip({
  actionKey,
  actionMode,
  bibleTarget,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: PromptSourceTooltipProps) {
  // 1. Rehydrate on mount & window focus/storage
  // 2. Subscribe to usePromptStudioStore((s) => s.settings)
  // 3. Compute resolvePromptSourceSummary(...)
  // 4. Render Radix Tooltip Primitive with Portal + Vikini theme tokens
}
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [x] **Bước 1: Bổ sung Translation Keys Song Ngữ (`vi.ts`, `en.ts`)**
  - Thêm 10 khóa dịch mới: `novelcrafterTooltipSourcesTitle`, `novelcrafterTooltipStoryBible`, `novelcrafterTooltipChapterContext`, `novelcrafterTooltipFixedInputs`, `novelcrafterTooltipFixedBraindump`, `novelcrafterTooltipFixedSelectedText`, `novelcrafterTooltipFixedCurrentSection`, `novelcrafterTooltipFixedKeyDetails`, `novelcrafterTooltipCustomDirectiveBadge`, `novelcrafterTooltipPromptStudioHint`.
  - Chạy kiểm tra tính khớp song ngữ qua `npm run type-check`.

- [x] **Bước 2: Xây dựng Module Logic `promptSourceSummary.ts` & Co-located Test**
  - Tạo `src/lib/features/novelcrafter/promptSourceSummary.ts`.
  - Phân tách 11 `NOVELCRAFTER_CONTEXT_NODES` thành Story Bible (7 nodes) và Chapter Context (4 nodes).
  - Tích hợp `resolveEffectiveContextNodes` và nhận diện các nguồn cố định (`braindump`, `current_section`, `selected_text`, `guided_notes`).
  - Viết `src/lib/features/novelcrafter/promptSourceSummary.test.ts` kiểm thử toàn diện các trường hợp mặc định và tùy chỉnh.

- [x] **Bước 3: Xây dựng UI Component `PromptSourceTooltip.tsx` & Co-located Test**
  - Tạo `src/app/features/novelcrafter/components/PromptSourceTooltip.tsx`.
  - Sử dụng `@radix-ui/react-tooltip` với `<TooltipPrimitive.Portal>` để không bị che khuất bởi các container overflow.
  - Bổ sung lifecycle hydration và window listener (`focus`, `storage`) với cleanup đầy đủ.
  - Thiết kế UI dạng thẻ popover sắc nét, sử dụng design tokens (`bg-(--surface-elevated)`, `border-(--border)`, `text-(--text-primary)`, `text-(--accent)`).
  - Viết `src/app/features/novelcrafter/components/PromptSourceTooltip.test.tsx` kiểm thử hiển thị hover, click passthrough, và store sync.

- [x] **Bước 4: Tách `ChapterAiBrainstormMenu.tsx` để bảo toàn Giới Hạn Dòng**
  - Tạo `src/app/features/novelcrafter/components/ChapterAiBrainstormMenu.tsx` (~60 dòng).
  - Bọc `PromptSourceTooltip` cho 10 nút danh mục Brainstorm.
  - Giảm kích thước `ChapterAiToolMenus.tsx` từ 487 dòng xuống ~430 dòng.

- [x] **Bước 5: Tích hợp `PromptSourceTooltip` vào 6 Vị Trí Nút AI Trong Studio**
  - Tích hợp vào `StoryBibleSectionCard.tsx` (Generate, Rewrite).
  - Tích hợp vào `ChapterAiToolbar.tsx` (First Draft, Quick Write).
  - Tích hợp vào `ChapterAiToolMenus.tsx` (Write, Rewrite, Feedback, Expand).
  - Tích hợp vào `ChapterDraftBeatsCard.tsx` (Summarize Chapter, Generate Beats, Rewrite Beats, Generate Draft).
  - Tích hợp vào `ChapterEmptyStateActions.tsx` (Auto Write, 3 Openings, Rough Draft).
  - Tích hợp vào `ChapterSelectionToolbar.tsx` (Rewrite presets, Describe, Expand, Feedback, Quick Edit).

- [x] **Bước 6: Cập nhật Living Documentation**
  - Cập nhật `docs/features.md` bổ sung tài liệu tính năng.
  - Cập nhật `docs/CHANGELOG.md` ghi nhận phiên bản.

- [x] **Bước 7: Kiểm Thử Toàn Diện (Tier 2 Verification)**
  - Chạy `npm run type-check; npm run lint; npm run test:run`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

#### 8.1 Unit Test Cases (`promptSourceSummary.test.ts`)

| Test ID     | Đầu vào (Input)                                                                                          | Hành vi mong đợi (Expected Output)                                                                                                                                                                        | Failure Mode / Boundary Condition                              |
| :---------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| `TC-PSS-01` | `actionKey: "bible:synopsis"`, `actionMode: "generate"`, default settings                                | `storyBibleNodes: ["genre"]`, `chapterContextNodes: []`, `fixedInputs: ["braindump"]`, `isCustomized: false`                                                                                              | Thiếu `braindump` hoặc sót node `genre`.                       |
| `TC-PSS-02` | `actionKey: "bible:synopsis"`, `actionMode: "rewrite"`, default settings                                 | `storyBibleNodes: ["genre"]`, `chapterContextNodes: []`, `fixedInputs: ["current_section"]`, `isCustomized: false`                                                                                        | Sót `current_section` khi ở chế độ rewrite.                    |
| `TC-PSS-03` | `actionKey: "bible:characters"`, `actionMode: "rewrite"`                                                 | `fixedInputs: ["current_section"]`, `storyBibleNodes: ["synopsis"]`                                                                                                                                       | Không nhận diện được `current_section` cho Bible card targets. |
| `TC-PSS-04` | `actionKey: "write:auto"`, default settings                                                              | `storyBibleNodes: ["characters", "worldbuilding", "style", "genre", "pov_tense"]`, `chapterContextNodes: ["story_so_far", "scenes", "previous_chapter_continuity", "preceding_prose"]`, `fixedInputs: []` | Thiếu bất kỳ node nào trong 9 write base nodes.                |
| `TC-PSS-05` | `actionKey: "write:guided"`, default settings                                                            | `fixedInputs: ["guided_notes"]`, cùng context nodes như `write:auto`                                                                                                                                      | Không gắn nhãn `<key_details>` cho guided mode.                |
| `TC-PSS-06` | `actionKey: "rewrite:rephrase"`, default settings                                                        | `storyBibleNodes: ["style", "genre", "pov_tense"]`, `chapterContextNodes: ["preceding_prose"]`, `fixedInputs: ["selected_text"]`                                                                          | Thiếu `selected_text` trong fixed inputs.                      |
| `TC-PSS-07` | `actionKey: "write:auto"`, settings có `overrides["write:auto"] = { contextNodes: ["style", "scenes"] }` | `storyBibleNodes: ["style"]`, `chapterContextNodes: ["scenes", "preceding_prose"]` (do `preceding_prose` là required), `isCustomized: true`, `hasCustomContextNodes: true`                                | Không tự động bù required node `preceding_prose`.              |
| `TC-PSS-08` | `actionKey: "write:auto"`, settings chỉ có `directive: "Custom direction"`                               | `isCustomized: true`, `hasCustomDirective: true`, `hasCustomContextNodes: false`, giữ nguyên default nodes                                                                                                | Đánh dấu sai cờ tùy biến chỉ thị / nodes.                      |
| `TC-PSS-09` | **Negative Probe**: settings rỗng, `null`, hoặc actionKey không hợp lệ                                   | Trả về fallback an toàn: `isCustomized: false`, không throw error crash ứng dụng                                                                                                                          | Gây runtime exception làm đơ UI button.                        |

#### 8.2 Component Test Cases (`PromptSourceTooltip.test.tsx`)

| Test ID     | Đầu vào (Input)                                         | Hành vi mong đợi (Expected Output)                                                          | Failure Mode / Boundary Condition                                  |
| :---------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| `TC-PST-01` | Renders `<button onClick={fn}>Click</button>` bên trong | Click vào button vẫn gọi `fn` 100%, không bị tooltip chặn event                             | Event bubbling / click bị nuốt bởi wrapper.                        |
| `TC-PST-02` | Hover hoặc keyboard focus vào button                    | Tooltip mở ra, hiển thị tiêu đề action, nhóm Story Bible và Chapter Context                 | Tooltip không mở khi hover hoặc mất focus ring.                    |
| `TC-PST-03` | Store cập nhật `overrides["write:auto"]` khi đang mở    | Tooltip lập tức hiển thị huy hiệu `Customized` và danh sách node mới                        | Không cập nhật live mà phải unmount/remount.                       |
| `TC-PST-04` | `disabled={true}` trên `PromptSourceTooltip`            | Tooltip không mở ra khi hover/focus                                                         | Hiện tooltip rác khi nút đang trong trạng thái disabled/streaming. |
| `TC-PST-05` | Mount component trong DOM                               | Đăng ký listener `window.addEventListener("focus")` và `storage`; unmount thì gỡ bỏ sạch sẽ | Memory leak khi unmount.                                           |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Test Files Co-Located

- `src/lib/features/novelcrafter/promptSourceSummary.test.ts` (đặt cạnh `promptSourceSummary.ts`).
- `src/app/features/novelcrafter/components/PromptSourceTooltip.test.tsx` (đặt cạnh `PromptSourceTooltip.tsx`).

#### 9.2 Wiring Probes & Negative Probes

- **Wiring Probe 1 (Radix Portal DOM Attachment)**: Kiểm tra trong test component rằng nội dung `<TooltipContent>` được render ra phần tử con của `document.body` (hoặc Portal container) thay vì nằm trong cây DOM cục bộ của button, chứng minh không bao giờ bị cắt viền bởi `overflow-hidden` container.
- **Wiring Probe 2 (Bilingual Key Parity)**: Kiểm tra thông qua `src/lib/utils/translations/index.test.ts` rằng 100% các khóa dịch mới xuất hiện đồng thời trong cả `vi.ts` và `en.ts`.
- **Negative Probe 1 (Corrupted Storage Recovery)**: Khi `localStorage.getItem("vikini:novelcrafter:prompt-studio")` trả về chuỗi JSON hỏng, hàm `ensurePromptStudioHydrated()` bắt lỗi an toàn (`safeLocalStorage`), tooltip vẫn render với factory defaults mà không làm crash React tree.
- **Negative Probe 2 (Disabled Tooltip Guard)**: Khi prop `disabled` được bật, kiểm tra `fireEvent.mouseEnter` không tạo ra bất kỳ DOM element nào mang `role="tooltip"`.

#### 9.3 Lệnh Chạy Kiểm Thử (PowerShell 5.1 Syntax)

```powershell
npm run type-check; npm run lint; npm run test:run
```

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| STT | Rủi Ro (Mức Độ)                                     | Nguyên Nhân Kỹ Thuật                                                                                                                                                                        | Technical Control & Phương Án Phòng Ngừa                                                                                                                           | Dẫn Chứng / Kiểm Chứng                                                                      |
| :-- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| 1   | **Clipping do CSS Overflow** (Trung bình)           | Các thanh công cụ `ChapterAiToolbar`, `ChapterSelectionToolbar` và card `StoryBibleSectionCard` đều có `overflow-hidden` hoặc `overflow-x-auto`. Tooltip inline thông thường sẽ bị cắt đứt. | Sử dụng Radix UI Tooltip Primitive với Portal (`<TooltipPrimitive.Portal>`) gắn thẳng vào `document.body`, kết hợp `z-(--z-popover)`.                              | `[SRC]` `src/components/ui/tooltip.tsx:22` & Wiring Probe 1.                                |
| 2   | **Vượt Ngưỡng 500 Dòng File UI** (Cao)              | `ChapterAiToolMenus.tsx` hiện có 487 dòng (`[SRC]` `ChapterAiToolMenus.tsx:487`). Thêm code tooltip cho 10 nút Brainstorm sẽ vượt 500 dòng (Hard Max).                                      | Tách toàn bộ menu Brainstorm thành `ChapterAiBrainstormMenu.tsx` (~60 dòng). Giảm file gốc xuống ~430 dòng, đảm bảo an toàn tuyệt đối.                             | `[SRC]` `.agents/rules/01-coding.md:101` & File breakdown tại Mục 5.                        |
| 3   | **Lệch Đồng Bộ Đa Tab** (Trung bình)                | Người dùng mở `/novelcrafter/prompts` ở Tab A, thay đổi prompt nodes, rồi chuyển sang Tab B đang viết truyện. Do Zustand dùng `skipHydration: true`, Tab B có thể giữ cache cũ.             | Gắn listener `window.addEventListener("focus")` và `"storage"` để tự động kích hoạt `ensurePromptStudioHydrated()` khi tab được focus lại hoặc storage đổi.        | `[SRC]` `src/lib/features/novelcrafter/promptStudioStore.ts:147` & Adversarial Timeline S4. |
| 4   | **Xung Đột Sự Kiện Click & Focus Nút** (Trung bình) | Tooltip wrapper có thể vô tình nuốt sự kiện `onClick` hoặc làm hỏng thuộc tính phím tắt `ArrowRight`/`ArrowLeft` trong `ChapterSelectionToolbar`.                                           | Dùng `asChild` của Radix Tooltip Trigger trên thẻ `<button>` gốc để truyền thẳng ref và event handlers xuống button mà không chèn thêm thẻ `<div>` bọc trung gian. | `[SRC]` `@radix-ui/react-tooltip` API spec & `TC-PST-01`.                                   |

---

### Mô Phỏng Tư Duy Kỹ Sư (Mental Simulation S1–S6)

- **S1: Cold-start & Build**:
  - Không thêm thư viện ngoại lai mới (`@radix-ui/react-tooltip` và `lucide-react` đã có sẵn trong `package.json`).
  - Toàn bộ component và file helper đều dùng TypeScript strict mode, 100% không dùng `any`.
  - Kiểm tra parity bản dịch giữa `vi.ts` và `en.ts` đảm bảo không gây lỗi biên dịch.
- **S2: Runner Lifecycle & Teardown**:
  - `PromptSourceTooltip` lắng nghe sự kiện `focus` và `storage` trên `window`. `useEffect` trả về hàm dọn dẹp `window.removeEventListener("focus", ...)` và `window.removeEventListener("storage", ...)`. Không gây rò rỉ bộ nhớ (leak listener).
- **S3: Database & Temporal Logic**:
  - Tính năng hoàn toàn là client-side metadata tooltip dựa trên Zustand store. Không can thiệp DB Supabase, không tạo bảng hay migration.
- **S4: Cross-Task State Flow & Adversarial Timeline**:
  ```
  Cơ chế: Đa tab đồng bộ cấu hình Prompt Studio cho Tooltip
  T1: Người dùng mở Tab A (/novelcrafter/prompts) và Tab B (/novelcrafter studio).
  T2: Tại Tab A, người dùng tắt node "worldbuilding" cho action "write:auto", Zustand lưu vào localStorage 'vikini:novelcrafter:prompt-studio'.
  T3: Người dùng bấm chuột chuyển sang Tab B. Window event 'focus' kích hoạt -> PromptSourceTooltip gọi ensurePromptStudioHydrated() -> rehydrate() đọc localStorage mới nhất -> selector usePromptStudioStore((s) => s.settings) trả về settings mới.
  Kết cục: Khi người dùng hover vào nút Auto Write ở Tab B, tooltip lập tức hiển thị không có node worldbuilding -> AN TOÀN.
  ```
- **S5: Security Boundary & 3-Tier Auth**:
  - Không truyền tải hay gửi dữ liệu người dùng ra ngoài.
  - Nội dung hiển thị trong tooltip chỉ bao gồm các nhãn hệ thống đã được localize, không render HTML thô từ người dùng (không dùng `dangerouslySetInnerHTML`).
- **S6: External Resilience & Performance**:
  - Hàm `resolvePromptSourceSummary` là pure function đồng bộ O(1), chỉ thao tác trên Set gồm tối đa 11 context nodes và 1 object override. Không gây lag hoặc tụt FPS khi rê chuột nhanh qua các nút trên toolbar.

---

## Audit History

_(Phần dành riêng cho Lead Reviewer ghi nhận kết quả thẩm định)_

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ (Previous Audit Run Verification)

_Đây là Audit Run đầu tiên. Chưa có mã lỗi từ Run trước._

#### 2. Phát Hiện Mới (New Findings)

- `[MINOR]` **REF-01: Làm rõ cấu trúc Portal cho `PromptSourceTooltip`**:
  - _Mô tả_: Tại Mục 10 (STT 1), bảng rủi ro dẫn chiếu `[SRC] src/components/ui/tooltip.tsx:22` làm căn cứ kỹ thuật cho Radix Portal. Tuy nhiên, khảo sát thực tế tại `src/components/ui/tooltip.tsx:18-27` cho thấy `TooltipContent` dựng trực tiếp `<TooltipPrimitive.Content>` mà không bọc `<TooltipPrimitive.Portal>`.
  - _Giải pháp_: Trong quá trình triển khai `PromptSourceTooltip.tsx`, cần import trực tiếp `* as TooltipPrimitive from "@radix-ui/react-tooltip"` và bọc thẻ `<TooltipPrimitive.Portal>` bao ngoài `<TooltipPrimitive.Content>` (như đã định hướng đúng tại Mục 7 Bước 3 line 213) để đảm bảo không bị cắt viền (clipping) bởi các container `overflow-x-auto` trong `ChapterAiToolbar`.

#### 3. Các Tấn Công Đã Thử (Adversarial Attack Probes)

1. **Probe 1 — Tràn viền (Clipping) trong thanh công cụ cuộn ngang `ChapterAiToolbar`**:
   - Thử nghiệm: Kiểm tra xem tooltip có bị cắt cụt khi rê chuột vào các nút trong container `overflow-x-auto min-w-0` (`ChapterAiToolbar.tsx:235`).
   - Kết quả: Khi `PromptSourceTooltip` sử dụng `<TooltipPrimitive.Portal>`, nội dung tooltip được gắn trực tiếp vào `document.body` với `z-(--z-popover)`, hoàn toàn thoát khỏi ngữ cảnh stacking và clipping của thanh công cụ cha (`[SRC]` `src/app/features/novelcrafter/components/ChapterAiToolbar.tsx:235` & `TC-PST-01`).
2. **Probe 2 — Xung đột sự kiện và focus khi lồng vào `DropdownMenuItem` trong `ChapterSelectionToolbar`**:
   - Thử nghiệm: Thử làm hỏng sự kiện click hoặc điều hướng phím mũi tên (`ArrowLeft`/`ArrowRight`) khi bọc tooltip quanh các item Rewrite trong menu lựa chọn.
   - Kết quả: Nhờ sử dụng `asChild` của Radix Tooltip Trigger, event listener và ref được chuyển giao trực tiếp cho trigger/item. Thuộc tính phím tắt và click dispatch hoạt động bình thường, và khi item kích hoạt đóng dropdown, tooltip unmount an toàn (`[SRC]` `src/app/features/novelcrafter/components/ChapterSelectionToolbar.tsx:54-65` & `TC-PST-01`).
3. **Probe 3 — Nguy cơ lệch dữ liệu giữa Tooltip và AI Runner khi có Required Context Nodes**:
   - Thử nghiệm: Cố tình cấu hình `overrides["write:auto"] = { contextNodes: ["style"] }` (loại bỏ `preceding_prose`). Nếu helper tooltip chỉ đọc override thô, tooltip sẽ hiển thị thiếu `preceding_prose`, làm sai lệch thông tin so với những gì LLM thực sự nhận được.
   - Kết quả: Kế hoạch quy định `resolvePromptSourceSummary` bắt buộc thông qua `resolveEffectiveContextNodes(actionKey, override?.contextNodes)`. Hàm này tại `promptActions.ts:241-242` tự động bù đắp các required nodes (`preceding_prose` cho write/feedback, `scenes` cho chapter summary), đảm bảo tooltip phản ánh trung thực ngữ cảnh gửi đến AI (`[SRC]` `src/lib/features/novelcrafter/promptActions.ts:241` & `TC-PSS-07`).
4. **Probe 4 — Ngăn chặn hiện Tooltip rác khi đang stream AI**:
   - Thử nghiệm: Rê chuột qua toolbar trong lúc LLM đang stream dở dang.
   - Kết quả: Kế hoạch tích hợp prop `disabled={isStreaming}` vào `PromptSourceTooltipProps` kèm test case `TC-PST-04` và Negative Probe 2, chặn hoàn toàn việc mở tooltip khi nút ở trạng thái streaming/disabled.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục)

| Hạng mục                              | Trạng thái | Loại bằng chứng   | Chi tiết đối soát                                                                                                       |
| :------------------------------------ | :--------- | :---------------- | :---------------------------------------------------------------------------------------------------------------------- |
| 1. Verified Versions (2026)           | **PASS**   | `[SRC]` / `[URL]` | `package.json:51,62,64,69,81,97`: next 16.4, react 19.2, radix-tooltip 1.2.8, zustand 5.0.9, vitest 4.1.12.             |
| 2. Checklist tuần tự ([NEW]/[MODIFY]) | **PASS**   | `[SRC]`           | 5 files `[NEW]`, 10 files `[MODIFY]`, 0 file `[DELETE]`. Các bước 1–7 rõ ràng.                                          |
| 3. Kế hoạch kiểm thử & Probes         | **PASS**   | `[SRC]` / `[CMD]` | 2 file co-located test, 2 Wiring Probes, 2 Negative Probes, lệnh PowerShell 5.1 hợp lệ.                                 |
| 4. Test Contract                      | **PASS**   | `[SRC]`           | 9 Unit Test cases (`TC-PSS-01..09`), 5 Component Test cases (`TC-PST-01..05`) đủ boundary & failure modes.              |
| 5. Assumptions & Dependencies         | **PASS**   | `[SRC]`           | Khảo sát hydration lifecycle (`skipHydration`), 11 context nodes, 37 action keys, giới hạn file UI 500 dòng.            |
| 6. Out of Scope                       | **PASS**   | `[SRC]`           | Khai báo 5 ranh giới rõ ràng: không đổi logic sinh prompt, không thêm action key, không lưu DB.                         |
| 7. Skills Loaded & Applied            | **PASS**   | `[SRC]`           | Ánh xạ đầy đủ `00-core.md`, `01-coding.md`, `02-quality.md`, `03-ui.md`, `04-bilingual.md`, `add-translation/SKILL.md`. |

##### Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                                  | Trạng thái | Loại bằng chứng   | Chi tiết kiểm chứng                                                                                                                    |
| :---------------------------------------- | :--------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                | **PASS**   | `[CMD]` / `[SRC]` | `npm run type-check` exit code 0. Không phụ thuộc thư viện lạ, không cần thêm biến môi trường.                                         |
| **S2: Runner Lifecycle & Teardown**       | **PASS**   | `[SRC]`           | Đăng ký và dọn dẹp `removeEventListener` cho `focus` và `storage` trên `window` trong `useEffect` (`TC-PST-05`).                       |
| **S3: Database & Temporal Logic**         | **PASS**   | `[SRC]`           | Client-only feature, hoàn toàn không thao tác Supabase DB, RLS hay RPC.                                                                |
| **S4: Cross-Task State Flow**             | **PASS**   | `[SRC]` / `[ADV]` | Đồng bộ đa tab với Zustand qua `ensurePromptStudioHydrated()` và event listener `focus`/`storage` (`promptStudioStore.ts:147`).        |
| **S5: Security Boundary & 3-Tier Auth**   | **PASS**   | `[SRC]`           | Không có API route mới, không inject unescaped HTML, chỉ render token ngữ cảnh tĩnh đã localize.                                       |
| **S6: External Resilience & Performance** | **PASS**   | `[SRC]`           | Hàm tính toán O(1) thuần túy, render portal lazy, không gây giật lag trên thanh công cụ.                                               |
| **Domain: Novelcrafter Studio UI**        | **PASS**   | `[SRC]` / `[CMD]` | Bao phủ đủ 37 action keys, xử lý trần 500 dòng của `ChapterAiToolMenus.tsx` (487 dòng) qua subcomponent `ChapterAiBrainstormMenu.tsx`. |

#### 5. Adversarial Timelines & Commands Executed

##### 4-Axis Adversarial Timelines

1. **Trục Đồng thời (Concurrency - Đa tab)**:
   - _Cơ chế_: Zustand rehydration qua `ensurePromptStudioHydrated()`
   - _T1_: Tab A mở `/novelcrafter/prompts`, chỉnh sửa override cho `write:auto`.
   - _T2_: Tab B đang mở màn hình soạn thảo Novelcrafter Studio.
   - _T3_: Người dùng focus Tab B -> window `focus`/`storage` event kích hoạt -> gọi `ensurePromptStudioHydrated()` -> store nạp state mới -> tooltip hiển thị dữ liệu cập nhật -> **AN TOÀN**.
2. **Trục Khoảng trống check→use (TOCTOU)**:
   - _Cơ chế_: Đọc cấu hình nguồn ngữ cảnh thời gian thực
   - _T1_: Người dùng hover vào nút "Auto Write" xem tooltip ngữ cảnh.
   - _T2_: Người dùng bấm nút kích hoạt sinh văn bản.
   - _T3_: Runner stream gọi `ensurePromptStudioHydrated()` và `resolveEffectiveContextNodes` với cùng một bộ quy tắc. Không có sự trôi lệch dữ liệu giữa tooltip hiển thị và payload gửi tới AI -> **AN TOÀN**.
3. **Trục Thất bại giữa chừng & Dọn dẹp (Teardown & Failure)**:
   - _Cơ chế_: Error recovery & Event cleanup
   - _T1_: Dữ liệu `localStorage` bị hỏng cấu trúc JSON.
   - _T2_: `ensurePromptStudioHydrated()` bắt lỗi qua `safeLocalStorage` / `try...catch`, không ném uncaught exception.
   - _T3_: Tooltip tự động fallback về default context nodes; khi unmount component, toàn bộ listener `focus`/`storage` được gỡ bỏ sạch sẽ -> **AN TOÀN**.
4. **Trục Môi trường Serverless**:
   - _N/A_: Tính năng thuần Client-side UI & pure utility, không chạy trên runtime serverless hay API routes.

##### Commands Executed

- `npm run type-check` (exit 0) — Xác nhận baseline TypeScript strict mode hoàn toàn sạch.
- `node scripts/verify-docs.mjs` (exit 0) — Xác nhận tài liệu, liên kết và character limits hợp lệ.
- `npx vitest run src/lib/features/novelcrafter` (exit 0) — 38 test files, 218 tests Novelcrafter đều PASS.
- `npx vitest run src/lib/utils/translations/index.test.ts` (exit 0) — 6 tests translation key parity đều PASS.
- `git status` (exit 0) — Khảo sát working tree sạch cho vùng kế hoạch.

#### 6. Kết Luận

Kế hoạch đạt tiêu chuẩn phê duyệt theo quy chuẩn Vikini, không có vi phạm `[BLOCKER]` hay `[MAJOR]`. Cấp phê duyệt để tiến hành triển khai.

[PLAN_APPROVED]

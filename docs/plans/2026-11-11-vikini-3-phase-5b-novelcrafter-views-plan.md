# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 5B: Novelcrafter — Tab "Viết / Dàn ý / Hồ sơ", Bảng Dàn Ý Chương, Hồ Sơ Toàn Trang

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: Giai đoạn 6C (commit `7ad82ad`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: canvas board **NovelOutline** (header: tên truyện + `role="tablist"` "Chế độ xem" gồm Viết / Dàn ý / Hồ sơ; số liệu "3 hồi · 12 chương · 18.420 từ"; nút "+ Chương"; lưới thẻ chương có số, tiêu đề, nhãn trạng thái, tóm tắt, "N cảnh · N từ") và brief ("views Viết / Dàn ý / Hồ sơ").

Hiện trạng: chỉ có một màn hình viết; Hồ sơ truyện là khối gập mở **nằm dưới bản thảo**; không có chỗ nào nhìn toàn bộ chương cùng lúc ngoài danh sách tên ở panel trái.

1. **Tab chế độ xem** `NovelcrafterViewTabs` trong thanh trên, cạnh tên truyện: `role="tablist"` tên "Chế độ xem", 3 `role="tab"` có `aria-selected`, `aria-controls`; phím ←/→/Home/End chuyển tab (roving `tabIndex`). Vùng nội dung là `role="tabpanel"` `aria-labelledby` tab đang chọn.
2. **Viết** (mặc định): giữ nguyên toàn bộ màn hình hiện tại (thanh công cụ AI, panel mục lục, bản thảo, thẻ AI).
3. **Dàn ý** `NovelcrafterOutlineBoard`: dòng số liệu "N chương · N từ" + nút "+ Chương" (`addChapter` có sẵn); lưới thẻ chương `auto-fill minmax(260px,1fr)`: số thứ tự (mono), tiêu đề, **nhãn trạng thái** ("Ý tưởng" / "Có dàn ý" / "Bản nháp"), tóm tắt (hoặc "Chưa có tóm tắt."), "N cảnh · N từ". Thẻ đang mở có viền `--accent`. Bấm thẻ → chọn chương **và** chuyển sang tab Viết.
4. **Hồ sơ**: `StoryBibleWorkspace` sẵn có hiển thị toàn trang (không gập), dùng chung state/handler với khối gập trong tab Viết.
5. **Logic thuần** `summarizeChapterForOutline` (trạng thái, số cảnh, số từ) đặt ở `src/lib/features/novelcrafter/` + test.

**Out of Scope (What We're NOT Doing)**:

- **Nhóm chương theo hồi** ("Hồi 1 · Rời bến") — dữ liệu chương **không** có trường hồi; `outlineItems` của Hồ sơ có loại "act" nhưng không liên kết chắc chắn với chương. Cần thay đổi dữ liệu → để sau.
- **Trạng thái "Đã sửa"** — không có dữ liệu biên tập; chỉ suy ra 3 trạng thái từ nội dung.
- **Panel chi tiết chương bên phải** (tóm tắt, phân cảnh kéo thả, "AI sẽ đọc khi viết chương này", "Viết bản thảo chương") — tương đương thẻ "Phân cảnh" sẵn có trong tab Viết; để 5E cùng khung soạn lệnh.
- **Hồ sơ hai cột theo canvas NovelBible** (mục lục hồ sơ, thẻ nhân vật, "Ẩn khỏi AI" từng trường) — 5C.
- Kéo thả sắp xếp chương, đổi tên chương trên thẻ.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                                      | Nội dung rút ra                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Canvas `NovelOutline.dc.html`, `Novel.dc.html`                                                                                                           | Tablist "Chế độ xem", thẻ chương, nhãn trạng thái, số liệu |
| `src/lib/features/novelcrafter/types.ts`                                                                                                                 | `NovelcrafterChapterSchema` (A1)                           |
| `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`, `InlineStoryBibleSection.tsx`, `StoryBibleWorkspace.tsx`, `NovelcrafterTopBar.tsx` | A2–A6                                                      |
| `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts`, `src/lib/features/novelcrafter/draftStorage.ts`                                   | `selectChapter`, `addChapter`, `countChapterWords` (A7)    |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                           | Quyết định kỹ thuật chịu ảnh hưởng                                                                     |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn tab, trạng thái, số liệu                       | Key mới ở **cả** `vi.ts`/`en.ts`; tái dùng `novelcrafterAddChapter`                                    |
| `.agents/skills/vikini-investigate/SKILL.md` | `NovelcrafterStudioApp` là điểm ghép lớn (468 dòng) | Không đổi hook/state hiện có; chỉ thêm state `view` và rẽ nhánh render; phần mới nằm ở component riêng |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                       | Bằng chứng                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Chương có `title`, `scenes` (chuỗi), `summary?`, `content`; không có trường hồi/trạng thái                                                                                             | `[SRC]` `src/lib/features/novelcrafter/types.ts:221-235`                                                                                       |
| A2  | Màn hình viết = `ChapterAiToolbar` + hàng ngang (panel trái, `ChapterEditorWorkspace`, panel phải)                                                                                     | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:386-388`                                                           |
| A3  | Hồ sơ hiện là khối gập dưới bản thảo, bọc `StoryBibleWorkspace` với `embedded`                                                                                                         | `[SRC]` `src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx:100-111`                                                         |
| A4  | `StoryBibleWorkspace` nhận `storyBible`, `onUpdateStoryBible`, `activeSection`, `jumpRequest`, `embedded`, `onClose`, `isStreaming`, `onTriggerStream`, `onSendOutlineToChapterScenes` | `[SRC]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:29-39`                                                               |
| A5  | Gửi dàn ý vào phân cảnh chương hiện do `ChapterEditorWorkspace` xử lý (nối vào `scenes`)                                                                                               | `[SRC]` `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx:334-338`                                                          |
| A6  | Thanh trên có ô tên truyện; chỉ `NovelcrafterStudioApp` dùng `NovelcrafterTopBar`                                                                                                      | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:80-88`                                                                |
| A7  | `selectChapter(id)` và `addChapter()` (chọn luôn chương mới) có sẵn; `countChapterWords` tách theo khoảng trắng                                                                        | `[SRC]` `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts:136-160`, `src/lib/features/novelcrafter/draftStorage.ts:532-535` |

**Quyết định sản phẩm (đã chọn mặc định, ghi lại)**:

- **D1** Trạng thái chương: có chữ trong bản thảo → "Bản nháp"; chưa có chữ nhưng có tóm tắt hoặc phân cảnh → "Có dàn ý"; còn lại → "Ý tưởng".
- **D2** Tab không được nhớ qua lần tải lại (mặc định Viết) — tránh người dùng mở lại thấy màn hình khác.
- **D3** Ở tab Dàn ý/Hồ sơ, panel mục lục và panel thẻ AI không hiện (nội dung chiếm toàn chiều rộng); hai nút bật panel vẫn đưa về tab Viết.

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                     | Nguồn                     |
| ------------------ | -------------- | --------- | --------------------------- | ------------------------- |
| `react`            | `^19.2.3`      | 19.2      | `useId` cho id tab/tabpanel | `[SRC]` `package.json:69` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/lib/features/novelcrafter/chapterOutline.ts` — `summarizeChapterForOutline(chapter)` → `{ status, sceneCount, wordCount }`, `summarizeStoryOutline(chapters)` → `{ chapterCount, wordCount }`.
- `[NEW]` `src/lib/features/novelcrafter/chapterOutline.test.ts` — TC-01, TC-02.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterViewTabs.tsx` + `.test.tsx` — TC-03, TC-04.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.tsx` + `.test.tsx` — TC-05…TC-07.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterViewPanel.tsx` + `.test.tsx` — tabpanel cho Viết / Dàn ý / Hồ sơ, giữ `NovelcrafterStudioApp.tsx` dưới 500 dòng.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx` — slot `viewTabs?: React.ReactNode` sau ô tên truyện.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — state `view`, render tab + panel; giữ < 500 dòng.
- `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx` — **(Revision 2)** khi không `embedded`: tiêu đề `h1` → `h2`, tiêu đề mục luôn `h3` (trang đã có `h1` ẩn "Novelcrafter"); không đổi hành vi khác.
- `[NEW]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.test.tsx` — **(Revision 2)** TC-08.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — `novelcrafterViewTabs` ("Chế độ xem" / "View"), `novelcrafterViewWrite` ("Viết" / "Write"), `novelcrafterViewOutline` ("Dàn ý" / "Outline"), `novelcrafterViewBible` ("Hồ sơ" / "Story bible"), `novelcrafterOutlineStatusIdea` ("Ý tưởng" / "Idea"), `novelcrafterOutlineStatusPlanned` ("Có dàn ý" / "Outlined"), `novelcrafterOutlineStatusDraft` ("Bản nháp" / "Draft"), `novelcrafterOutlineStats` ("{chapters} chương · {words} từ" / "{chapters} chapters · {words} words"), `novelcrafterOutlineChapterMeta` ("{scenes} cảnh · {words} từ" / "{scenes} scenes · {words} words"), `novelcrafterOutlineNoSummary` ("Chưa có tóm tắt." / "No summary yet.").
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 Logic thuần**

```ts
export type ChapterOutlineStatus = "idea" | "planned" | "draft";
export function countSceneBeats(scenes: string): number; // dòng không rỗng, bỏ ký hiệu đầu dòng "-", "*", "1."
export function summarizeChapterForOutline(
  ch: Pick<NovelcrafterChapter, "content" | "scenes" | "summary">
): { status: ChapterOutlineStatus; sceneCount: number; wordCount: number };
export function summarizeStoryOutline(chapters: readonly Pick<NovelcrafterChapter, "content">[]): {
  chapterCount: number;
  wordCount: number;
};
```

**6.2 `NovelcrafterStudioApp`**

```tsx
const [view, setView] = useState<NovelcrafterView>("write");
const viewIds = useNovelcrafterViewIds(); // { tab(v), panel(v) } dựa trên useId
<NovelcrafterTopBar … viewTabs={<NovelcrafterViewTabs value={view} onChange={setView} ids={viewIds} />}
  onToggleLeftPane={() => { setView("write"); … }} onToggleRightPane={() => { setView("write"); … }} />
{view === "write" ? (<>{/* ChapterAiToolbar + hàng ngang như cũ */}</>) : (
  <div role="tabpanel" id={viewIds.panel(view)} aria-labelledby={viewIds.tab(view)} className="flex-1 min-h-0 overflow-y-auto">
    {view === "outline" ? (
      <NovelcrafterOutlineBoard chapters={story.storyState.chapters} activeChapterId={story.activeChapter.id}
        onOpenChapter={(id) => { setSelection(null); story.selectChapter(id); setView("write"); }}
        onAddChapter={story.addChapter} />
    ) : (
      <StoryBibleWorkspace … embedded={false} onClose={() => setView("write")} />  {/* (Revision 2) tự có vùng cuộn flex-1 overflow-y-auto, panel không thêm vùng cuộn thứ hai */}
    )}
  </div>
)}
```

Ở tab Viết, phần nội dung hiện có được bọc trong `role="tabpanel"` tương ứng (không đổi bố cục).

**6.3 `NovelcrafterOutlineBoard` (thẻ chương)**

```tsx
<button
  type="button"
  onClick={() => onOpenChapter(ch.id)}
  aria-current={active ? "true" : undefined}
  className={cn(
    "flex flex-col gap-2 rounded-xl border bg-(--surface) p-4 text-left …",
    active ? "border-(--accent)" : "border-(--line) hover:border-(--accent)"
  )}
>
  <span className="flex items-center gap-2">
    <span className="font-mono text-xs text-(--faint)">{pad2(i + 1)}</span>
    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{ch.title}</span>
    <span className={STATUS_CLASS[status]}>{t(STATUS_KEY[status])}</span>
  </span>
  <span className="line-clamp-3 text-sm text-(--muted)">
    {ch.summary?.trim() || t("novelcrafterOutlineNoSummary")}
  </span>
  <span className="text-xs text-(--faint)">{meta}</span>
</button>
```

Tên truy cập của thẻ = nội dung chữ (số, tiêu đề, trạng thái, tóm tắt, số liệu) — đọc đủ ngữ cảnh.

### 7. Các Bước Thực Hiện Tuần Tự

- [x] **B1 — Test trước**: TC-01…TC-08 → **đỏ**.
- [x] **B2 — `chapterOutline.ts`**.
- [x] **B3 — `NovelcrafterViewTabs`, `NovelcrafterOutlineBoard`** + i18n.
- [x] **B4 — Gắn vào `NovelcrafterTopBar`, `NovelcrafterStudioApp`**.
- [x] **B5 — Verify** §9 + e2e a11y + QA Playwright `/novelcrafter` 1440 + 375 (đổi tab bằng chuột và phím, bấm thẻ chương về tab Viết, thêm chương).
- [x] **B6 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                                | Input                                                        | Kỳ vọng                                                                                                                                                       |
| ----- | ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `chapterOutline.test.ts`            | chương rỗng; chỉ có tóm tắt; chỉ có phân cảnh; có bản thảo   | `idea` / `planned` / `planned` / `draft`; khoảng trắng thuần **không** tính là nội dung (Negative)                                                            |
| TC-02 | `chapterOutline.test.ts`            | phân cảnh "- A\n\n\* B\n1. C\n "; 2 chương 3 + 4 từ          | `sceneCount` 3; dòng chỉ có ký hiệu không tính; `summarizeStoryOutline` → `{ chapterCount: 2, wordCount: 7 }`                                                 |
| TC-03 | `NovelcrafterViewTabs.test.tsx`     | `value="outline"`                                            | `tablist` tên "Chế độ xem"; 3 `tab`; chỉ "Dàn ý" `aria-selected="true"` + `tabIndex=0`; tab có `aria-controls` = id panel; bấm "Hồ sơ" → `onChange("bible")`  |
| TC-04 | `NovelcrafterViewTabs.test.tsx`     | phím → trên "Hồ sơ", ← trên "Viết", End, Home                | `onChange` lần lượt "write", "bible", "bible", "write" (vòng lại ở hai đầu)                                                                                   |
| TC-05 | `NovelcrafterOutlineBoard.test.tsx` | 3 chương (rỗng / có tóm tắt / có bản thảo), chương 2 đang mở | Số liệu "3 chương · N từ"; 3 thẻ có nhãn "Ý tưởng"/"Có dàn ý"/"Bản nháp"; thẻ 2 có `aria-current="true"` + `border-(--accent)`; thẻ 1 hiện "Chưa có tóm tắt." |
| TC-06 | `NovelcrafterOutlineBoard.test.tsx` | bấm thẻ chương 3; bấm "Thêm chương"                          | `onOpenChapter("c3")` 1 lần; `onAddChapter` 1 lần                                                                                                             |
| TC-08 | `StoryBibleWorkspace.test.tsx`      | **(Revision 2)** `embedded={false}`                          | Không có `h1`; tiêu đề "Hồ sơ" là `h2`; tiêu đề các mục là `h3`                                                                                               |
| TC-07 | `NovelcrafterOutlineBoard.test.tsx` | `chapters = []` (Negative)                                   | Không có thẻ; vẫn có nút "Thêm chương"; số liệu "0 chương · 0 từ"                                                                                             |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có**. Test 5A (`NovelcrafterTopBar.test.tsx`) đếm 5 control trong `header` khi **không** truyền `viewTabs` — slot là tùy chọn nên ca cũ giữ nguyên. Nếu ca cũ nào đỏ, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/lib/features/novelcrafter/chapterOutline.test.ts src/app/features/novelcrafter --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**: W1 Grep `NovelcrafterViewTabs` trong `NovelcrafterStudioApp.tsx` → ≥ 1. W2 `wc -l NovelcrafterStudioApp.tsx` < 500. W3 QA: tab "Dàn ý" hiện thẻ chương; bấm thẻ → tab Viết với đúng chương; tab "Hồ sơ" hiện `StoryBibleWorkspace` toàn trang; phím ←/→ đổi tab; 375px không tràn ngang.

**Negative Probes** (hoàn tác sau mỗi probe): N1 coi khoảng trắng là nội dung (bỏ `trim`) → TC-01 đỏ. N2 bỏ `aria-selected` → TC-03 đỏ. N3 bỏ xử lý phím Home/End → TC-04 đỏ. N4 bỏ `aria-current` → TC-05 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                               | Mức        | Control                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chuyển tab làm mất trạng thái bản thảo (unmount editor) hoặc ngắt luồng AI đang chạy | Trung bình | State truyện nằm ở hook `useNovelcrafterStory` (không phụ thuộc editor); luồng stream nằm ở `useNovelcrafterStream`; QA: viết chữ → sang Dàn ý → về Viết vẫn còn chữ |
| Khối Hồ sơ gập trong tab Viết và Hồ sơ toàn trang cùng sửa một dữ liệu               | Thấp       | Cùng `storyBible` + `updateStoryBible`; không tồn tại đồng thời (chỉ một tab hiển thị)                                                                               |
| `NovelcrafterStudioApp` vượt 500 dòng                                                | Trung bình | Phần mới ở component riêng; W2 đo                                                                                                                                    |
| Thanh trên chật ở mobile khi thêm tablist                                            | Trung bình | Tablist thu gọn chữ 13px, tiêu đề co lại; QA 375                                                                                                                     |

### Lộ Trình

| Bước | Nội dung                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------- |
| 5B   | **Plan này** — tab chế độ xem, bảng dàn ý chương, Hồ sơ toàn trang                             |
| 5C   | Hồ sơ hai cột theo canvas (thẻ nhân vật, "Ẩn khỏi AI")                                         |
| 5D   | Trang Cài đặt AI dạng bảng kế thừa + Prompt Studio                                             |
| 5E   | Khung soạn lệnh AI, panel chi tiết chương, dock mobile; nhóm chương theo hồi (cần đổi dữ liệu) |

### 11. Ghi Chú Triển Khai

- Tách `NovelcrafterViewPanel.tsx` (+ `.test.tsx`) bọc `role="tabpanel"` cho cả 3 chế độ xem để giữ `NovelcrafterStudioApp.tsx` ở 494 dòng (< 500), không lồng vùng cuộn ở tab Hồ sơ và nối dàn ý vào `scenes` của chương đang mở rồi quay về tab Viết.
- Ở `NovelcrafterTopBar.tsx`, ô tên truyện dùng `min-w-16 sm:min-w-32` kèm `flex-wrap` trên nhóm trái để không tràn ngang ở 375px khi gắn `NovelcrafterViewTabs`.
- Kiểm tra: TC-01…TC-08 + `NovelcrafterViewPanel.test.tsx` xanh (35/35 test trong Novelcrafter); `tsc`, `lint` sạch; vitest toàn repo 1976/1978 (2 lỗi governance có từ trước); Negative Probes N1–N4 đều đỏ như kỳ vọng; e2e `a11y.spec.ts` 15/15; QA Playwright `/novelcrafter` ở 1440px và 375px xanh 2/2 (đổi tab chuột/phím, thêm chương, mở chương từ thẻ, giữ nguyên chữ đang viết, 1 `h1` + 1 `h2` + 7 `h3` trong tab Hồ sơ, không tràn ngang).

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5b-novelcrafter-views-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A7 khớp source. Đọc thêm nhánh không-`embedded` của `StoryBibleWorkspace` và grep caller.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                | Bằng chứng                                                                                                                                                                              | Lý do / Yêu cầu sửa                                                                                                                                                                           |
| --- | -------------- | ------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:141`     | [SRC] Khi không `embedded`, `StoryBibleWorkspace` render tiêu đề `h1`; `NovelcrafterStudioApp` đã có `h1` ẩn (`src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:293`) | Tab Hồ sơ sẽ tạo **hai `h1`** — hồi quy so với 2A ("mỗi trang đúng một `h1`"). Grep: không caller nào dùng nhánh không-`embedded`, nên đổi sang `h2` an toàn. **Sửa**: thêm file sửa + TC-08. |
| 2   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:456-460` | [SRC] Nhánh không-`embedded` tự bọc `flex-1 min-h-0 overflow-y-auto`                                                                                                                    | Sketch §6.2 bọc thêm `div` có `p-4 max-w-4xl` → vùng cuộn lồng. Sửa sketch: render trực tiếp trong `tabpanel` `flex flex-col min-h-0`.                                                        |
| 3   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterTopBar.test.tsx:112` | [SRC] Test 5A đếm 5 control trong `header`                                                                                                                                              | Slot `viewTabs` tùy chọn, test không truyền → giữ 5; không có Loại C.                                                                                                                         |

#### Kết Luận

1 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5b-novelcrafter-views-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §5 thêm sửa cấp heading của `StoryBibleWorkspace` + TC-08.
- Audit Run 1 #2 `[MINOR]` → **đã xử lý**: §6.2 bỏ wrapper cuộn thứ hai.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                  | Bằng chứng                                                 | Lý do / Hướng xử lý khi code                                                                                  |
| --- | -------------- | ------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:90`        | [SRC] `sectionHeadingLevel` = 2 khi không `embedded`       | Đổi luôn thành 3 để tiêu đề mục nằm dưới `h2` của Hồ sơ (TC-08 khẳng định).                                   |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:241-242` | [SRC] `isLeftInline`/`isRightInline` tính theo `focusMode` | Ở tab Dàn ý/Hồ sơ không render panel (D3); trạng thái panel giữ nguyên để khi về tab Viết hiển thị như trước. |
| 3   | RISK_DISMISSED | —       | `src/lib/features/novelcrafter/draftStorage.ts:532`                          | [SRC] `countChapterWords` dùng chung                       | `chapterOutline.ts` tái dùng hàm này, số từ khớp với số hiển thị ở thanh trên.                                |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-01, TC-07) và Negative Probe N1–N4; không có ca test cũ bị thay. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

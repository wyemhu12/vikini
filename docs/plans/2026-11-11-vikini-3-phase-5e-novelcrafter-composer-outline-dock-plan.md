# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 5E: Novelcrafter — Khung Soạn Lệnh AI, Chi Tiết Chương Ở Dàn Ý, Dock AI Mobile & Nhóm Chương Theo Hồi

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Gemini 4 Carbon (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: gemini-4-carbon]`)
- **Depends on**: Giai đoạn 5D (commit `2bb3fbb`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: 3 canvas board **Novel** (`Novel.dc.html`: cột trái nhóm chương theo hồi `Hồi 1 · Rời bến`, `Hồi 2 · Mùa lũ`; cột phải `<aside aria-label="Thẻ AI">` lọc `Chương này / Tất cả` + khung `<form>` soạn lệnh AI neo đáy gồm chọn hành động, `radiogroup` chế độ, ô hướng đi 2 dòng, 3 nút độ dài `Câu / Đoạn / Cảnh`, nút nguồn prompt `GEM Tổng · Persona`, nút model hiệu lực và nút chạy/dừng), **NovelOutline** (`NovelOutline.dc.html`: cột chương nhóm theo `<section aria-label={actName}>` + cột phải `<aside>` `380px` chi tiết chương đang chọn gồm tóm tắt chương, danh sách phân cảnh có `+ Thêm phân cảnh` & `Sửa bằng AI`, hộp `AI sẽ đọc khi viết chương này`, nút chính `Viết bản thảo chương` và nút mở trong bàn viết), **NovelMobile** (`NovelMobile.dc.html`: thanh chuyển phân cảnh `44px` `2/4 · ...` trên màn hình nhỏ + thanh đáy `<nav aria-label="Công cụ AI">` gồm nút chính `Viết tiếp / Dừng`, `Viết lại đoạn chọn`, `Gợi ý tình tiết`, `Thẻ AI` kèm badge số lượng), và brief (`docs/specs/2026-11-08-vikini-3-redesign-brief.md`).

Hiện trạng:

- `NovelcrafterChapterSchema` (`src/lib/features/novelcrafter/types.ts:233-247`) chưa có trường tên hồi (`actTitle`), nên `NovelcrafterLeftNavigator` và `NovelcrafterOutlineBoard` chỉ hiển thị danh sách chương phẳng.
- Màn hình Dàn ý (`NovelcrafterOutlineBoard` + `NovelcrafterViewPanel`) chưa có panel `<aside>` chi tiết chương bên phải: bấm thẻ chương lập tức nhảy về tab Viết thay vì cho phép đọc/sửa tóm tắt, phân cảnh, hồi, ngữ cảnh AI và chạy bản thảo ngay trên Dàn ý.
- Panel phải `NovelcrafterHistoryPane` mới chỉ liệt kê thẻ AI, chưa có bộ lọc `Chương này / Tất cả` và chưa có khung `<form>` soạn lệnh AI neo đáy theo canvas `Novel.dc.html`.
- Trên mobile (`< md`), màn hình Viết vẫn hiển thị thanh `ChapterAiToolbar` nhiều tầng thay vì thanh phân cảnh gọn + dock đáy `<nav aria-label="Công cụ AI">` của `NovelMobile.dc.html`.

Mục tiêu Giai đoạn 5E:

1. **Nhóm chương theo hồi tương thích ngược (`actTitle?: string`)**: mở rộng `NovelcrafterChapterSchema` (`types.ts`), `coerceStoryStateToLimits` (`stateLimits.ts`), `addChapter` (`useNovelcrafterStateMutators.ts` tự kế thừa `actTitle` của chương liền trước), và `chapterOutline.ts` (`groupChaptersByAct`, `countStoryActs`, `parseSceneBeats`, `appendSceneBeat`, `updateSceneBeatAt`, `removeSceneBeatAt`, `resolveChapterOutlineContextChips`). Hiển thị tiêu đề hồi trong `NovelcrafterLeftNavigator` và các `<section>` cột/nhóm hồi trong `NovelcrafterOutlineBoard`.
2. **Panel chi tiết chương ở Dàn ý (`NovelcrafterOutlineDetailPanel.tsx`)**: ở tab Dàn ý, bấm thẻ chương sẽ chọn chương đó (`story.selectChapter`) và mở `<aside>` chi tiết chương bên phải (`380px` trên `xl+`, `Sheet` dưới `xl`) gồm sửa tên chương + tên hồi (`actTitle`), `Tóm tắt chương`, danh sách `Phân cảnh` từng dòng (`+ Thêm phân cảnh`, xóa/sửa phân cảnh, `Sửa bằng AI` gọi `bible:scenes`), hộp `AI sẽ đọc khi viết chương này` (tính từ `StoryBible` + `codexMatcher`), nút chính `Viết bản thảo chương` (`bible:draft`) và nút phụ `Mở trong bàn viết` (chuyển về tab Viết; nhấp đúp thẻ chương cũng mở ngay trong bàn viết).
3. **Khung soạn lệnh AI neo đáy panel Thẻ AI (`NovelcrafterAiComposer.tsx` + `NovelcrafterHistoryPane.tsx`)**: bổ sung nút lọc thẻ `Tất cả / Chương này` trên header `NovelcrafterHistoryPane` (tận dụng `chapterId` đã gắn sẵn tại `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:419-435`) và neo `<form>` `NovelcrafterAiComposer` ở đáy panel phải (chọn nhóm hành động, `radiogroup` chế độ con, ô hướng đi 2 dòng, độ dài `Câu / Đoạn / Cảnh`, tóm tắt nguồn prompt `GEM Tổng · Persona`, model hiệu lực theo slot và nút Chạy/Dừng).
4. **Dock AI mobile & thanh phân cảnh gọn (`NovelcrafterMobileAiDock.tsx` + `NovelcrafterWriteStage.tsx`)**: ẩn `ChapterAiToolbar` dưới `md` (`hidden md:block`), hiển thị `NovelcrafterMobileBeatBar` (`md:hidden`) khi chương có phân cảnh và `<nav aria-label="Công cụ AI">` neo đáy mobile (`Viết tiếp / Dừng`, `Viết lại đoạn chọn`, `Gợi ý tình tiết` mở ngăn Thẻ AI kèm chạy gợi ý, `Thẻ AI` kèm badge số lượng dùng `text-xs` >= 12px). Tách `NovelcrafterWriteStage.tsx` khỏi `NovelcrafterStudioApp.tsx` để mọi component giữ `< 500` dòng.

**Out of Scope (What We're NOT Doing)**:

- Không thay đổi API route hoặc file `*.server.ts` — `actTitle` nằm gọn trong JSON state của truyện hiện hữu (`NovelcrafterChapterSchema.actTitle` là `.optional()`), server lưu/đọc qua cùng schema `NovelcrafterStoryStateSchema`.
- Không làm kéo-thả sắp xếp lại chương/phân cảnh bằng thư viện DnD mới (dùng chỉnh sửa trực tiếp, thêm/xóa phân cảnh và gán tên hồi gọn nhẹ, không phát sinh dependency mới).
- Không chạy codemod màu thô toàn repo hay bật ESLint guard — thuộc Giai đoạn 6 kế tiếp.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                               | Nội dung rút ra                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas `Novel.dc.html`, `NovelOutline.dc.html`, `NovelMobile.dc.html` & `docs/specs/2026-11-08-vikini-3-redesign-brief.md`        | Bố cục chuẩn của khung composer neo đáy panel phải, `<aside>` chi tiết chương 380px + nhóm hồi ở Dàn ý, thanh phân cảnh 44px + dock AI mobile |
| `src/lib/features/novelcrafter/types.ts`, `stateLimits.ts`, `chapterOutline.ts`, `codexMatcher.ts`, `aiInheritanceTable.ts`       | Schema chương, giới hạn độ dài state, hàm đếm phân cảnh, đối sánh nhân vật/bối cảnh xuất hiện và phân giải GEM/Persona/Model theo slot        |
| `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts`, `useNovelcrafterStream.ts`, `useChapterEditorController.ts`       | Luồng stream trực tiếp dựa trên `activeChapterId` và cơ chế gắn `chapterId` vào từng `NovelcrafterHistoryCard`                                |
| `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.tsx`, `NovelcrafterViewPanel.tsx`, `NovelcrafterStudioApp.tsx` | Tương tác hiện tại của bảng Dàn ý, panel chuyển tab 5B và kích thước `NovelcrafterStudioApp.tsx` (496 dòng, sát trần 500 dòng)                |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                            | Quyết định kỹ thuật chịu ảnh hưởng                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `.agents/skills/add-translation/SKILL.md`    | Bổ sung khóa dịch song ngữ cho composer AI, chi tiết chương Dàn ý, hồi & dock mobile | Khai báo đồng bộ `vi.ts` và `en.ts`, toàn bộ văn bản UI đọc qua `useLanguage()`      |
| `.agents/skills/vikini-investigate/SKILL.md` | Mở rộng `NovelcrafterChapterSchema` & `NovelcrafterViewPanel`                        | Giữ `actTitle` tùy chọn, giữ fallback `onOpenChapter` khi `onSelectChapter` vắng mặt |

### 3. Assumptions & Cross-Task Dependencies

- **A1**: `useDirectStreamBridge` (`src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts:78-89`) và `useNovelcrafterStream` (`src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:419-435`) đều đọc `activeChapterId` từ state truyện. Khi người dùng chọn một thẻ chương trên bảng Dàn ý, gọi `story.selectChapter(chapterId)` đảm bảo nút `"Sửa bằng AI"` (`bible:scenes`) và `"Viết bản thảo chương"` (`bible:draft`) trong panel chi tiết luôn tác động đúng chương đang chọn.
- **A2**: `NovelcrafterA11yNames.test.tsx` (`src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:84-104`) render `<NovelcrafterHistoryPane>` với bộ props tối thiểu (không truyền composer hay `activeChapterId`). Giữ các props mới (`activeChapterId`, `composer`) là tùy chọn để test 3D xanh nguyên vẹn.
- **A3**: `NovelcrafterOutlineBoard.test.tsx` (`src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.test.tsx:70-86`) render `<NovelcrafterOutlineBoard>` không có `actTitle` và chỉ truyền `onOpenChapter`. Khi `actCount === 0`, giữ nguyên chuỗi thống kê `"{chapters} chương · {words} từ"` và khi không truyền `onSelectChapter` thì click thẻ vẫn gọi `onOpenChapter` → toàn bộ TC-05..TC-07 của 5B xanh nguyên vẹn.
- **A4**: Trong `NovelcrafterViewPanel.test.tsx` (`src/app/features/novelcrafter/components/NovelcrafterViewPanel.test.tsx:82-106`), ca test tạm thời của 5B kỳ vọng bấm thẻ chương ở tab Dàn ý nhảy thẳng về tab Viết (`onReturnToWrite`). Theo thiết kế hoàn chỉnh của 5E (`NovelOutline.dc.html`), bấm thẻ chương ở tab Dàn ý mở/cập nhật panel chi tiết chương ngay trong Dàn ý, còn bấm nút `"Mở trong bàn viết"` (hoặc nhấp đúp thẻ) mới quay về tab Viết → khai báo đích danh là **1 ca test Loại C** duy nhất trong §8.

### 4. Quyết Định Thiết Kế (Design Decisions)

- **D1 — Nhóm chương theo hồi nối tiếp (`groupChaptersByAct`) không làm xáo trộn thứ tự chương**: Chương lưu `actTitle?: string` (tối đa `120` ký tự). Các chương liên tiếp có cùng `actTitle` (sau khi `trim()`) được gom vào một `ChapterActGroup`, giữ nguyên số thứ tự toàn cục (`01`, `02`, ...). Khi truyện chưa đặt `actTitle` ở chương nào (`actCount === 0`), giao diện hiển thị lưới phẳng như cũ, không ép nhãn `"Chưa phân hồi"`; khi có ít nhất 1 chương gắn `actTitle`, bảng Dàn ý chuyển sang các `<section aria-label={...}>` theo hồi (và các chương chưa gán tên hồi nằm trong nhóm `"Chưa gán hồi"`).
- **D2 — Panel chi tiết chương ở Dàn ý hỗ trợ cả desktop `xl+` (`<aside>` 380px) lẫn màn hình nhỏ (`Sheet`)**: Dưới `xl`, không ép cột 380px cạnh lưới thẻ gây hẹp ngang mà mở `Sheet` bên phải khi người dùng bấm chọn chương; trên `xl+`, hiển thị `<aside>` cố định 380px bên phải (có thể đóng bằng nút `Đóng chi tiết` và mở lại khi bấm bất kỳ thẻ chương nào).
- **D3 — Thao tác phân cảnh trực quan trên nền chuỗi `chapter.scenes` hiện hữu**: `parseSceneBeats` và `serializeSceneBeats` chuyển đổi hai chiều giữa chuỗi gạch đầu dòng `chapter.scenes` và mảng dòng phân cảnh mà không đổi cấu trúc dữ liệu `scenes: string`, giúp `ChapterDraftBeatsCard`, `StoryBibleWorkspace` và prompt XML (`<scenes>`) tương thích tức thì.
- **D4 — Tách `NovelcrafterWriteStage.tsx` để giữ `NovelcrafterStudioApp.tsx` gọn sạch dưới 500 dòng**: `NovelcrafterStudioApp.tsx` hiện 496 dòng (`src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:54-136`). Đưa phần bố cục bàn viết (toolbar desktop `hidden md:block`, thanh phân cảnh mobile, cột trái, `ChapterEditorWorkspace`, cột phải kèm `NovelcrafterAiComposer`, và `NovelcrafterMobileAiDock`) sang `NovelcrafterWriteStage.tsx` giúp cả hai file đều `< 380` dòng.
- **D5 — Badge đếm thẻ trên dock mobile tuân thủ cỡ chữ tối thiểu 12px**: Canvas tĩnh ghi `11px` cho chấm số lượng, nhưng quy chuẩn hệ thống Vikini 3.0 cấm mọi cỡ chữ `< 12px` (`docs/specs/2026-11-08-vikini-3-redesign-brief.md`). Dùng `text-xs leading-none` (`12px`) cho badge số lượng trên nút `Thẻ AI`.

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                                                                 | Nguồn                     |
| ------------------ | -------------- | --------- | ----------------------------------------------------------------------- | ------------------------- |
| `react`            | `^19.2.3`      | 19.2      | Component state, `radiogroup`, controlled beat & composer inputs        | `[SRC]` `package.json:69` |
| `zod`              | `^4.2.1`       | 4.2       | Trường tùy chọn `actTitle` trên `NovelcrafterChapterSchema`             | `[SRC]` `package.json:80` |
| `lucide-react`     | `^0.575.0`     | 0.575     | Biểu tượng cho dock AI mobile, thanh phân cảnh và panel chi tiết chương | `[SRC]` `package.json:61` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/lib/features/novelcrafter/types.ts` — thêm `MAX_CHAPTER_ACT_CHARS = 120` và `actTitle: z.string().max(MAX_CHAPTER_ACT_CHARS).optional()` vào `NovelcrafterChapterSchema`.
- `[MODIFY]` `src/lib/features/novelcrafter/stateLimits.ts` — thêm `chapterActTitle` vào `FIELD_MAX_LENGTHS` và chuẩn hóa `actTitle` trong `coerceStoryStateToLimits`.
- `[MODIFY]` `src/lib/features/novelcrafter/stateLimits.test.ts` — kiểm thử giữ/cắt `actTitle` tới 120 ký tự và bỏ chuỗi chỉ gồm khoảng trắng.
- `[MODIFY]` `src/lib/features/novelcrafter/chapterOutline.ts` — thêm `groupChaptersByAct`, `countStoryActs`, `parseSceneBeats`, `serializeSceneBeats`, `appendSceneBeat`, `updateSceneBeatAt`, `removeSceneBeatAt`, `resolveChapterOutlineContextChips`.
- `[MODIFY]` `src/lib/features/novelcrafter/chapterOutline.test.ts` — unit test cho gom nhóm hồi, thao tác danh sách phân cảnh và chip ngữ cảnh AI (kể cả khi mục Hồ sơ bị ẩn khỏi AI).
- `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts` — `addChapter` tự kế thừa `actTitle` của chương cuối (nếu có).
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterAiComposer.tsx` — khung `<form>` soạn lệnh AI neo đáy panel phải theo canvas `Novel.dc.html`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterAiComposer.test.tsx` — component test cho đổi nhóm lệnh, `radiogroup` chế độ, chọn độ dài `Câu / Đoạn / Cảnh`, hiển thị nguồn prompt + model hiệu lực, gửi lệnh stream và nút Dừng.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx` — nâng cấp sang token Vikini 3.0, thêm bộ lọc `Tất cả / Chương này` khi truyền `activeChapterId` và gắn `composer` neo đáy.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx` — hiển thị tiêu đề hồi (`actTitle`) xen trước nhóm chương và nâng cấp sang token Vikini 3.0.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.tsx` — panel `<aside>` 380px chi tiết chương ở Dàn ý (tiêu đề, tên hồi, tóm tắt, phân cảnh + `Sửa bằng AI`, chip `AI sẽ đọc khi viết chương này`, `Viết bản thảo chương`, `Mở trong bàn viết`).
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx` — component test cho sửa tóm tắt/tên hồi, thêm/sửa/xóa phân cảnh, gọi `Sửa bằng AI`, hiển thị chip ngữ cảnh, gọi `Viết bản thảo chương` và `Mở trong bàn viết`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.tsx` — hỗ trợ hiển thị `<section>` theo hồi khi có `actTitle`, chọn thẻ qua `onSelectChapter` và mở nhanh qua nhấp đúp.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.test.tsx` — giữ nguyên TC-05..TC-07 và bổ sung test hiển thị cột hồi + `onSelectChapter`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterViewPanel.tsx` — kết hợp `NovelcrafterOutlineBoard` + `NovelcrafterOutlineDetailPanel` (`<aside>` trên `xl+` và `Sheet` dưới `xl`), truyền `onStopStream`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterViewPanel.test.tsx` — cập nhật ca Loại C dòng 82–106 sang hành vi chọn thẻ mở panel chi tiết + bấm `"Mở trong bàn viết"` quay về tab Viết.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.tsx` — thanh `NovelcrafterMobileBeatBar` (`44px`) và thanh đáy `<nav aria-label="Công cụ AI">` trên `< md`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.test.tsx` — component test cho chuyển phân cảnh trước/sau, nút `Viết tiếp / Dừng`, `Viết lại đoạn chọn`, `Gợi ý tình tiết`, và nút `Thẻ AI` kèm badge số lượng.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterWriteStage.tsx` — tổ hợp bàn viết (toolbar desktop `hidden md:block`, thanh phân cảnh mobile, 3 cột linh hoạt kèm `NovelcrafterAiComposer` và dock AI mobile).
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — nối `NovelcrafterWriteStage` và `onStopStream` vào `NovelcrafterViewPanel`, giảm dung lượng xuống `< 380` dòng.
- `[MODIFY]` `src/lib/utils/translations/vi.ts` — bổ sung khóa dịch tiếng Việt cho Giai đoạn 5E.
- `[MODIFY]` `src/lib/utils/translations/en.ts` — bổ sung khóa dịch tiếng Anh tương ứng.

### 6. Caller-First Design Sketch

#### 6.1. Hàm thuần nhóm hồi, phân cảnh & chip ngữ cảnh (`chapterOutline.ts`)

```ts
export interface ChapterActGroup {
  key: string;
  actTitle: string | null;
  chapters: Array<{ chapter: NovelcrafterChapter; index: number }>;
  chapterCount: number;
  wordCount: number;
}

export type OutlineContextChipKind =
  | "synopsis"
  | "style"
  | "genre"
  | "character"
  | "world"
  | "previous_chapters";

export interface OutlineContextChip {
  id: string;
  kind: OutlineContextChipKind;
  label?: string;
  count?: number;
}
```

#### 6.2. Khóa dịch mới (`vi.ts` / `en.ts`)

| Key                                       | `vi`                                                               | `en`                                                          |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `novelcrafterOutlineStatsWithActs`        | `"{acts} hồi · {chapters} chương · {words} từ"`                    | `"{acts} acts · {chapters} chapters · {words} words"`         |
| `novelcrafterOutlineUnassignedAct`        | `"Chưa gán hồi"`                                                   | `"Unassigned act"`                                            |
| `novelcrafterChapterActLabel`             | `"Hồi / Phần"`                                                     | `"Act / Part"`                                                |
| `novelcrafterChapterActPlaceholder`       | `"Ví dụ: Hồi 1 · Rời bến"`                                         | `"e.g. Act 1 · Departure"`                                    |
| `novelcrafterOutlineDetailAria`           | `"Chi tiết chương {number}"`                                       | `"Chapter {number} details"`                                  |
| `novelcrafterOutlineCloseDetail`          | `"Đóng chi tiết"`                                                  | `"Close details"`                                             |
| `novelcrafterOutlineEditWithAi`           | `"Sửa bằng AI"`                                                    | `"Refine with AI"`                                            |
| `novelcrafterOutlineAddBeat`              | `"+ Thêm phân cảnh"`                                               | `"+ Add scene beat"`                                          |
| `novelcrafterOutlineBeatInputAria`        | `"Phân cảnh {number}"`                                             | `"Scene beat {number}"`                                       |
| `novelcrafterOutlineRemoveBeatAria`       | `"Xóa phân cảnh {number}"`                                         | `"Remove scene beat {number}"`                                |
| `novelcrafterOutlineAiContextTitle`       | `"AI sẽ đọc khi viết chương này"`                                  | `"Context AI reads for this chapter"`                         |
| `novelcrafterOutlineAiContextEmpty`       | `"Chưa có hồ sơ hoặc chương trước."`                               | `"No Story Bible entries or prior chapters yet."`             |
| `novelcrafterOutlineContextPrevChapters`  | `"{count} chương trước"`                                           | `"{count} prior chapters"`                                    |
| `novelcrafterOutlineWriteDraftCta`        | `"Viết bản thảo chương"`                                           | `"Write chapter draft"`                                       |
| `novelcrafterOutlineOpenInWriteBtn`       | `"Mở trong bàn viết"`                                              | `"Open in Write view"`                                        |
| `novelcrafterOutlineDraftHint`            | `"Kết quả được lưu thành thẻ AI và cập nhật vào bản thảo chương."` | `"Streams into the chapter manuscript and saves an AI card."` |
| `novelcrafterHistoryFilterChapter`        | `"Chương này"`                                                     | `"This chapter"`                                              |
| `novelcrafterHistoryFilterAll`            | `"Tất cả"`                                                         | `"All chapters"`                                              |
| `novelcrafterComposerFormAria`            | `"Soạn lệnh AI"`                                                   | `"AI command composer"`                                       |
| `novelcrafterComposerActionAria`          | `"Nhóm lệnh AI"`                                                   | `"AI action group"`                                           |
| `novelcrafterComposerModeGroupAria`       | `"Chế độ thực thi"`                                                | `"Execution mode"`                                            |
| `novelcrafterComposerPromptAria`          | `"Hướng đi hoặc yêu cầu thêm"`                                     | `"Direction or custom instructions"`                          |
| `novelcrafterComposerPromptPlaceholder`   | `"Gợi ý hướng đi cho AI (tùy chọn)…"`                              | `"Optional direction or instructions for AI…"`                |
| `novelcrafterComposerLengthSentence`      | `"Câu"`                                                            | `"Sentence"`                                                  |
| `novelcrafterComposerLengthParagraph`     | `"Đoạn"`                                                           | `"Paragraph"`                                                 |
| `novelcrafterComposerLengthScene`         | `"Cảnh"`                                                           | `"Scene"`                                                     |
| `novelcrafterComposerPromptSourceAria`    | `"Nguồn prompt đang dùng"`                                         | `"Active prompt source"`                                      |
| `novelcrafterComposerPromptSourceSummary` | `"GEM Tổng: {gem} · Persona: {persona}"`                           | `"Master GEM: {gem} · Persona: {persona}"`                    |
| `novelcrafterComposerNoneShort`           | `"chưa gắn"`                                                       | `"none"`                                                      |
| `novelcrafterMobileAiDockAria`            | `"Công cụ AI"`                                                     | `"AI tools"`                                                  |
| `novelcrafterMobileRewriteSelectionAria`  | `"Viết lại đoạn chọn"`                                             | `"Rewrite selection"`                                         |
| `novelcrafterMobileBrainstormAria`        | `"Gợi ý tình tiết"`                                                | `"Brainstorm plot ideas"`                                     |
| `novelcrafterMobileCardsCountAria`        | `"Thẻ AI, {count} thẻ"`                                            | `"AI cards, {count} cards"`                                   |
| `novelcrafterPrevBeatAria`                | `"Phân cảnh trước"`                                                | `"Previous scene beat"`                                       |
| `novelcrafterNextBeatAria`                | `"Phân cảnh sau"`                                                  | `"Next scene beat"`                                           |

### 7. Các Bước Thực Hiện Tuần Tự

1. **Bước B1 (TDD Red)**: Bổ sung unit test trong `stateLimits.test.ts` & `chapterOutline.test.ts`; tạo `NovelcrafterAiComposer.test.tsx`, `NovelcrafterOutlineDetailPanel.test.tsx`, `NovelcrafterMobileAiDock.test.tsx`; cập nhật `NovelcrafterOutlineBoard.test.tsx` và `NovelcrafterViewPanel.test.tsx` (Loại C dòng 82–106) → chạy Vitest xác nhận đỏ.
2. **Bước B2 (Domain & State)**: Cập nhật `types.ts`, `stateLimits.ts`, `chapterOutline.ts`, `useNovelcrafterStateMutators.ts` → chạy unit test xác nhận TC-01, TC-02 xanh.
3. **Bước B3 (UI Components & i18n)**: Bổ sung khóa dịch `vi.ts`/`en.ts`; tạo `NovelcrafterAiComposer.tsx`, `NovelcrafterOutlineDetailPanel.tsx`, `NovelcrafterMobileAiDock.tsx`, `NovelcrafterWriteStage.tsx`; cập nhật `NovelcrafterHistoryPane.tsx`, `NovelcrafterLeftNavigator.tsx`, `NovelcrafterOutlineBoard.tsx`, `NovelcrafterViewPanel.tsx`, `NovelcrafterStudioApp.tsx` → chạy toàn bộ test xác nhận TC-01…TC-06 xanh.
4. **Bước B4 (Verify & QA)**: Chạy Prettier, `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, Negative Probes N1–N4, Playwright `tests/e2e/a11y.spec.ts` và QA `/novelcrafter` ở `1440px` & `375px`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

**Danh sách ca test Loại C (sửa test hiện hữu)**:

1. `src/app/features/novelcrafter/components/NovelcrafterViewPanel.test.tsx:82-106` (`"hides write children in outline view and selects chapter + returns to write on card click"`): ở 5B chưa có panel chi tiết chương nên bấm thẻ nhảy thẳng về tab Viết; sang 5E theo canvas `NovelOutline.dc.html`, bấm thẻ chương chọn chương đó (`story.selectChapter("c2")`) và hiển thị `<aside>` chi tiết chương ngay trong tab Dàn ý (`onReturnToWrite` chưa gọi), sau đó bấm nút `"Mở trong bàn viết"` mới gọi `onReturnToWrite({ clearSelection: true })`.

| ID    | File test                                                                          | Mô tả ca test                                                                                                                                                                                                                                  | Loại      |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| TC-01 | `src/lib/features/novelcrafter/stateLimits.test.ts`                                | `coerceStoryStateToLimits` giữ `actTitle` hợp lệ, cắt xuống `120` ký tự khi quá dài, và **ca âm tính**: loại bỏ `actTitle` chỉ chứa khoảng trắng hoặc không phải chuỗi                                                                         | Unit      |
| TC-02 | `src/lib/features/novelcrafter/chapterOutline.test.ts`                             | `groupChaptersByAct` gom các chương liên tiếp cùng hồi + tính `actCount`; `parseSceneBeats` / `appendSceneBeat` / `updateSceneBeatAt` / `removeSceneBeatAt` đồng bộ 2 chiều; **ca âm tính**: `resolveChapterOutlineContextChips` ẩn mục tắt AI | Unit      |
| TC-03 | `src/app/features/novelcrafter/components/NovelcrafterAiComposer.test.tsx`         | Đổi nhóm lệnh + `radiogroup` chế độ (`Tự động / Chỉ dẫn / Đổi giọng`), chọn độ dài `Câu / Đoạn / Cảnh` (`aria-pressed`), hiển thị nguồn prompt + model hiệu lực, gửi đúng tham số stream và đổi sang nút `Dừng` khi `isStreaming`              | Component |
| TC-04 | `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx` | Sửa tóm tắt chương & tên hồi, thêm/sửa/xóa phân cảnh, bấm `Sửa bằng AI` (`bible:scenes`), hiển thị chip ngữ cảnh AI, bấm `Viết bản thảo chương` (`bible:draft`) và bấm `Mở trong bàn viết`                                                     | Component |
| TC-05 | `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.test.tsx`       | Khi có `actTitle`, render các `<section>` theo hồi kèm thống kê `{acts} hồi · {chapters} chương · {words} từ` và gọi `onSelectChapter`; khi không có `actTitle`, giữ nguyên hành vi 5B (TC-05..TC-07)                                          | Component |
| TC-06 | `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.test.tsx`       | Render thanh phân cảnh `1/3 · ...` chuyển trước/sau và `<nav aria-label="Công cụ AI">` với nút `Viết tiếp` (đổi sang `Dừng` khi `isStreaming`), `Viết lại đoạn chọn`, `Gợi ý tình tiết`, và `Thẻ AI` kèm badge số lượng                        | Component |

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**:

- **W1**: Mọi file UI (`NovelcrafterStudioApp.tsx`, `NovelcrafterWriteStage.tsx`, `NovelcrafterHistoryPane.tsx`, `NovelcrafterAiComposer.tsx`, `NovelcrafterOutlineBoard.tsx`, `NovelcrafterOutlineDetailPanel.tsx`, `NovelcrafterMobileAiDock.tsx`, `NovelcrafterLeftNavigator.tsx`) đều `< 500` dòng; `chapterOutline.ts`, `stateLimits.ts` đều `< 400` dòng; không dùng màu Tailwind thô hay cỡ chữ `< 12px`.
- **W2**: QA Playwright `/novelcrafter` ở `1440px` và `375px`:
  - Ở `1440px`: kiểm tra composer neo đáy panel phải (đổi chế độ, độ dài, mở Cài đặt AI từ dòng nguồn prompt), chuyển sang tab Dàn ý bấm thẻ chương mở `<aside>` chi tiết chương, đặt tên hồi (`Hồi 1 · Rời bến`) + thêm phân cảnh, kiểm tra cột hồi xuất hiện trên Dàn ý và tiêu đề hồi xuất hiện ở cột trái khi bấm `Mở trong bàn viết`.
  - Ở `375px`: kiểm tra thanh phân cảnh `1/1` và `<nav aria-label="Công cụ AI">`, bấm `Thẻ AI` mở Sheet có composer AI, không tràn ngang, axe tên truy cập sạch.

**Negative Probes** (hoàn tác ngay sau mỗi probe):

- **N1**: Trong `chapterOutline.ts`, bỏ kiểm tra `synopsisVisibleToAI !== false` trong `resolveChapterOutlineContextChips` → TC-02 đỏ.
- **N2**: Trong `NovelcrafterAiComposer.tsx`, bỏ cập nhật `writeLengthWords` khi bấm nút độ dài `Câu` → TC-03 đỏ.
- **N3**: Trong `NovelcrafterOutlineDetailPanel.tsx`, bỏ gọi `onUpdateChapter` khi bấm `+ Thêm phân cảnh` → TC-04 đỏ.
- **N4**: Trong `NovelcrafterMobileAiDock.tsx`, giữ nút chính gọi `onRunAutoWrite` thay vì `onStopStream` khi `isStreaming === true` → TC-06 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                 | Mức        | Control                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NovelcrafterStudioApp.tsx` vượt trần 500 dòng (hiện 496 dòng) khi gắn thêm composer và dock mobile                                                    | Cao        | Tách phần bố cục bàn viết sang `NovelcrafterWriteStage.tsx`, kéo `NovelcrafterStudioApp.tsx` xuống `< 380` dòng                                            |
| Chạy `Sửa bằng AI` hoặc `Viết bản thảo chương` ở tab Dàn ý ghi nhầm sang chương khác nếu `activeChapterId` chưa đồng bộ                                | Cao        | Khi chọn thẻ chương ở Dàn ý, gọi ngay `story.selectChapter(chapterId)` để đồng bộ với `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts:78-89` |
| Panel chi tiết 380px ở tab Dàn ý gây chật hoặc tràn ngang trên tablet/mobile `< 1280px`                                                                | Trung bình | Trên `xl+` hiển thị `<aside>` cố định 380px; dưới `xl` mở trong `Sheet` bên phải khi người dùng bấm chọn thẻ chương                                        |
| Mở `NovelcrafterHistoryPane` độc lập trong `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:84-104` bị lỗi thiếu prop composer | Thấp       | Đặt `composer` và `activeChapterId` là optional props trên `NovelcrafterHistoryPane`                                                                       |

### Lộ Trình

| Bước        | Nội dung                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------- |
| 5E          | **Plan này** — Khung soạn lệnh AI, chi tiết chương Dàn ý, dock mobile & nhóm hồi          |
| 6 (còn lại) | Codemod màu thô & alias token cũ, bật lint guard, type scale, `eslint-plugin-react-hooks` |

### 11. Ghi Chú Triển Khai

- **TDD & Kiểm thử đơn vị**: Viết trước 7 bộ test (`stateLimits.test.ts`, `chapterOutline.test.ts`, `NovelcrafterAiComposer.test.tsx`, `NovelcrafterOutlineDetailPanel.test.tsx`, `NovelcrafterOutlineBoard.test.tsx`, `NovelcrafterViewPanel.test.tsx`, `NovelcrafterMobileAiDock.test.tsx`) → xác nhận đỏ 7/7 trước khi viết code; sau khi triển khai xanh 228/228 file test (`1,824/1,824` ca).
- **Tách kích thước component**: `NovelcrafterStudioApp.tsx` tách bố cục bàn viết sang `NovelcrafterWriteStage.tsx` (292 dòng), giữ `NovelcrafterStudioApp.tsx` ở 446 dòng (< 500 dòng).
- **Phát hiện qua Playwright QA thực tế**: Ở giao diện tiếng Anh, `NovelcrafterAiComposer.tsx` ban đầu gọi `t("novelcrafterWriteMenuBtn")` (chỉ có trong `vi.ts`) → đã chuyển sang `t("novelcrafterSlotWrite")` có đủ cả `vi.ts` và `en.ts`.
- **Negative Probes & E2E**: Cả 4 Negative Probes `N1–N4` đều làm test tương ứng đỏ và đã hoàn tác sạch; `npx tsc --noEmit` và `npm run lint` sạch 0 lỗi; `tests/e2e/a11y.spec.ts` xanh 15/15; QA Playwright `/novelcrafter` ở `1440×900` và `375×812` xanh 2/2 (không tràn ngang, không vi phạm tên truy cập axe).

## Audit History

### Audit Run 1

[REVIEWER_MODEL: Gemini 4 Carbon (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5e-novelcrafter-composer-outline-dock-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`.
- Đối chiếu `useDirectStreamBridge.ts`, `useNovelcrafterStream.ts`, `NovelcrafterViewPanel.test.tsx`, `NovelcrafterOutlineBoard.test.tsx`, `NovelcrafterA11yNames.test.tsx`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                      | Bằng chứng                                                                                                                     | Lý do / Yêu cầu sửa                                                                                                                                                                                                          |
| --- | -------------- | ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts:78-89`             | [SRC] `handleStreamStarted` luôn ghi luồng `bible:scenes` và `bible:draft` vào chương có `id === currentState.activeChapterId` | Nếu bảng Dàn ý giữ `selectedOutlineChapterId` tách rời `story.activeChapter.id`, bấm `Sửa bằng AI` sẽ ghi đè phân cảnh nhầm chương! **Sửa (Revision 2)**: chọn thẻ chương ở Dàn ý phải gọi `story.selectChapter(chapterId)`. |
| 2   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterViewPanel.test.tsx:82-106` | [SRC] Ca test 5B kỳ vọng click thẻ chương ở Dàn ý gọi ngay `onReturnToWrite({ clearSelection: true })`                         | Khai báo tường minh ca test Loại C duy nhất trong §8 và kiểm chứng nút `"Mở trong bàn viết"` gọi `onReturnToWrite({ clearSelection: true })`.                                                                                |
| 3   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:84-104` | [SRC] Test 3D render `<NovelcrafterHistoryPane>` chỉ với 10 props cơ bản                                                       | Giữ `activeChapterId` và `composer` là props tùy chọn trên `NovelcrafterHistoryPane`.                                                                                                                                        |

#### Kết Luận

1 `[MAJOR]` về đồng bộ `activeChapterId` khi stream từ panel chi tiết Dàn ý → cập nhật Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: Gemini 4 Carbon (in-session); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5e-novelcrafter-composer-outline-dock-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` đã xử lý triệt để trong A1, §10 và `NovelcrafterViewPanel.tsx`: chọn chương trong Dàn ý đồng bộ `story.selectChapter(chapterId)`.
- Audit Run 1 #2 `[MINOR]` đã liệt kê đích danh tại §8 (1 ca Loại C duy nhất ở `NovelcrafterViewPanel.test.tsx:82-106`).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                        | Bằng chứng                                                                                                | Lý do / Hướng xử lý khi code                                                                                                     |
| --- | -------------- | ------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterOutlineBoard.test.tsx:70-86` | [SRC] TC-06 truyền `onOpenChapter` mà không truyền `onSelectChapter`                                      | Giữ fallback `onSelectChapter ? onSelectChapter(id) : onOpenChapter(id)` để TC-05..TC-07 giữ nguyên 100%.                        |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:419-435`             | [SRC] Các thẻ mới có `chapterId: opts.activeChapterId`, nhưng dữ liệu lịch sử cũ có thể thiếu `chapterId` | Khi bật lọc `"Chương này"`, chỉ lọc `card.chapterId === activeChapterId`, mặc định để `"Tất cả"` để thẻ cũ luôn hiển thị đầy đủ. |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:54-136`        | [SRC] File đang ở 496/500 dòng                                                                            | Tách `NovelcrafterWriteStage.tsx` giúp cả hai file dưới 380 dòng, tuân thủ chặt trần 500 dòng.                                   |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Ca Loại C duy nhất được liệt kê đích danh; Test Contract có ca âm tính (TC-01, TC-02) và Negative Probes N1–N4. Plan đạt chuẩn triển khai.

[PLAN_APPROVED]

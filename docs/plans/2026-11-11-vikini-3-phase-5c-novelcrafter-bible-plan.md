# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 5C: Novelcrafter — Hồ Sơ Truyện Hai Cột, Thẻ & Panel Nhân Vật, "Ẩn Khỏi AI" Từng Mục & Từng Trường

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Antigravity (in-session; PM đã ủy quyền chạy liền 4B → 6)
- **Depends on**: Giai đoạn 5B (commit `8b8c758`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: canvas board **NovelBible** (`NovelBible.dc.html`: mục lục hồ sơ bên trái 232px hiển thị số lượng mục và biểu tượng ẩn khỏi AI + chú thích cuối mục lục; cột nội dung chính ở giữa có bật/tắt "AI đọc được" theo từng mục và lưới thẻ nhân vật 2 cột có chữ cái đầu serif; panel chi tiết nhân vật bên phải 360px có tên gọi khác, 4 trường chi tiết "Ngoại hình / Tính cách / Quan hệ / Bí mật" mỗi trường có nút "Ẩn khỏi AI" riêng, và danh sách "Xuất hiện trong bản thảo" nhảy tới chương) cùng brief ("story bible with per-field 'hidden from AI'").

Hiện trạng:

- `StoryBibleWorkspace` khi mở toàn trang (`embedded={false}`) chỉ là một cột xếp chồng 880px; không có mục lục cố định.
- Chỉ 2 mục (`characters`, `worldbuilding`) có cờ `VisibleToAI`; 5 mục còn lại (`braindump`, `genre`, `style`, `synopsis`, `outline`) chưa thể ẩn khỏi AI.
- Thẻ nhân vật trong `StoryBibleStructuredCards.tsx` (hiện 531 dòng — vượt ngưỡng 500 dòng của component UI) chỉ là các ô `<input>` phẳng sửa trực tiếp trên lưới, chỉ có một trường `traits` chung và chưa có "Ẩn khỏi AI" theo từng trường hay thống kê xuất hiện trong bản thảo.

Mục tiêu 5C:

1. **Bố cục Hồ sơ đa cột (`StoryBibleWorkspace` khi `embedded={false}`)**:
   - **Cột trái — Mục lục hồ sơ (`StoryBibleTocSidebar`, 232px trên `md+`, thanh pill ngang gọn trên mobile)**: giữ tiêu đề `h2` (`novelcrafterStoryBibleTitle`), liệt kê 7 mục với trạng thái đang chọn (`--soft` / `--accent`), số lượng mục con (`characterCards`, `worldElements`, `outlineItems`) và biểu tượng `EyeOff` khi mục đang ẩn khỏi AI; chân mục lục hiển thị ghi chú giải thích cơ chế ẩn khỏi AI.
   - **Cột giữa — Nội dung Hồ sơ**: giữ đầy đủ 7 mục (`h3`), mọi mục đều có nút bật/tắt hiển thị với AI; giữ nguyên nhánh `embedded={true}` gọn cho khối gập dưới bản thảo ở tab Viết.
   - **Cột phải — Panel chi tiết nhân vật (`StoryBibleCharacterPanel`, `aside` 360px trên `xl+` hoặc `Sheet` trên màn hẹp khi chọn nhân vật)**: mở khi bấm một thẻ nhân vật trong lưới 2 cột.
2. **Thẻ nhân vật & Panel nhân vật theo canvas**:
   - Lưới thẻ nhân vật 2 cột: chữ cái đầu serif (`44×44 rounded-xl bg-(--raised) text-(--accent)`), tên, vai trò, mô tả ngắn, số lần xuất hiện trong bản thảo; bấm thẻ chọn nhân vật (`aria-pressed`, viền `--accent`).
   - Panel chi tiết nhân vật: avatar chữ cái đầu `56×56`, ô sửa tên & vai trò, tên gọi khác (aliases), ghim `alwaysInclude`, bật/tắt ẩn cả nhân vật khỏi AI, xóa nhân vật, **4 trường có nút "Ẩn khỏi AI" độc lập** (`appearance` — Ngoại hình, `traits` — Tính cách, `relationships` — Quan hệ, `secret` — Bí mật, mặc định ẩn với AI trừ khi bật), và khối **"Xuất hiện trong bản thảo"** (`Ch. N · K lần` + `Dàn ý Ch. M`, bấm nhảy sang chương ở tab Viết).
3. **Thực thi "Ẩn khỏi AI" xuyên suốt pipeline**:
   - Mở rộng `StoryBibleSchema` và `StoryBibleCharacterCardSchema` bằng các trường `.optional()` tương thích ngược 100% với dữ liệu cũ.
   - `storyBibleSerializer.ts`, `storyBibleDependencies.ts`, `pruneStoryBibleForStream.ts` và `storyBibleLimits.ts` tôn trọng đầy đủ cờ ẩn từng mục và từng trường nhân vật (trường ẩn không đưa vào prompt gửi AI và bị cắt khỏi payload stream).
4. **Giữ kỷ luật kích thước file**: tách logic giới hạn Hồ sơ sang `storyBibleLimits.ts` (`stateLimits.ts` 420 → < 350 dòng) và tách nhân vật khỏi `StoryBibleStructuredCards.tsx` (531 → < 320 dòng).

**Out of Scope (What We're NOT Doing)**:

- **Trang Cài đặt AI dạng bảng kế thừa + Prompt Studio gộp chung** — Giai đoạn 5D.
- **Khung soạn lệnh AI, panel chi tiết chương ở Dàn ý, dock mobile, nhóm chương theo hồi** — Giai đoạn 5E.
- **Chuyển ô Thể loại từ chuỗi tự do sang chip tag rời** — giữ `<input>` văn bản hiện có để không làm mất mô tả thể loại tự do của người dùng.
- **Codemod toàn repo màu thô / alias token cũ** — Giai đoạn 6 (các file mới/chạm tới trong 5C dùng token Vikini 3.0).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                                           | Nội dung rút ra                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas `NovelBible.dc.html`                                                                                                                                   | TOC 232px + icon ẩn + số lượng; lưới thẻ nhân vật 2 cột có chữ cái đầu serif; panel nhân vật 360px có 4 trường kèm "Ẩn khỏi AI" riêng + chip xuất hiện theo chương |
| `src/lib/features/novelcrafter/types.ts`, `stateLimits.ts`                                                                                                    | Schema `StoryBible`, `StoryBibleCharacterCard` và chuẩn hóa giới hạn (A1, A2)                                                                                      |
| `src/lib/features/novelcrafter/storyBibleSerializer.ts`, `storyBibleDependencies.ts`, `pruneStoryBibleForStream.ts`, `codexMatcher.ts`                        | Luồng ghép ngữ cảnh gửi AI và khớp tên/bí danh nhân vật trong văn bản (A3–A5)                                                                                      |
| `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`, `StoryBibleSectionCard.tsx`, `StoryBibleStructuredCards.tsx`, `NovelcrafterViewPanel.tsx` | Cấu trúc Hồ sơ hiện tại, cấp heading TC-08, vượt ngưỡng dòng ở `StoryBibleStructuredCards.tsx` (A6–A8)                                                             |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                          | Quyết định kỹ thuật chịu ảnh hưởng                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn mục lục, 4 trường nhân vật, thống kê xuất hiện                                | Thêm key song ngữ đồng thời ở `vi.ts` và `en.ts`, chỉ dùng `useLanguage()` |
| `.agents/skills/vikini-investigate/SKILL.md` | Đổi `StoryBibleSchema` và serializer dùng chung ở `src/lib/features/novelcrafter/` | Mọi trường mới đều `.optional()` để 0 caller / 0 test cũ bị vỡ             |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                                         | Bằng chứng                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `StoryBibleCharacterCardSchema` hiện có `id`, `name`, `role`, `traits`, `visibleToAI`, `aliases?`, `alwaysInclude?`; `StoryBibleSchema` mới chỉ có `charactersVisibleToAI` và `worldbuildingVisibleToAI` | `[SRC]` `src/lib/features/novelcrafter/types.ts:149-158`, `src/lib/features/novelcrafter/types.ts:180-197`                                                           |
| A2  | `stateLimits.ts` chuẩn hóa `storyBible` trong `coerceStoryStateToLimits` và đang dài 420 dòng                                                                                                            | `[SRC]` `src/lib/features/novelcrafter/stateLimits.ts:246-262`                                                                                                       |
| A3  | `serializeStoryBibleWithStructuredCards` nối các thẻ nhân vật hiển thị thành khối `### Name (Role)` + `Aliases:` + `traits`                                                                              | `[SRC]` `src/lib/features/novelcrafter/storyBibleSerializer.ts:19-37`                                                                                                |
| A4  | `selectStoryBibleDependencies` và `pruneStoryBibleForStream` kiểm tra `charactersVisibleToAI` / `worldbuildingVisibleToAI` trước khi gửi ngữ cảnh cho stream                                             | `[SRC]` `src/lib/features/novelcrafter/storyBibleDependencies.ts:42-66`, `src/lib/features/novelcrafter/pruneStoryBibleForStream.ts:63-98`                           |
| A5  | `codexMatcher.ts` đã có quy tắc khớp từ biên Unicode & CJK (`doesCodexTermMatchContext`) cho tên và bí danh                                                                                              | `[SRC]` `src/lib/features/novelcrafter/codexMatcher.ts:41-53`                                                                                                        |
| A6  | `StoryBibleWorkspace` khi `embedded={false}` phải giữ 0 `h1`, đúng 1 `h2` (`novelcrafterStoryBibleTitle`) và các mục `h3` theo TC-08 của 5B                                                              | `[SRC]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:90`, `src/app/features/novelcrafter/components/StoryBibleWorkspace.test.tsx:29-34`         |
| A7  | `StoryBibleStructuredCards.tsx` hiện dài 531 dòng; `NovelcrafterA11yNames.test.tsx` import trực tiếp `StoryBibleOutlineItemsList` từ file này                                                            | `[SRC]` `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx:35-243`, `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:9` |
| A8  | `NovelcrafterViewPanel` đang giữ `story.storyState.chapters` và callback mở chương về tab Viết, có thể truyền thẳng xuống `StoryBibleWorkspace`                                                          | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterViewPanel.tsx:86-102`                                                                                  |

**Quyết định sản phẩm (theo canvas NovelBible, ghi lại)**:

- **D1** Bốn trường chi tiết nhân vật gồm: `appearance` (Ngoại hình), `traits` (Tính cách — giữ nguyên dữ liệu cũ), `relationships` (Quan hệ), `secret` (Bí mật). Ba trường đầu mặc định hiển thị cho AI (`!== false`); riêng **Bí mật** mặc định **ẩn khỏi AI** (`=== true` mới gửi AI) đúng tinh thần canvas ("Bí mật: Ẩn khỏi AI").
- **D2** Khi `embedded={true}` (khối Hồ sơ gập dưới bản thảo trong tab Viết), không dựng cột TOC 232px để tránh chật khung soạn thảo; bấm thẻ nhân vật mở `Sheet` chi tiết nhân vật. Khi `embedded={false}` (tab Hồ sơ toàn trang), hiển thị TOC cột trái + nội dung giữa + panel chi tiết nhân vật bên phải trên `xl+` (`Sheet` dưới `xl`).
- **D3** Cờ ẩn cấp mục (`braindumpVisibleToAI`, `genreVisibleToAI`, `styleVisibleToAI`, `synopsisVisibleToAI`, `outlineVisibleToAI`) mặc định `true` khi `undefined`; khi đặt `false`, mục đó được loại khỏi `selectStoryBibleDependencies` và `pruneStoryBibleForStream` (riêng khi người dùng chủ động bấm "Viết lại bằng AI" ngay trên chính mục đó, dữ liệu hiện tại của mục vẫn gửi ở `<current_section>` nhưng không rò sang các bước khác).

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                                                           | Nguồn                     |
| ------------------ | -------------- | --------- | ----------------------------------------------------------------- | ------------------------- |
| `react`            | `^19.2.3`      | 19.2      | Component state & `useId`                                         | `[SRC]` `package.json:69` |
| `zod`              | `^4.2.1`       | 4.2       | Schema `.optional()` cho `StoryBible` & `StoryBibleCharacterCard` | `[SRC]` `package.json:80` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/lib/features/novelcrafter/types.ts` — thêm các trường `.optional()` cho ẩn/hiện cấp mục (`braindumpVisibleToAI`, `genreVisibleToAI`, `styleVisibleToAI`, `synopsisVisibleToAI`, `outlineVisibleToAI`) và 4 trường chi tiết + cờ ẩn từng trường trên `StoryBibleCharacterCardSchema`.
- `[NEW]` `src/lib/features/novelcrafter/storyBibleLimits.ts` + `.test.ts` — tách chuẩn hóa `StoryBible` (`normalizeCharacterCards`, `normalizeWorldElements`, `normalizeOutlineItems`, `normalizeStoryBible`) khỏi `stateLimits.ts`, hỗ trợ đầy đủ trường mới.
- `[MODIFY]` `src/lib/features/novelcrafter/stateLimits.ts` — ủy quyền sang `storyBibleLimits.ts` (giảm từ 420 xuống < 330 dòng).
- `[MODIFY]` `src/lib/features/novelcrafter/storyBibleSerializer.ts` + `.test.ts` — serialize `appearance`, `traits`, `relationships`, `secret` theo cờ hiển thị từng trường (giữ nguyên định dạng cũ khi chỉ có `traits`).
- `[MODIFY]` `src/lib/features/novelcrafter/storyBibleDependencies.ts` + `.test.ts` — tôn trọng cờ `*VisibleToAI` cho cả 7 mục.
- `[MODIFY]` `src/lib/features/novelcrafter/pruneStoryBibleForStream.ts` + `.test.ts` — cắt mục ẩn và trường nhân vật ẩn khỏi payload gửi stream.
- `[NEW]` `src/lib/features/novelcrafter/characterMentions.ts` + `.test.ts` — đếm số lần nhân vật (tên + bí danh) xuất hiện trong bản thảo từng chương và trong dàn ý/tóm tắt chương.
- `[NEW]` `src/app/features/novelcrafter/components/StoryBibleTocSidebar.tsx` — cột mục lục trái (desktop `aside` + thanh pill mobile) hiển thị `h2` tiêu đề Hồ sơ, số lượng mục con, icon `EyeOff` và ghi chú chân trang.
- `[NEW]` `src/app/features/novelcrafter/components/StoryBibleCharacterPanel.tsx` — nội dung chi tiết nhân vật (tên, vai trò, bí danh, ghim, 4 trường kèm công tắc "Ẩn khỏi AI" từng trường, chip xuất hiện theo chương).
- `[NEW]` `src/app/features/novelcrafter/components/StoryBibleCharactersSection.tsx` + `.test.tsx` — lưới thẻ nhân vật 2 cột theo canvas + kết nối chọn nhân vật.
- `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx` — chuyển `StoryBibleCharacterCardsList` sang re-export từ `StoryBibleCharactersSection.tsx` để giữ tương thích và giảm file xuống < 320 dòng.
- `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx` + `.test.tsx` — bố cục 2–3 cột khi `embedded={false}`, công tắc hiển thị AI cho cả 7 mục, kết nối panel nhân vật và nhảy sang chương.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterViewPanel.tsx` — truyền `chapters` và `onOpenChapter` vào `StoryBibleWorkspace`.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — các key song ngữ cho TOC, 4 trường nhân vật, trạng thái ẩn từng trường và thống kê xuất hiện.
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 Schema & Per-Field Visibility (`types.ts` / `storyBibleSerializer.ts`)**

```ts
export function isCharacterFieldVisibleToAi(
  card: StoryBibleCharacterCard,
  field: "appearance" | "traits" | "relationships" | "secret"
): boolean {
  if (field === "secret") return card.secretVisibleToAI === true;
  if (field === "appearance") return card.appearanceVisibleToAI !== false;
  if (field === "relationships") return card.relationshipsVisibleToAI !== false;
  return card.traitsVisibleToAI !== false;
}
// (Revision 2) pruneStoryBibleForStream:
// - braindump chỉ giữ khi storyBible.braindumpVisibleToAI !== false && needsBraindump
// - synopsis / outline: giữ khi (<mục>VisibleToAI !== false && (!nodeSet || nodeSet.has(...))) || isTarget(<mục>)
//   để bấm "Viết lại bằng AI" ngay trên mục đang ẩn không ném ValidationError rỗng ở src/lib/features/novelcrafter/featureDirectives.ts:111
```

**6.2 Đếm xuất hiện nhân vật (`characterMentions.ts`)**

```ts
export interface CharacterChapterMention {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  proseCount: number;
  inOutline: boolean;
}
export function computeCharacterMentions(
  card: Pick<StoryBibleCharacterCard, "name" | "aliases">,
  chapters: readonly Pick<NovelcrafterChapter, "id" | "title" | "content" | "scenes" | "summary">[]
): { items: CharacterChapterMention[]; totalProseCount: number };
```

**6.3 Bố cục `StoryBibleWorkspace` khi `embedded={false}`**

```tsx
<div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-(--bg)">
  <StoryBibleTocSidebar
    storyBible={storyBible}
    activeSection={currentSection}
    onSelectSection={handleSelectSection}
    onClose={onClose}
  />
  <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
    {sectionsContent}
  </div>
  {selectedCharacter && (
    <aside
      aria-label={`${t("novelcrafterCharacterDetailLabel")} ${selectedCharacter.name}`}
      className="hidden xl:flex w-[360px] shrink-0 border-l border-(--line) bg-(--surface) overflow-y-auto"
    >
      <StoryBibleCharacterPanel … />
    </aside>
  )}
</div>
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: viết/cập nhật test cho `characterMentions`, `storyBibleLimits`, `storyBibleSerializer`, `storyBibleDependencies`, `pruneStoryBibleForStream`, `StoryBibleCharactersSection`, `StoryBibleWorkspace` → xác nhận **đỏ**.
- [ ] **B2 — Tầng dữ liệu & serializer (`src/lib/features/novelcrafter/`)**: mở rộng schema `.optional()`, tách `storyBibleLimits.ts`, cập nhật serializer / dependencies / pruner + `characterMentions.ts`.
- [ ] **B3 — Tầng giao diện Hồ sơ (`src/app/features/novelcrafter/components/`)**: tạo `StoryBibleTocSidebar`, `StoryBibleCharacterPanel`, `StoryBibleCharactersSection`; cập nhật `StoryBibleStructuredCards`, `StoryBibleWorkspace`, `NovelcrafterViewPanel` + i18n `vi.ts`/`en.ts`.
- [ ] **B4 — Verify**: `tsc --noEmit`, `npm run lint`, `vitest run`, kiểm tra dòng mọi file chạm tới, Negative Probes N1–N4, E2E `a11y.spec.ts` + QA Playwright `/novelcrafter` tab Hồ sơ ở 1440px và 375px.
- [ ] **B5 — Ghi chú triển khai, CHANGELOG**, commit, push nhánh và fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                                                                  | Input                                                                                                                                                                        | Kỳ vọng                                                                                                                                                                                                     |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `characterMentions.test.ts`                                           | Nhân vật "Ông Tư" có bí danh "ông lái đò"; 2 chương (chương 1 có 2 lần trong bản thảo, chương 2 chỉ có trong `scenes`); nhân vật tên 1 ký tự / rỗng (Negative)               | `totalProseCount = 2`, chương 1 `proseCount: 2`, chương 2 `inOutline: true, proseCount: 0`; tên < 2 ký tự trả danh sách rỗng                                                                                |
| TC-02 | `storyBibleSerializer.test.ts`                                        | Thẻ nhân vật có `appearance`, `traits` (`traitsVisibleToAI: false`), `relationships`, `secret` (mặc định ẩn vs `secretVisibleToAI: true`)                                    | Mặc định loại cả `traits` (đã tắt) và `secret` (ẩn mặc định) khỏi chuỗi gửi AI (Negative); khi `secretVisibleToAI: true` mới xuất hiện `Secret:`                                                            |
| TC-03 | `storyBibleDependencies.test.ts` & `pruneStoryBibleForStream.test.ts` | `braindumpVisibleToAI: false`, `genreVisibleToAI: false`, `styleVisibleToAI: false`, `synopsisVisibleToAI: false`, `outlineVisibleToAI: false` + thẻ nhân vật có `secret` ẩn | Các mục tắt bị loại khỏi dependencies và bị xóa rỗng trong payload `pruneStoryBibleForStream`; `secret` ẩn bị lược bỏ khỏi thẻ gửi đi                                                                       |
| TC-04 | `storyBibleLimits.test.ts`                                            | Dữ liệu thô có các cờ `*VisibleToAI` và 4 trường nhân vật vượt 2.000 ký tự                                                                                                   | Giữ nguyên boolean hợp lệ, cắt chuỗi đúng trần 2.000 ký tự, dữ liệu cũ thiếu trường vẫn chuẩn hóa an toàn                                                                                                   |
| TC-05 | `StoryBibleCharactersSection.test.tsx`                                | 2 nhân vật, chọn nhân vật 2, bấm công tắc "Ẩn khỏi AI" của trường Ngoại hình, bấm chip chương xuất hiện                                                                      | Thẻ 2 có `aria-pressed="true"` + viền `--accent`; bật/tắt gọi `onUpdateStoryBible` với `appearanceVisibleToAI: false`; bấm chip chương gọi `onOpenChapter("c1")`                                            |
| TC-06 | `StoryBibleWorkspace.test.tsx`                                        | `embedded={false}` với 1 nhân vật và `braindumpVisibleToAI: false`                                                                                                           | Giữ nguyên TC-08 (0 `h1`, 1 `h2` tên `novelcrafterStoryBibleTitle`, các mục `h3`); có `aside` mục lục hiển thị số lượng nhân vật `"1"` và chỉ báo ẩn trên mục `braindump`; bấm mục trong TOC cuộn/mở mục đó |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có**. Toàn bộ trường mới là `.optional()`, giữ nguyên hành vi mặc định và giữ nguyên TC-08 của `StoryBibleWorkspace.test.tsx` cũng như re-export trong `StoryBibleStructuredCards.tsx`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/lib/features/novelcrafter src/app/features/novelcrafter --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**:

- **W1**: `StoryBibleWorkspace.tsx`, `StoryBibleStructuredCards.tsx`, `StoryBibleCharactersSection.tsx`, `StoryBibleCharacterPanel.tsx`, `StoryBibleTocSidebar.tsx` đều `< 500` dòng; `stateLimits.ts`, `storyBibleLimits.ts`, `characterMentions.ts` đều `< 400` dòng.
- **W2**: QA Playwright `/novelcrafter` (1440px + 375px): mở tab "Hồ sơ" thấy mục lục trái + nội dung giữa; thêm nhân vật → bấm thẻ nhân vật mở panel chi tiết phải → sửa Ngoại hình / Bí mật + bật/tắt "Ẩn khỏi AI" → không tràn ngang ở 375px, axe tên truy cập sạch.

**Negative Probes** (hoàn tác ngay sau mỗi probe):

- **N1**: Trong `storyBibleSerializer.ts`, đổi điều kiện `secret` từ `=== true` thành `!== false` → TC-02 đỏ.
- **N2**: Trong `storyBibleDependencies.ts`, bỏ kiểm tra `genreVisibleToAI !== false` → TC-03 đỏ.
- **N3**: Trong `StoryBibleCharactersSection.tsx`, bỏ `aria-pressed` trên thẻ nhân vật → TC-05 đỏ.
- **N4**: Trong `StoryBibleTocSidebar.tsx`, đổi `h2` thành `h1` → TC-06 / TC-08 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                         | Mức        | Control                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ba cột trên màn hình `md` (768–1024px) làm cột giữa quá hẹp khi mở thêm panel nhân vật 360px                   | Trung bình | Cột TOC hiện từ `md:` (232px), nhưng panel nhân vật chỉ neo cố định bên phải từ `xl:` (≥ 1280px); dưới `xl` mở bằng `Sheet` trượt phải để cột giữa luôn ≥ 500px |
| Thêm trường bắt buộc vào `StoryBible` làm gãy hàng loạt fixture test cũ                                        | Cao        | Mọi trường mới trong Zod schema đều dùng `.optional()`, định nghĩa giá trị mặc định tại hàm đọc                                                                 |
| Panel nhân vật render thêm thẻ `h2` làm gãy ràng buộc heading của trang (`StoryBibleWorkspace.test.tsx` TC-08) | Trung bình | Tên nhân vật trong panel dùng thẻ `<p>` serif 24px (giống `<span>` trong `NovelBible.dc.html`), giữ đúng một `h2` duy nhất cho Hồ sơ                            |

### Lộ Trình

| Bước | Nội dung                                                                                   |
| ---- | ------------------------------------------------------------------------------------------ |
| 5C   | **Plan này** — Hồ sơ truyện hai cột + panel nhân vật + "Ẩn khỏi AI" từng mục & từng trường |
| 5D   | Trang Cài đặt AI của truyện dạng bảng kế thừa + Prompt Studio                              |
| 5E   | Khung soạn lệnh AI, panel chi tiết chương, dock mobile, nhóm chương theo hồi               |

### 11. Ghi Chú Triển Khai

- Tách `storyBibleLimits.ts` (179 dòng) khỏi `stateLimits.ts` (giảm từ 420 xuống 305 dòng) để chuẩn hóa cờ `*VisibleToAI` của cả 7 mục và 4 trường nhân vật (`appearance`, `traits`, `relationships`, `secret`, giới hạn `2.000` ký tự/trường).
- `storyBibleDependencies.ts` và `pruneStoryBibleForStream.ts` chặn fallback sang `braindump` khi `synopsisVisibleToAI === false` hoặc `braindumpVisibleToAI === false`, đồng thời xóa trường nhân vật bị ẩn khỏi payload stream (`secret` mặc định ẩn `=== true`).
- Tách `StoryBibleTocSidebar.tsx` (158 dòng), `StoryBibleCharactersSection.tsx` (220 dòng), `StoryBibleCharacterPanel.tsx` (370 dòng, gồm cả `StoryBibleCharacterSheet`), giữ `StoryBibleWorkspace.tsx` ở 494 dòng (`< 500`) và `StoryBibleStructuredCards.tsx` ở 323 dòng. Panel chi tiết nhân vật neo `<aside>` từ `lg:` (`min-width: 1024px`, `320px` / `xl:360px`) và tự chuyển sang `Sheet` dưới `lg` hoặc khi `embedded={true}` để tương thích đồng nhất trên jsdom (`1024px`), desktop (`1440px`) và mobile (`375px`).
- Kiểm tra: TC-01…TC-06 xanh; `tsc`, `lint` sạch; vitest toàn repo 1984/1986 (2 lỗi governance có từ trước); Negative Probes N1–N4 đều đỏ như kỳ vọng; e2e `a11y.spec.ts` 15/15; QA Playwright `/novelcrafter` ở 1440px và 375px xanh 2/2 (mục lục trái, ẩn mục khỏi AI hiện icon ở TOC, thêm nhân vật 2 cột, sửa Ngoại hình/Bí mật + công tắc trường, nhảy từ chip chương về tab Viết đúng chương, Sheet trên mobile không tràn ngang, axe tên truy cập sạch).

## Audit History

### Audit Run 1

[REVIEWER_MODEL: Gemini 4 Carbon (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5c-novelcrafter-bible-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- Đối chiếu thêm `featureDirectives.ts` và `pruneStoryBibleForStream.ts` cho luồng Rewrite mục đang ẩn.

#### Critic Findings

| #   | Loại          | Mức     | `file:line`                                                              | Bằng chứng                                                                                                                    | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                               |
| --- | ------------- | ------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT        | [MAJOR] | `src/lib/features/novelcrafter/featureDirectives.ts:111-115`             | [SRC] `buildBibleDirective` ném `ValidationError` nếu `mode === "rewrite"` mà `currentSectionValue` rỗng và không có `custom` | Nếu `src/lib/features/novelcrafter/pruneStoryBibleForStream.ts:63-73` xóa `synopsis`/`outline` khi `synopsisVisibleToAI === false` cả lúc `isTarget("synopsis")`, bấm "Viết lại bằng AI" ngay trên mục đó sẽ lỗi. **Sửa (Revision 2)**: giữ mục đích khi `isTarget(target)` ở pruner, còn mọi bước khác cắt sạch. |
| 2   | DEFECT        | [MINOR] | `src/lib/features/novelcrafter/pruneStoryBibleForStream.ts:76`           | [SRC] `braindump: needsBraindump ? storyBible.braindump : ""` chưa xét `braindumpVisibleToAI`                                 | Khi `synopsis` rỗng, `needsBraindump` = `true` sẽ gửi `braindump` lên server dù người dùng đã ẩn `braindump`. **Sửa**: thêm `storyBible.braindumpVisibleToAI !== false` ở cả `storyBibleDependencies.ts` và `pruneStoryBibleForStream.ts`.                                                                        |
| 3   | RISK_ACCEPTED | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx:91-99` | [SRC] State trong `StoryBibleWorkspace` lưu theo key/id                                                                       | Panel chi tiết nhân vật chỉ lưu `selectedCharacterId: string \| null` và tra ngược từ `storyBible.characterCards` để khi xóa thẻ nhân vật panel tự đóng, không giữ bản sao cũ.                                                                                                                                    |

#### Kết Luận

1 `[MAJOR]` → cập nhật Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: Gemini 4 Carbon (in-session); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5c-novelcrafter-bible-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` và #2 `[MINOR]` đã ghi rõ quy tắc trong §6.1 và được bảo vệ bởi TC-03 + Negative Probe N1/N2.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                 | Bằng chứng                                                                       | Lý do / Hướng xử lý khi code                                                                                                                        |
| --- | -------------- | ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/lib/features/novelcrafter/pruneStoryBibleForStream.test.ts:100-112`    | [SRC] Ca cũ kiểm tra `charactersVisibleToAI: false` với `feature = "write"`      | Giữ nguyên hành vi cho `charactersVisibleToAI` và `worldbuildingVisibleToAI` khi không phải target trực tiếp; ca cũ giữ xanh.                       |
| 2   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:9` | [SRC] Import `{ StoryBibleOutlineItemsList } from "./StoryBibleStructuredCards"` | `StoryBibleOutlineItemsList` vẫn nằm tại `StoryBibleStructuredCards.tsx` và re-export `StoryBibleCharacterCardsList` để không đổi mặt phẳng import. |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleWorkspace.test.tsx:33`  | [SRC] TC-08 khẳng định `getAllByRole("heading", { level: 2 })` có độ dài 1       | `StoryBibleTocSidebar` giữ đúng 1 `h2` (`novelcrafterStoryBibleTitle`); tên nhân vật trong panel phải dùng `<p>` serif thay vì `h2`.                |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-01, TC-02) và Negative Probes N1–N4; 0 ca Loại C. Plan đạt chuẩn triển khai.

[PLAN_APPROVED]

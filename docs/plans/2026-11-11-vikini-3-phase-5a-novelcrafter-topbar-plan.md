# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 5A: Novelcrafter — Gọn Thanh Trên (H1), "Cài đặt AI" + Menu "⋯"

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: claude-fable-5-2]`)
- **Depends on**: Giai đoạn 4B (commit `8babace`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: audit **H1** ("Novelcrafter quá tải thông tin … hàng 1 chỉ giữ tiêu đề, trạng thái lưu, model và menu '⋯' … chuyển Master GEM/Persona/Prompt Studio/Themes vào sheet Settings … có 3 nút 'nổi bật' cùng lúc"), canvas board **Novel** (header: tiêu đề, "Đã lưu", Aa, Phiên bản, tập trung, "⋯ Thêm: xuất bản thảo…") và **NovelAI** ("Cài đặt AI của truyện": GEM tổng + Persona tổng + từng tính năng).

Hiện trạng (ảnh quét 1440px): thanh trên có 11 control — nút bật panel, tiêu đề, trạng thái, Model, huy hiệu "Master GEM", huy hiệu "Master Persona", nút accent "GEM & Persona Routing", "Prompt Studio", "Export Manuscript", "EN", "Themes", nút panel thẻ AI. Ba control (2 huy hiệu + nút accent) cùng mở **một** hộp thoại.

1. **Một nút "Cài đặt AI"** thay cho 2 huy hiệu + nút accent: nút viền thường (không accent) mở hộp thoại ghép tầng GEM/Persona sẵn có; `title` cho biết GEM tổng và Persona tổng đang dùng. Hộp thoại đổi tiêu đề thành **"Cài đặt AI của truyện"** (canvas NovelAI).
2. **Menu "⋯" (Thêm)** gom các việc ít dùng: Quản lý Prompt (liên kết), Xuất bản thảo (2 tùy chọn kèm + Markdown / Văn bản thuần), Ngôn ngữ (đổi VI/EN), Giao diện (menu con các theme).
3. **Thanh trên còn 6 control**: nút panel mục lục · tiêu đề (chữ serif nghiêng như canvas) · trạng thái lưu + số từ · Model · Cài đặt AI · ⋯ · nút panel thẻ AI. Không còn cuộn ngang trên mobile; không còn nút accent ở thanh trên (nút nổi bật duy nhất của màn hình là "Bản nháp đầu" ở thanh công cụ AI).
4. Token + chữ: nền `--bg`, viền `--line`; bỏ `uppercase` của nút ngôn ngữ.

**Out of Scope (What We're NOT Doing)** — canvas vẽ lại gần như toàn bộ Novelcrafter; các phần sau là **bề mặt sản phẩm mới**, cần plan riêng (5B–5E) và không làm trong đợt này:

- **5B** Tab chế độ xem "Viết / Dàn ý / Hồ sơ" và bảng **Dàn ý theo hồi** (thẻ chương có trạng thái, panel chi tiết chương, "AI sẽ đọc khi viết chương này").
- **5C** Trang **Hồ sơ truyện** hai cột (mục lục hồ sơ, thẻ nhân vật, panel nhân vật, "Ẩn khỏi AI" theo từng trường).
- **5D** Trang **Cài đặt AI của truyện** dạng bảng kế thừa + Prompt Studio trong cùng màn hình (hiện là hộp thoại + trang `/novelcrafter/prompts` riêng).
- **5E** Khung soạn lệnh AI trong panel thẻ AI (một hành động + cách viết + độ dài + nguồn prompt), thanh công cụ AI mobile dạng dock, mục tiêu số từ trong ngày.
- Thanh công cụ AI hàng 2 và thanh định dạng bản thảo: đã tự co vào "Công cụ khác" ở màn hẹp, giữ nguyên.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                                  | Nội dung rút ra                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Canvas `Novel.dc.html`, `NovelMobile.dc.html`, `NovelOutline.dc.html`, `NovelBible.dc.html`, `NovelAI.dc.html`                                       | Header gọn + "⋯"; quy mô các bề mặt mới (5B–5E)                                                          |
| Audit UX mục H1                                                                                                                                      | ~25 control trên 3 hàng; 3 nút nổi bật                                                                   |
| `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`, `NovelcrafterStudioApp.tsx`, `GemPersonaRoutingModal.tsx`, `ChapterAiToolbar.tsx` | A1–A6                                                                                                    |
| `src/components/ui/dropdown-menu.tsx`                                                                                                                | Có sẵn `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuCheckboxItem` |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                        | Lý do nạp                 | Quyết định kỹ thuật chịu ảnh hưởng                                                              |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md` | Nhãn "Cài đặt AI", "Thêm" | Đổi giá trị key có sẵn + thêm key mới ở **cả** `vi.ts`/`en.ts`; giữ tên key đang được test dùng |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                         | Bằng chứng                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Header `flex-wrap`, nhóm phải `overflow-x-auto` trên mobile                                                                              | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:126`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:163-164`     |
| A2  | 2 huy hiệu Master GEM/Persona và nút accent đều gọi `onOpenRoutingModal`                                                                 | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:213-245`                                                                            |
| A3  | Prompt Studio là `Link` `/novelcrafter/prompts`; Xuất bản thảo là `DropdownMenu` riêng có 2 checkbox + 2 định dạng                       | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:247-255`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:257-319` |
| A4  | Nút ngôn ngữ (`uppercase`, ẩn dưới `md`) và menu Giao diện (ẩn dưới `md`) — trên mobile hiện **không** đổi được ngôn ngữ/giao diện ở đây | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:321-352`                                                                            |
| A5  | Chỉ `NovelcrafterStudioApp` dùng `NovelcrafterTopBar`; props giữ nguyên được                                                             | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:333`                                                                             |
| A6  | Test 3D khẳng định nút có tên + `aria-label` = `novelcrafterRoutingButton`                                                               | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:77-81`                                                                      |
| A7  | Tiêu đề hộp thoại dùng key `novelcrafterRoutingTitle`                                                                                    | `[SRC]` `src/app/features/novelcrafter/components/GemPersonaRoutingModal.tsx:65`                                                                             |

**Quyết định sản phẩm (đã chọn mặc định, ghi lại)**:

- **D1** GEM tổng / Persona tổng không còn hiện chữ trên thanh; xem qua `title` của nút "Cài đặt AI" và trong hộp thoại. (Canvas đặt thông tin này ở khung soạn lệnh AI — thuộc 5E.)
- **D2** Ngôn ngữ và Giao diện vào menu "⋯" (đồng thời dùng được trên mobile, trước đây bị ẩn).
- **D3** Giữ hộp thoại ghép tầng hiện có, chỉ đổi tên; trang riêng theo canvas để 5D.

### 4. Bảng Verified Versions

| Thư viện / Công cụ              | `package.json` | Phiên bản | Ghi chú                       | Nguồn                     |
| ------------------------------- | -------------- | --------- | ----------------------------- | ------------------------- |
| `@radix-ui/react-dropdown-menu` | `^2.1.16`      | 2.1.x     | Menu "⋯" + menu con Giao diện | `[SRC]` `package.json:44` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterTopBarMenu.tsx` — menu "⋯" (§6.2), giữ `NovelcrafterTopBar.tsx` dưới 400 dòng.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.test.tsx` — TC-01…TC-05.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx` — bỏ 2 huy hiệu, nút Prompt Studio/Xuất/Ngôn ngữ/Giao diện rời; nút "Cài đặt AI"; dùng `NovelcrafterTopBarMenu`; token.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — đổi giá trị `novelcrafterRoutingButton` ("Cài đặt AI" / "AI settings"), `novelcrafterRoutingTitle` ("Cài đặt AI của truyện" / "Story AI settings"); key mới `novelcrafterMoreMenu` ("Thêm" / "More"), `novelcrafterAiSettingsSummary` ("GEM tổng: {gem} · Persona tổng: {persona}" / "Master GEM: {gem} · Master Persona: {persona}"), `novelcrafterLanguageSwitch` ("Ngôn ngữ: {lang}" / "Language: {lang}").
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 `NovelcrafterTopBar` (nhóm phải)**

```tsx
{/* trạng thái lưu như cũ */}
<ModelSelector … />
<button type="button" onClick={onOpenRoutingModal} aria-label={t("novelcrafterRoutingButton")} title={aiSummary}
  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) px-2.5 sm:px-3 text-xs font-medium text-(--text) hover:bg-(--raised) …">
  <Settings2 aria-hidden="true" className="h-3.5 w-3.5 text-(--accent)" />
  <span className="hidden sm:inline">{t("novelcrafterRoutingButton")}</span>
</button>
<NovelcrafterTopBarMenu onExportManuscript={onExportManuscript} />
{/* nút panel thẻ AI như cũ */}
```

`aiSummary = t("novelcrafterAiSettingsSummary")` với `{gem}` = tên GEM tổng hoặc `novelcrafterNoMasterGem`, `{persona}` tương tự.

**6.2 `NovelcrafterTopBarMenu`**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button type="button" aria-label={t("novelcrafterMoreMenu")} title={t("novelcrafterMoreMenu")} className="h-9 w-9 …"><MoreHorizontal aria-hidden="true" /></button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-64">
    <DropdownMenuItem asChild><Link href="/novelcrafter/prompts"><ScrollText /> {t("novelcrafterPromptStudioOpen")}</Link></DropdownMenuItem>
    {onExportManuscript && (<>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{t("novelcrafterExportMenuBtn")}</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked={includeBible} …>{t("novelcrafterExportIncludeBible")}</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={includeSummaries} …>{t("novelcrafterExportIncludeSummaries")}</DropdownMenuCheckboxItem>
      <DropdownMenuItem onClick={() => onExportManuscript({ format: "md", … })}>{t("novelcrafterExportMarkdownBtn")}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onExportManuscript({ format: "txt", … })}>{t("novelcrafterExportPlainTextBtn")}</DropdownMenuItem>
    </>)}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => setLanguage(language === "vi" ? "en" : "vi")}><Globe /> {t("novelcrafterLanguageSwitch").replace("{lang}", language === "vi" ? "Tiếng Việt" : "English")}</DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger><Palette /> {t("themes")}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-80 overflow-y-auto"><ThemeMenuItems /></DropdownMenuSubContent>
    </DropdownMenuSub>
  </DropdownMenuContent>
</DropdownMenu>
```

State 2 checkbox xuất bản thảo chuyển từ `NovelcrafterTopBar` sang component này (giữ hành vi: checkbox không đóng menu).

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-05 → **đỏ**.
- [ ] **B2 — `NovelcrafterTopBarMenu`** + i18n.
- [ ] **B3 — `NovelcrafterTopBar`**.
- [ ] **B4 — Verify** §9, e2e a11y, QA Playwright 1440 + 375.
- [ ] **B5 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                          | Input                                        | Kỳ vọng                                                                                                                                                             |
| ----- | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `NovelcrafterTopBar.test.tsx` | `masterGem` có tên, `masterPersona = null`   | Đúng **một** nút gọi `onOpenRoutingModal` (tên "Cài đặt AI"), `title` chứa tên GEM và chuỗi "không dùng Persona"; bấm → gọi 1 lần; nút **không** có `bg-(--accent)` |
| TC-02 | `NovelcrafterTopBar.test.tsx` | render                                       | Không còn chữ `novelcrafterMasterGemBadge`/`novelcrafterMasterPersonaBadge` hiển thị; không phần tử nào có class `uppercase` hay `overflow-x-auto`                  |
| TC-03 | `NovelcrafterTopBar.test.tsx` | mở menu "Thêm"                               | Có mục liên kết Quản lý Prompt (`href="/novelcrafter/prompts"`), 2 checkbox, 2 mục xuất, mục ngôn ngữ, mục Giao diện                                                |
| TC-04 | `NovelcrafterTopBar.test.tsx` | bỏ chọn "kèm hồ sơ", bấm xuất Markdown       | `onExportManuscript({ format: "md", includeStoryBible: false, includeChapterSummaries: true })`; bấm mục ngôn ngữ → `setLanguage("en")`                             |
| TC-05 | `NovelcrafterTopBar.test.tsx` | không truyền `onExportManuscript` (Negative) | Menu không có mục xuất và không có checkbox; các mục khác vẫn có                                                                                                    |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có**. `NovelcrafterA11yNames.test.tsx` (3D) tìm nút theo `aria-label` của key `novelcrafterRoutingButton` — key và `aria-label` giữ nguyên. Nếu ca cũ nào đỏ, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/novelcrafter --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**: W1 Grep `novelcrafterMasterGemBadge` trong `NovelcrafterTopBar.tsx` → 0 (chỉ còn trong chuỗi tóm tắt qua key khác). W2 Grep `uppercase|overflow-x-auto` trong `NovelcrafterTopBar.tsx` → 0. W3 `wc -l NovelcrafterTopBar.tsx` < 400. W4 QA 1440: đếm nút/ô trong `header` ≤ 7; mở "⋯" thấy đủ mục; bấm "Cài đặt AI" mở hộp thoại có tiêu đề mới. W5 QA 375: `header.scrollWidth <= clientWidth`.

**Negative Probes** (hoàn tác sau mỗi probe): N1 thêm lại một nút thứ hai gọi `onOpenRoutingModal` → TC-01 đỏ. N2 bỏ điều kiện `onExportManuscript &&` → TC-05 đỏ. N3 đổi `includeStoryBible` thành hằng `true` → TC-04 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                            | Mức        | Control                                                                                                  |
| ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Người dùng quen huy hiệu GEM/Persona không thấy đang dùng GEM nào | Trung bình | `title` của nút nêu rõ; hộp thoại hiển thị ngay; ghi D1 để PM đảo; 5E sẽ đưa nguồn prompt vào khung soạn |
| Xuất bản thảo khó tìm hơn (từ nút riêng vào menu)                 | Thấp       | Nằm trong "⋯" đúng như canvas ("Thêm: xuất bản thảo…"); nhãn nhóm rõ                                     |
| Menu con Giao diện tràn màn hình mobile                           | Thấp       | Radix tự né mép; `max-h-80 overflow-y-auto`; QA 375                                                      |
| Hook sau early return                                             | Thấp       | Component mới không có early return                                                                      |

### Lộ Trình

| Bước  | Nội dung                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| 5A    | **Plan này** — gọn thanh trên Novelcrafter (H1)                                                                              |
| 5B–5E | Tab Viết/Dàn ý/Hồ sơ + bảng dàn ý; trang Hồ sơ; trang Cài đặt AI; khung soạn lệnh AI + dock mobile — mỗi phần một plan riêng |
| 6     | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, thẻ ảnh Gallery, gỡ alias                              |

### 11. Ghi Chú Triển Khai

- Test được viết trước code nhưng **không chạy bước "đỏ" riêng**; bù lại N1–N3 đều làm test đỏ (N1 làm đỏ 2 ca).
- Kiểm tra: `tsc`, `lint` sạch; vitest 1944/1946 (2 lỗi governance có từ trước); e2e a11y 15/15; QA 1440: thanh trên 6 control, menu "⋯" đủ mục, "Cài đặt AI" mở hộp thoại tiêu đề mới; QA 375: không tràn ngang (thanh cao 103px, 2 hàng: tiêu đề / điều khiển).
- `NovelcrafterTopBar.tsx` 406 → 257 dòng.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-fable-5-2 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5a-novelcrafter-topbar-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A7 khớp source; grep xác nhận `novelcrafterRoutingButton` chỉ dùng ở `NovelcrafterTopBar.tsx`, `novelcrafterRoutingTitle` chỉ ở `GemPersonaRoutingModal.tsx`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                  | Bằng chứng                                                                               | Lý do / Hướng xử lý                                                                                                                                                                                              |
| --- | -------------- | ------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:240`        | [SRC] Nút hiện chỉ có `aria-label`; plan đưa tóm tắt GEM/Persona vào `title`             | `title` không đến được người dùng cảm ứng và không chắc được trình đọc màn hình đọc. Khi code: thêm `aria-describedby` trỏ `<span className="sr-only">` chứa cùng tóm tắt; TC-01 khẳng định mô tả truy cập được. |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/layout/components/ThemeMenuItems.tsx:15`                   | [SRC] Nhãn nhóm trong `ThemeMenuItems` dùng `uppercase tracking-widest`                  | Là nhãn nhóm của menu dùng chung (ngoài phạm vi 5A); TC-02 chỉ khẳng định thanh trên ở trạng thái menu đóng. Rà cùng type scale ở Giai đoạn 6.                                                                   |
| 3   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx:77` | [SRC] Test 3D tìm nút theo tên + `aria-label` của `novelcrafterRoutingButton` (mock `t`) | Key và `aria-label` giữ nguyên nên ca cũ vẫn xanh; không có Loại C.                                                                                                                                              |

#### Kết Luận

Không có `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-05) và Negative Probe N1–N3. Phạm vi 5B–5E được nêu rõ là chưa làm. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 4B: Form Studio Theo Canvas (Tỷ Lệ Dạng Thẻ, Làm Giàu Prompt Gọn, "Tạo N ảnh")

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6, xem §3 "Ủy quyền") (`[PLANNER_MODEL: claude-fable-5-2]`)
- **Depends on**: Giai đoạn 4 (commit `fd80c75`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: canvas board **ImageStudio** (artifact `EX6CrQpyty54jcm8LAeeGN`) phần form bên trái và phần Kết quả; mục "Out of Scope" của plan Giai đoạn 4 (đã dời sang 4B).

1. **Tỷ lệ dạng thẻ có hình** (`AspectRatioPicker`): `role="radiogroup"` tên "Tỷ lệ khung hình"; mỗi tỷ lệ là `role="radio"` cao 56px có khung hình minh họa đúng tỷ lệ + nhãn ("16:9"); đang chọn = viền `--accent` + nền `--soft`; phím ←/→/↑/↓ chuyển lựa chọn (roving `tabIndex`). 5 tỷ lệ thường dùng hiện sẵn, 9 tỷ lệ mở rộng vẫn nằm sau nút "Mở rộng" (cùng một radiogroup).
2. **"Để AI làm giàu prompt" gọn**: thay khối thẻ lớn + nhãn nhóm "Nâng cấp" bằng một hàng switch + nhãn ngay dưới ô prompt (canvas). Switch bấm trực tiếp được (bỏ `pointer-events-none`), nhãn bấm cũng đổi trạng thái.
3. **Nhãn theo canvas**: "Mô tả ảnh bạn muốn" (thay "Prompt"), "Tỷ lệ" (thay "Kích thước").
4. **Nút Tạo**: "Tạo ảnh" khi 1 ảnh, **"Tạo N ảnh"** khi N > 1 (thay "Tạo ảnh (N ảnh)"); dòng "Hoặc nhấn Ctrl Enter" chuyển xuống **dưới nút** (canvas), vẫn ẩn trên thiết bị cảm ứng.
5. **`StyleSelector` theo token + a11y**: nút phong cách có `aria-pressed`, viền chọn `--accent`, chữ ≥ 12px, ô tìm theo token (đóng nốt phần màu thô/chữ nhỏ của khu Studio).
6. **Kết quả**: tiêu đề "Kết quả" thành `h2` (trang đã có `h1` "Ảnh"); thêm liên kết "Xem thư viện" → `/gallery` cạnh số ảnh (canvas: "Xem thư viện").

**Out of Scope (What We're NOT Doing)**:

- **Bỏ chế độ Guided, Quick add, Exclude, tỷ lệ mở rộng, độ phân giải** — canvas không vẽ nhưng là tính năng đang dùng; giữ nguyên (quyết định D1).
- **Chip phong cách thay lưới ảnh minh họa** — lưới 19 phong cách có ảnh mẫu truyền đạt tốt hơn 5 chip chữ của canvas; giữ lưới, chỉ sửa token/a11y (D2).
- **Mặc định 4 ảnh** — số ảnh phụ thuộc hạn mức theo hạng tài khoản (`batchQuota`); giữ mặc định 1 (D3).
- Dải "Trước đó" (ảnh thu nhỏ các lượt trước), tiêu đề lượt tạo ("Hẻm Hội An…"), nút "Tạo biến thể"/"So sánh" ở đầu kết quả — cần gom ảnh theo lượt tạo (thay đổi dữ liệu), không thuộc đợt giao diện này.
- Ô chọn model dạng nút có avatar provider (giữ Radix Select đã có tên truy cập).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                          | Nội dung rút ra                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas `project/ImageStudio.dc.html`                                                                                         | Radiogroup "Tỷ lệ khung hình" 4 cột, thẻ 56px có khung tỷ lệ; hàng switch "Để AI làm giàu prompt"; "Tạo 4 ảnh"; "Hoặc nhấn Ctrl Enter" dưới nút; "Xem thư viện" |
| `docs/plans/2026-11-11-vikini-3-phase-4-images-section-plan.md`                                                              | Phần dời sang 4B; quy ước token; test `ControlPanel.test.tsx` hiện có                                                                                           |
| `src/app/features/image-gen/components/ControlPanel.tsx`, `StyleSelector.tsx`, `Canvas.tsx`, `ControlPanelPromptSection.tsx` | Cấu trúc hiện tại (A1–A6)                                                                                                                                       |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                        | Lý do nạp                      | Quyết định kỹ thuật chịu ảnh hưởng                                                                           |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/add-translation/SKILL.md` | Đổi giá trị nhãn, thêm key mới | Sửa **cả** `vi.ts`/`en.ts`; giữ nguyên tên key đang được test dùng (`studioShortcutHint`, `studioAiEnhance`) |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                       | Bằng chứng                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Khối "Nâng cấp" là thẻ `div onClick` lớn, Switch `pointer-events-none`                                                                 | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:163-202`                                                                                                                             |
| A2  | Tỷ lệ là lưới nút chữ 3 cột (`COMMON_RATIOS` 5 mục, `EXTENDED_RATIOS` 9 mục), không có vai trò radio                                   | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:60-61`, `src/app/features/image-gen/components/ControlPanel.tsx:245-285`                                                             |
| A3  | Nút Tạo ghép "Tạo ảnh (N ảnh)"                                                                                                         | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:399-405`                                                                                                                             |
| A4  | Gợi ý phím tắt nằm trong khối Prompt, dùng key `studioShortcutHint`; test TC-06 (Giai đoạn 4) tìm theo key này                         | `[SRC]` `src/app/features/image-gen/components/ControlPanelPromptSection.tsx:166`, `src/app/features/image-gen/components/ControlPanel.test.tsx:14`                                                  |
| A5  | `StyleSelector`: nút không có `aria-pressed`, chữ `text-[10px]`/`text-[11px]`, viền `border-primary`, ô tìm `focus:ring-purple-500/40` | `[SRC]` `src/app/features/image-gen/components/StyleSelector.tsx:77`, `src/app/features/image-gen/components/StyleSelector.tsx:85-93`, `src/app/features/image-gen/components/StyleSelector.tsx:117` |
| A6  | Tiêu đề kết quả là `h3` ngay dưới `h1` (nhảy cấp), không có liên kết sang thư viện                                                     | `[SRC]` `src/app/features/image-gen/components/Canvas.tsx:157-162`                                                                                                                                   |
| A7  | Test `ControlPanel.test.tsx` mock `StyleSelector`; TC-01 khẳng định switch tên "AI Enhance" + mô tả `studioAiEnhanceDesc`              | `[SRC]` `src/app/features/image-gen/components/ControlPanel.test.tsx:26-30`, `src/app/features/image-gen/components/ControlPanel.test.tsx:77-85`                                                     |

**Ủy quyền**: ngày 2026-11-11 PM chọn "Tự làm hết, kể cả push main" cho chuỗi 4B → 5 → 6 và "Theo canvas, ghi lại" cho quyết định sản phẩm. Vì vậy plan này được tự review và triển khai liền, Critic Pass miễn như các plan trước.

**Quyết định sản phẩm (đã chọn mặc định, ghi lại để PM đảo nếu cần)**:

- **D1** Giữ Guided / Quick add / Exclude / tỷ lệ mở rộng / độ phân giải (không xóa tính năng đang có).
- **D2** Giữ lưới phong cách có ảnh mẫu thay vì chip chữ.
- **D3** Giữ số ảnh mặc định 1; nhãn nút hiển thị số ảnh đang chọn.
- **D4** Giữ mô tả "Tự động cải thiện prompt" cho trình đọc màn hình (`sr-only`), không hiện chữ (canvas chỉ có nhãn).

### 4. Bảng Verified Versions

| Thư viện / Công cụ       | `package.json` | Phiên bản | Ghi chú                | Nguồn                      |
| ------------------------ | -------------- | --------- | ---------------------- | -------------------------- |
| `@radix-ui/react-switch` | `^1.2.6`       | 1.2.x     | Switch làm giàu prompt | `[SRC]` `package.json:50`  |
| `tailwindcss`            | `^4.1.18`      | 4.1.x     | `pointer-coarse:`      | `[SRC]` `package.json:114` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/app/features/image-gen/components/AspectRatioPicker.tsx` — radiogroup thẻ tỷ lệ (§6.1).
- `[NEW]` `src/app/features/image-gen/components/AspectRatioPicker.test.tsx` — TC-01…TC-03.
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.tsx` — dùng `AspectRatioPicker`; hàng switch gọn; nhãn nút "Tạo N ảnh"; gợi ý phím tắt dưới nút.
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanelPromptSection.tsx` — bỏ dòng gợi ý phím tắt (chuyển sang `ControlPanel`); nhận `children` để đặt hàng switch ngay dưới ô prompt.
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.test.tsx` — thêm TC-04…TC-06 (chỉ thêm).
- `[MODIFY]` `src/app/features/image-gen/components/StyleSelector.tsx` — token + `aria-pressed` + chữ ≥ 12px; xóa trường `color` không dùng trong `STYLES` (Audit Run 1 #1).
- `[NEW]` `src/app/features/image-gen/components/StyleSelector.test.tsx` — TC-07.
- `[MODIFY]` `src/app/features/image-gen/components/Canvas.tsx` + `Canvas.test.tsx` — `h2`, liên kết "Xem thư viện"; TC-08 (chỉ thêm).
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — đổi giá trị `studioPromptLabel` ("Mô tả ảnh bạn muốn" / "Describe the image you want"), `studioDimensions` ("Tỷ lệ" / "Aspect ratio"), `studioAiEnhance` ("Để AI làm giàu prompt" / "Let AI enrich the prompt"), `studioShortcutHint` ("Hoặc nhấn Ctrl Enter" / "Or press Ctrl Enter"); key mới `studioAspectRatioGroup` ("Tỷ lệ khung hình" / "Aspect ratio"), `studioGenerateCount` ("Tạo {n} ảnh" / "Generate {n} images"), `studioViewLibrary` ("Xem thư viện" / "View library").
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 `AspectRatioPicker`**

```tsx
<AspectRatioPicker
  value={aspectRatio} onChange={setAspectRatio}
  ratios={COMMON_RATIOS} extendedRatios={EXTENDED_RATIOS}
  label={t("studioAspectRatioGroup")} extendedLabel={t("studioExtraRatios")} />

// bên trong
<div role="radiogroup" aria-label={label} onKeyDown={handleArrows} className="grid grid-cols-4 gap-1.5">
  {visible.map((ratio) => (
    <button type="button" role="radio" aria-checked={ratio === value} tabIndex={ratio === focusable ? 0 : -1}
      onClick={() => onChange(ratio)}
      className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-[10px] border text-[13px] …",
        ratio === value ? "border-(--accent) bg-(--soft) text-(--accent) font-semibold" : "border-(--line) text-(--muted) font-medium")}>
      <span aria-hidden="true" className="rounded-[3px] border-[1.5px] border-current" style={ratioBox(ratio)} />
      {ratio}
    </button>
  ))}
</div>
<button type="button" aria-expanded={expanded} onClick={toggle}>{extendedLabel} ({extendedRatios.length})</button>
```

`ratioBox("16:9")` → `{ width, height }` với cạnh dài 22px, cạnh ngắn theo tỷ lệ (tối thiểu 6px để "1:8" vẫn thấy). `focusable` = giá trị đang chọn nếu đang hiển thị, ngược lại mục đầu. Nếu giá trị đang chọn thuộc nhóm mở rộng thì nhóm mở rộng tự mở.

**6.2 Hàng switch + nút Tạo**

```tsx
<ControlPanelPromptSection …>
  <div className="flex items-center gap-2.5 pt-1">
    <Switch id={enhanceId} aria-describedby={enhanceDescId} checked={isEnhancerOn} onCheckedChange={setIsEnhancerOn} />
    <label htmlFor={enhanceId} className="text-sm text-(--text) cursor-pointer">{t("studioAiEnhance")}</label>
    <span id={enhanceDescId} className="sr-only">{t("studioAiEnhanceDesc")}</span>
  </div>
</ControlPanelPromptSection>

{numberOfImages > 1 ? t("studioGenerateCount").replace("{n}", String(numberOfImages)) : t("studioGenerate")}
<p className="mt-2 text-center text-xs text-(--faint) pointer-coarse:hidden">{t("studioShortcutHint")}</p>
```

Thứ tự dưới nút: dòng lý do khóa (nếu có) rồi dòng phím tắt. Tên truy cập của switch đến từ `<label htmlFor>` (cùng chuỗi `studioAiEnhance`).

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-08 → **đỏ**.
- [ ] **B2 — `AspectRatioPicker`** + i18n.
- [ ] **B3 — `ControlPanel` / `ControlPanelPromptSection`**.
- [ ] **B4 — `StyleSelector`, `Canvas`**.
- [ ] **B5 — Verify** §9, e2e a11y, QA Playwright 1440 + 375×667.
- [ ] **B6 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                         | Input                                                        | Kỳ vọng                                                                                                                                        |
| ----- | ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `AspectRatioPicker.test.tsx` | `value="16:9"`, 5 tỷ lệ thường + 9 mở rộng                   | `radiogroup` có tên; 5 `radio`; chỉ "16:9" `aria-checked="true"` + `tabIndex=0` + `bg-(--soft)`; bấm "1:1" → `onChange("1:1")`                 |
| TC-02 | `AspectRatioPicker.test.tsx` | phím → và ← trên radio đang chọn                             | `onChange` nhận tỷ lệ kế tiếp / trước đó (vòng lại ở hai đầu)                                                                                  |
| TC-03 | `AspectRatioPicker.test.tsx` | bấm "Mở rộng"; và `value="21:9"` ban đầu (Negative: nhóm ẩn) | Ban đầu không có radio "21:9" và nút có `aria-expanded="false"`; sau khi bấm có 14 radio; với `value="21:9"` nhóm mở sẵn                       |
| TC-04 | `ControlPanel.test.tsx`      | render mặc định                                              | Switch có tên từ nhãn hiển thị, bấm → `setIsEnhancerOn(true)`; không còn nhãn nhóm `studioEnhancement`; có `radiogroup`                        |
| TC-05 | `ControlPanel.test.tsx`      | `numberOfImages` 1 / 4                                       | Tên nút "Tạo" / "Tạo 4 ảnh" (mock `studioGenerateCount`); không còn dạng "(4 ảnh)"                                                             |
| TC-06 | `ControlPanel.test.tsx`      | render                                                       | Dòng phím tắt đứng **sau** nút Tạo trong DOM, vẫn `pointer-coarse:hidden`                                                                      |
| TC-07 | `StyleSelector.test.tsx`     | `selectedStyle="anime"`                                      | Nút "anime" `aria-pressed="true"`, các nút khác `"false"`; không class `text-[10px]`/`text-[11px]`/`purple`/`border-primary`; bấm → `onSelect` |
| TC-08 | `Canvas.test.tsx`            | `images = []`                                                | Tiêu đề kết quả là heading cấp 2; có link "studioViewLibrary" → `/gallery`                                                                     |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có**. TC-01 của 3D (switch tên "AI Enhance" + mô tả) vẫn đúng vì tên đến từ `<label>` cùng key và mô tả giữ bằng `sr-only` (D4); TC-06 Giai đoạn 4 tìm gợi ý theo key `studioShortcutHint` — giữ key, chỉ đổi vị trí. Nếu ca cũ nào đỏ, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/image-gen --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**: W1 Grep `studioEnhancement` trong `ControlPanel.tsx` → 0. W2 Grep `text-\[(10|11)px\]|purple|border-primary` trong `StyleSelector.tsx` → 0. W3 Grep `AspectRatioPicker` trong `ControlPanel.tsx` → ≥ 1. W4 QA 375×667: ô prompt + nút Tạo vẫn trong viewport; 1440: thẻ tỷ lệ có hình, bấm đổi `aria-checked`.

**Negative Probes** (hoàn tác sau mỗi probe): N1 bỏ `aria-checked` trong `AspectRatioPicker` → TC-01 đỏ. N2 bỏ xử lý phím mũi tên → TC-02 đỏ. N3 trả nhãn nút về "(N ảnh)" → TC-05 đỏ. N4 bỏ `aria-pressed` trong `StyleSelector` → TC-07 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                      | Mức        | Control                                                                                        |
| ----------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Hàng 4 cột chật ở panel 320px với nhãn dài ("21:9")         | Thấp       | Thẻ `min-w-0`, nhãn 13px; QA mở nhóm mở rộng                                                   |
| Đổi giá trị `studioAiEnhance` ảnh hưởng nơi khác dùng key   | Thấp       | Grep key trước khi đổi; chỉ `ControlPanel` dùng                                                |
| Switch bấm được + nhãn `htmlFor` gây đổi trạng thái hai lần | Trung bình | Bỏ `onClick` của khối cha; chỉ Switch và `<label>` điều khiển; TC-04 khẳng định gọi đúng 1 lần |
| Form cao thêm làm nút Tạo rời viewport mobile               | Thấp       | Nút Tạo vẫn sticky đáy; hàng switch gọn thay khối thẻ lớn nên tổng chiều cao giảm; W4          |

### Lộ Trình

| Bước | Nội dung                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------- |
| 4B   | **Plan này** — form Studio theo canvas                                                          |
| 5    | Novelcrafter theo canvas (H1), chia nhỏ                                                         |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, thẻ ảnh Gallery, gỡ alias |

### 11. Ghi Chú Triển Khai

- Lưới tỷ lệ dùng **5 cột** (plan ghi 4): 5 tỷ lệ thường dùng vừa một hàng trong panel 320px, không còn thẻ lẻ ở hàng hai.
- Kiểm tra: `tsc`, `lint` sạch; vitest 1939/1941 (2 lỗi governance có từ trước); N1–N4 đều làm test đỏ; e2e a11y 15/15; QA 1440 (đổi tỷ lệ bằng chuột và phím →, bật switch) và 375×667 (ô prompt y 275–403, nút Tạo y 559–603 trong viewport).

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-fable-5-2 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-4b-studio-form-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A7 khớp source. Grep `studioAiEnhance`, `studioDimensions`, `studioPromptLabel`: chỉ `ControlPanel.tsx` và `ControlPanelPromptSection.tsx` dùng.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                     | Bằng chứng                                                                                                            | Lý do / Hướng xử lý                                                                                                                                    |
| --- | -------------- | ------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/StyleSelector.tsx:36-55` | [SRC] Mỗi mục `STYLES` có trường `color` (`bg-purple-500`…) nhưng phần render không đọc `s.color` (grep `.color` → 0) | Wiring Probe W2 (grep `purple` → 0) không thể đạt nếu giữ trường chết này. Đã sửa §5: xóa trường `color` (code chết, không đổi hành vi).               |
| 2   | RISK_DISMISSED | —       | `src/app/features/image-gen/components/Canvas.tsx:389`          | [SRC] Empty state dùng `h3` "Ready to create"                                                                         | Sau khi tiêu đề "Kết quả" thành `h2`, `h3` này nằm đúng cấp; không cần sửa.                                                                            |
| 3   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/ControlPanel.tsx:196`    | [SRC] Switch hiện có `aria-label={t("studioAiEnhance")}`                                                              | Khi chuyển sang `<label htmlFor>`, bỏ `aria-label` để tên đọc = nhãn thấy (WCAG 2.5.3) và tránh hai nguồn tên; TC-04 khẳng định tên qua nhãn hiển thị. |

#### Kết Luận

Không có `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-03) và Negative Probe N1–N4; không có ca test cũ bị thay. Các quyết định D1–D4 giữ tính năng hiện có, ghi lại cho PM. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

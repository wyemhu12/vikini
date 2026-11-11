# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 6C: Thẻ Ảnh Thư Viện Dùng Được Bằng Bàn Phím

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: claude-fable-5-2]`)
- **Depends on**: Giai đoạn 6B (commit `b7aefeb`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: mục "Out of Scope" của plan Giai đoạn 4 ("Thẻ ảnh trong Gallery là `div onClick` — chưa dùng được bằng bàn phím … ghi nhận cho Giai đoạn 6") và nguyên tắc a11y của brief (control thật, `focus-visible`).

1. **Thẻ ảnh là `<button>` thật**: Tab tới được, Enter/Space mở chi tiết ảnh (hoặc chọn/bỏ chọn khi đang ở chế độ So sánh); tên truy cập = prompt của ảnh; ở chế độ So sánh có `aria-pressed`.
2. **Thấy được khi focus**: viền `focus-visible` 2px `--ring`; lớp phủ prompt hiện cả khi `focus-visible` (không chỉ hover).
3. Ảnh bên trong thành trang trí (`alt=""`) để tên không bị đọc hai lần.

**Out of Scope (What We're NOT Doing)** — phần còn lại của "Giai đoạn 6" trong lộ trình **chưa làm**, kèm số đo ngày 2026-11-11 trên `src/**/*.tsx` (không tính test):

- **Lint chặn màu thô / chữ nhỏ**: còn **298** class màu Tailwind thô, **37** chỗ `text-[8–11px]`, **42** chỗ `uppercase`. Bật rule ở mức lỗi lúc này sẽ làm `npm run lint` đỏ toàn repo; cần codemod dọn trước (Novelcrafter, Lightbox, Compare, Editor…) rồi mới bật. Sửa `eslint.config.mjs` là file hạ tầng (cần Critic).
- **Gỡ alias token cũ**: còn **1.421** chỗ dùng tên cũ (`--text-primary`, `--border`, `--control-bg`, `--surface-muted`…). Phải codemod toàn bộ trước khi xóa alias trong `_shared/base.css`.
- **Type scale làm token**, **`eslint-plugin-react-hooks`** (thêm phụ thuộc + sửa vi phạm sẵn có).
- Các bề mặt Novelcrafter 5B–5E.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                             | Nội dung rút ra           |
| --------------------------------------------------------------- | ------------------------- |
| `docs/plans/2026-11-11-vikini-3-phase-4-images-section-plan.md` | Việc dời sang Giai đoạn 6 |
| `src/app/features/gallery/components/GalleryView.tsx` + test    | Thẻ ảnh hiện tại (A1–A3)  |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                     | Lý do nạp        | Quyết định kỹ thuật chịu ảnh hưởng                                      |
| -------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `.agents/skills/vikini-audit/SKILL.md` | Rà a11y vùng sửa | Dùng phần tử `button` gốc thay vì `role="button"` + xử lý phím thủ công |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                | Bằng chứng                                                                |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A1  | Thẻ ảnh là `div` có `onClick`, không `tabIndex`, không vai trò; bên trong **không** có nút lồng | `[SRC]` `src/app/features/gallery/components/GalleryView.tsx:193-247`     |
| A2  | Lớp phủ prompt chỉ hiện khi hover (`group-hover:opacity-100`)                                   | `[SRC]` `src/app/features/gallery/components/GalleryView.tsx:243-245`     |
| A3  | Test hiện có không truy vấn thẻ ảnh theo vai trò/thẻ `div`                                      | `[SRC]` `src/app/features/gallery/components/GalleryView.test.tsx:95-104` |

**Quyết định sản phẩm**: không có (chỉ sửa khả năng truy cập, không đổi giao diện khi dùng chuột).

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                         | Nguồn                     |
| ------------------ | -------------- | --------- | ------------------------------- | ------------------------- |
| `next`             | `^16.4.0`      | 16.4      | `next/image` bên trong `button` | `[SRC]` `package.json:64` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx` — thẻ ảnh `div` → `button`.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.test.tsx` — TC-01, TC-02 (chỉ thêm).
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

```tsx
<button
  key={img.id}
  type="button"
  aria-label={img.prompt}
  aria-pressed={g.compareMode ? isSelectedForCompare : undefined}
  onClick={() => (g.compareMode ? g.handleToggleCompareImage(img) : g.setSelectedImage(img))}
  className={`group relative aspect-square … focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${…}`}
>
  <Image src={img.url} alt="" fill … />
  {/* chỉ báo So sánh như cũ, aria-hidden */}
  <div className="… opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 …"><p>{img.prompt}</p></div>
</button>
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01, TC-02 → **đỏ**.
- [ ] **B2 — Sửa thẻ ảnh**.
- [ ] **B3 — Verify** §9 + e2e a11y.
- [ ] **B4 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                   | Input                                     | Kỳ vọng                                                                                                                                                                          |
| ----- | ---------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `GalleryView.test.tsx` | 1 ảnh, không ở chế độ So sánh, modal đóng | Có `button` tên = prompt, **không** có `aria-pressed` (Negative); bấm → `setSelectedImage(img)`; class có `focus-visible:ring-2` và lớp phủ có `group-focus-visible:opacity-100` |
| TC-02 | `GalleryView.test.tsx` | `compareMode = true`, ảnh chưa được chọn  | `button` có `aria-pressed="false"`; bấm → `handleToggleCompareImage(img)` và **không** gọi `setSelectedImage`                                                                    |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có** (A3).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/gallery --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**: W1 Grep `cursor-pointer bg-\(--surface-muted\)` kèm `<div` ở thẻ ảnh → 0 (thẻ là `button`). **Negative Probes**: N1 đổi `button` về `div` → TC-01 đỏ. N2 bỏ nhánh `compareMode` trong `aria-pressed` → TC-02 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                             | Mức  | Control                                                              |
| -------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `button` làm lệch kiểu mặc định (padding, căn chữ) | Thấp | Thẻ đã `relative overflow-hidden` + ảnh `fill`; thêm `p-0 text-left` |
| Tên truy cập dài (prompt dài)                      | Thấp | Chấp nhận: prompt là mô tả đúng nhất của ảnh                         |

### Lộ Trình

| Bước | Nội dung                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------- |
| 6C   | **Plan này** — thẻ ảnh thư viện dùng được bằng bàn phím                                                 |
| Sau  | Codemod màu thô + alias token rồi bật lint; type scale; `eslint-plugin-react-hooks`; Novelcrafter 5B–5E |

### 11. Ghi Chú Triển Khai

- Kiểm tra: TC-01/TC-02 đỏ trước, xanh sau; `tsc`, `lint` sạch; vitest 1963/1965 (2 lỗi governance có từ trước); N1–N2 đều làm test đỏ; e2e a11y 15/15.
- Chưa QA bằng Playwright với thư viện có ảnh (mock hiện trả thư viện rỗng); hành vi được bảo vệ bằng unit test.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-fable-5-2 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6c-gallery-keyboard-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                   | Bằng chứng                                                    | Lý do / Hướng xử lý                                                                                                      |
| --- | -------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MINOR] | `src/app/features/gallery/components/GalleryView.tsx:193`     | [SRC] Vòng lặp thẻ ảnh bắt đầu ở dòng 193, lớp phủ ở dòng 243 | A1/A2 ban đầu ghi lệch dòng (185-239, 234-236) — tồn tại nhưng trỏ sai khối. Đã sửa tham chiếu trong §3.                 |
| 2   | RISK_DISMISSED | —       | `src/app/features/gallery/components/GalleryView.tsx:219-240` | [SRC] Chỉ báo So sánh là `div` trang trí, không phải control  | Không có control lồng trong `button` (HTML hợp lệ); thêm `aria-hidden` cho chỉ báo vì trạng thái đã có ở `aria-pressed`. |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/gallery/components/GalleryView.test.tsx:42` | [SRC] Mock controller cố định `compareMode: false`            | TC-02 cần biến mock `mockCompareMode` + spy `handleToggleCompareImage`; chỉ thêm biến, không đổi ca cũ.                  |

#### Kết Luận

Không có `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-01) và Negative Probe N1–N2. Phần còn lại của Giai đoạn 6 được nêu rõ là chưa làm, kèm số đo. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

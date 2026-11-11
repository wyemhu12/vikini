# Plan: Quy Tắc Bắt Buộc Kiểm Thử Trực Quan Bằng Playwright Screenshot & Đọc Ảnh (`read_file`)

- **Date**: 2026-11-11
- **Task**: Bổ sung quy tắc bắt buộc kiểm thử giao diện trực quan theo Cách 1 (`next dev` + Playwright `page.screenshot()` + gọi `read_file` đọc trực tiếp file ảnh `.png` ở cả Desktop/Mobile và Dark/Light) vào `.agents/rules/03-ui.md` và `.agents/rules/02-quality.md`, kèm kiểm thử bảo toàn tại `.agents/scripts/code-freeze-guard.test.ts`.
- **Status**: Approved
- **Planner**: Gemini 4 Carbon (in-session theo quy trình làm việc hiện hành của PM)

## Technical Plan

### 1. Mục Tiêu & Phạm Vi

- **Mục tiêu 1 — Quy tắc bắt buộc trong `.agents/rules/`**: Biến quy trình kiểm thử trực quan bằng mắt (bật server `next dev` thực tế, dùng Playwright giả lập phiên/dữ liệu qua `page.route`, chụp `.png` ở cả `1440×900` và `375×812` trên giao diện Tối & Sáng, sau đó **bắt buộc gọi `read_file` đọc trực tiếp từng tấm ảnh `.png`** để tự rà soát bố cục, khoảng cách, tràn chữ và độ tương phản trước khi báo hoàn tất) thành cổng chất lượng bắt buộc trong `.agents/rules/03-ui.md` và `.agents/rules/02-quality.md`.
- **Mục tiêu 2 — Sửa ngay 5 lỗi giao diện phát hiện bởi lượt chạy Cách 1 đầu tiên**:
  1. `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.tsx:162`: đang gọi `t("novelcrafterScenesLabel")` (chưa khai báo) khiến màn hình Dàn ý hiển thị chuỗi thô `novelcrafterScenesLabel` → đổi sang `t("novelcrafterChapterBeatsLabel")`.
  2. `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.tsx:121`: nút cam chính dưới đáy mobile hiển thị chuỗi thô `novelcrafterWriteMenuBtn` → đổi sang `t("novelcrafterSlotWrite")`.
  3. `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:50`: gọi `t("novelcrafterUntitledStory")` thay vì `t("novelcrafterDefaultStoryTitle")`.
  4. `src/app/features/novelcrafter/components/StoryBibleTocSidebar.tsx:78-106`: cột mục lục rộng `232px` đặt khối tiêu đề/phụ đề nằm ngang cạnh cụm nút `shrink-0` (`Thu gọn Hồ sơ Truyện`), ép chữ phụ đề dồn dọc từng chữ cái một cột → chuyển sang xếp dọc `md:flex-col` gọn gàng.
  5. `src/app/features/novelcrafter/components/NovelcrafterAiComposer.tsx:243-283`: đặt `<select>` hành động ngang hàng với `radiogroup` 3 chế độ trong cột phải `320px` khiến 3 nhãn bị cắt cụt thành `Viết ...` / `Chu...` → chuyển sang `flex-col gap-1.5` với `<select>` rộng `w-full`.

#### Out of Scope / What We're NOT Doing

- Không thay đổi cơ chế hook `.agents/scripts/code-freeze-guard.js`, cấu hình `playwright.config.ts` hay `.agents/agents/*/agent.md`.
- Không tự ý chạy lệnh git mutating (`git commit`, `git push`) khi chưa có xác nhận của PM.

#### Skills Loaded

- `.agents/rules/02-quality.md` — cổng chất lượng `Post-Change Checklist` và giới hạn ngân sách ký tự rules (`<= 12,000` ký tự mỗi file, tổng `always_on < 18,000` và `<= 17,000` theo `TC-H`).
- `.agents/rules/03-ui.md` — chuẩn thiết kế UI/UX gắn glob `*.tsx, *.css`.
- `.agents/rules/05-plan-review.md` — quy trình lập plan và kiểm chứng `verify-plan.mjs`.

### 2. Verified Versions & Bối Cảnh Hệ Thống

- `@playwright/test` `1.59.1` (`package.json:99`), `axe-core` `4.11.1` (`package.json:96`), `vitest` `4.1.12` (`package.json:118`).
- Hiện trạng ngân sách ký tự `.agents/rules/`:
  - `.agents/rules/02-quality.md:1-84` (`always_on`): `5.756` ký tự (tổng `always_on` trên Windows CRLF đang là `17.159` ký tự, vượt ngưỡng `17.000` của `.agents/scripts/code-freeze-guard.test.ts:1899`).
  - `.agents/rules/03-ui.md:1-120` (`glob`): `8.203` ký tự (còn gần `3.800` ký tự dư địa so với trần `12.000`).

### 3. Assumptions & Quyết Định Thiết Kế

- **A1 (Đặt quy tắc ở cả 2 tầng)**:
  - Tại `.agents/rules/02-quality.md:41-46` (`always_on`): thêm cổng **Visual QA Gate (UI/CSS)** ngắn gọn vào `Post-Change Checklist (MANDATORY)` để mọi phiên làm việc đều thấy yêu cầu bắt buộc và trỏ sang `.agents/rules/03-ui.md`; đồng thời cô đọng câu chữ dư thừa trong `02-quality.md` (giữ nguyên 100% từ khóa bắt buộc tại `.agents/scripts/code-freeze-guard.test.ts:1574-1585`) sao cho tổng `always_on <= 17.000` ký tự cả trên CRLF.
  - Tại `.agents/rules/03-ui.md:115-120` (`glob: "*.tsx, *.css, **/*.tsx, **/*.css"`): bổ sung mục chi tiết `## Visual QA via Playwright Screenshot Inspection (MANDATORY)` gồm đủ 4 bước: (1) bật `next dev` + mock API qua `page.route` (`tests/e2e/helpers/*`), (2) chụp `.png` ở Desktop (`1440×900`) & Mobile (`375×812`) × Dark/Light kèm kiểm tra tràn ngang và `axe-core`, (3) gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự soi bố cục/tương phản bằng thị giác đa phương thức, (4) dừng server và khôi phục `next-env.d.ts`, tuyệt đối không commit ảnh chụp tạm.

### 4. Thiết Kế Kiến Trúc & Luồng Kiểm Chứng

```text
Sửa *.tsx / *.css
  → Rule 02-quality.md (always_on) & 03-ui.md (glob) kích hoạt
  → Tier 1/2 (tsc + lint + vitest)
  → Visual QA Gate: next dev + Playwright page.route + page.screenshot() (1440 & 375, Dark & Light)
  → Agent gọi read_file(*.png) tự soi giao diện thực tế → sửa nếu lệch → dọn server & next-env.d.ts
```

### 5. Danh Sách File Dự Kiến Thay Đổi

- `[MODIFY]` `.agents/rules/03-ui.md` — cập nhật dòng 29–34, dòng 45 cho khớp hậu Giai đoạn 6D và thêm mục `## Visual QA via Playwright Screenshot Inspection (MANDATORY)`.
- `[MODIFY]` `.agents/rules/02-quality.md` — thêm mục `Visual QA Gate` vào `## Post-Change Checklist (MANDATORY)` và cô đọng câu chữ để tổng `always_on <= 17,000` ký tự.
- `[MODIFY]` `.agents/scripts/code-freeze-guard.test.ts` — bổ sung kiểm tra bảo toàn quy tắc `page.screenshot` + `read_file` trong `02-quality.md` và `03-ui.md` tại khối `Normative Preservation Matrix (M5)`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.tsx` — đổi `novelcrafterScenesLabel` → `novelcrafterChapterBeatsLabel`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx` — đồng bộ từ điển mock `novelcrafterChapterBeatsLabel` và khẳng định hiển thị nhãn dịch thực tế (không lộ khóa thô).
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.tsx` — đổi `novelcrafterWriteMenuBtn` → `novelcrafterSlotWrite`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.test.tsx` — đồng bộ từ điển mock `novelcrafterSlotWrite` và khẳng định không lộ khóa thô.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx` — đổi `novelcrafterUntitledStory` → `novelcrafterDefaultStoryTitle`.
- `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleTocSidebar.tsx` — bố cục tiêu đề/phụ đề xếp dọc trên cột `232px` (`md:flex-col`), tránh ép chữ dồn dọc từng ký tự.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterAiComposer.tsx` — xếp `<select>` `w-full` phía trên `radiogroup` (`flex-col gap-1.5`) để hiển thị rõ nhãn chế độ.
- `[MODIFY]` `docs/CHANGELOG.md` — ghi nhận bổ sung quy tắc bắt buộc kiểm thử giao diện trực quan bằng Playwright screenshot + `read_file` và bản vá 5 lỗi giao diện Novelcrafter.

### 6. Caller-First Design Sketch

```markdown
<!-- .agents/rules/03-ui.md -->

## Visual QA via Playwright Screenshot Inspection (MANDATORY)

DOM/unit assertions alone are NOT sufficient for UI or CSS changes (`*.tsx`, `*.css`). Before declaring UI work complete, you MUST visually inspect the live rendered pages:

1. **Live Dev Server & Realistic Mocks**: Start local `next dev` (use `--webpack -H 127.0.0.1 -p 3100` in worktrees with junctioned `node_modules`) and mock auth/API via `page.route` (`tests/e2e/helpers/*`) so authenticated views render populated states instead of empty/login walls.
2. **Multi-Viewport & Dark/Light Capture**: Capture `.png` screenshots via Playwright `page.screenshot()` into a scratch folder outside git for affected routes/states at **Desktop (`1440×900`)** and **Mobile (`375×812`)** across **Dark** and **Light** themes, paired with `scrollWidth <= innerWidth` and `axe-core` accessible-name checks.
3. **Multimodal Inspection (`read_file`)**: Call `read_file` on every captured `.png` screenshot to visually verify layout, alignment, spacing, truncation/overlap, and theme contrast; fix any visual defect before completion.
4. **Clean Teardown**: Terminate the dev server process, restore `next-env.d.ts` if touched, and never stage temporary screenshots or scratch specs.
```

### 7. Các Bước Thực Hiện Tuần Tự

- [x] **B1 — TDD Red**: Thêm kiểm tra `expect(r02).toContain("page.screenshot")` / `expect(r03).toContain("Visual QA via Playwright Screenshot Inspection")` tại `.agents/scripts/code-freeze-guard.test.ts:1573-1586` và chạy Vitest xác nhận đỏ.
- [x] **B2 — Cập nhật `.agents/rules/03-ui.md`, `.agents/rules/02-quality.md` & Sửa 5 lỗi giao diện**: Bổ sung quy tắc chi tiết ở `03-ui.md`, cổng bắt buộc ở `02-quality.md` (`always_on <= 17,000`), và sửa 5 lỗi giao diện Novelcrafter phát hiện từ ảnh chụp thực tế.
- [x] **B3 — Verification, Chụp lại ảnh & Tài liệu**: Chạy Vitest, ESLint, chụp lại bộ ảnh `next dev` + đọc bằng `read_file`, và cập nhật `docs/CHANGELOG.md`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                                        | Input / Action                                                | Kỳ vọng                                                                                                                   |
| ----- | ------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| TC-01 | `.agents/scripts/code-freeze-guard.test.ts` | Đọc `.agents/rules/02-quality.md` và `.agents/rules/03-ui.md` | Cả hai file đều chứa quy định `page.screenshot` + `read_file`; giữ nguyên đủ 15 mục Normative Preservation Matrix         |
| TC-02 | `.agents/scripts/code-freeze-guard.test.ts` | Tính tổng ký tự các file `trigger: always_on`                 | `realTotal <= 17,000` ký tự ngay cả với xuống dòng CRLF và mỗi file `.agents/rules/*.md <= 12,000` ký tự; không có bảng ` | :---` |

**Ca test cũ bị thay theo Loại C (liệt kê đích danh 2 file)**:

1. `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx:15`: đổi khóa trong `DICT` giả lập từ `novelcrafterScenesLabel` (khóa sai tên không tồn tại trong `vi.ts`/`en.ts`) sang `novelcrafterChapterBeatsLabel` và thêm khẳng định không hiển thị chuỗi `novelcrafterScenesLabel`.
2. `src/app/features/novelcrafter/components/NovelcrafterMobileAiDock.test.tsx:9`: đổi khóa trong `DICT` giả lập từ `novelcrafterWriteMenuBtn` sang `novelcrafterSlotWrite` và thêm khẳng định không hiển thị chuỗi `novelcrafterWriteMenuBtn`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot
node scripts/verify-plan.mjs docs/plans/2026-11-11-mandatory-playwright-visual-qa-rule-plan.md
```

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                | Mức        | Control                                                                                                   |
| ------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Thêm chữ vào `02-quality.md` làm tổng ký tự `always_on` vượt trần `17,000` / `18,000` | Cao        | Cô đọng ~250 ký tự diễn giải trùng lặp trong `02-quality.md`, kiểm tra trực tiếp bằng `TC-H` trong Vitest |
| Vô tình làm mất chuỗi bắt buộc trong `Normative Preservation Matrix (M5)`             | Trung bình | Đối chiếu từng dòng `.agents/scripts/code-freeze-guard.test.ts:1561-1596` và chạy Vitest ngay sau khi sửa |

### 11. Ghi Chú Triển Khai

- **Quy tắc bắt buộc Visual QA (Cách 1)**: Đã bổ sung mục `## Visual QA via Playwright Screenshot Inspection (MANDATORY)` vào `.agents/rules/03-ui.md` và cổng `Visual QA Gate` vào `.agents/rules/02-quality.md` (đồng thời rút gọn câu chữ để tổng `always_on <= 17,000` ký tự cả trên Windows CRLF, giúp bài test ngân sách `TC-H` trong `.agents/scripts/code-freeze-guard.test.ts` xanh trở lại).
- **Hiệu quả thực chiến ngay lần chạy đầu tiên**: Nhờ bật `next dev`, chụp 7 ảnh `.png` ở cả Desktop/Mobile & Dark/Light rồi gọi `read_file` tự soi bằng mắt, đã phát hiện và sửa triệt để 5 lỗi mà `tsc`, `eslint`, unit test và `axe-core` không bắt được: (1) khóa dịch thiếu `novelcrafterScenesLabel` ở `NovelcrafterOutlineDetailPanel.tsx`, (2) khóa dịch thiếu `novelcrafterWriteMenuBtn` trên nút chính của `NovelcrafterMobileAiDock.tsx`, (3) khóa dịch thiếu `novelcrafterUntitledStory` ở `PromptStudioApp.tsx`, (4) chữ phụ đề cột mục lục `232px` bị ép dọc từng chữ cái một cột ở `StoryBibleTocSidebar.tsx`, và (5) 3 chip chế độ trong `NovelcrafterAiComposer.tsx` bị cắt cụt khi xếp ngang hàng với `<select>`.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: Gemini 4 Carbon (in-session theo quy trình hiện hành của PM)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-mandatory-playwright-visual-qa-rule-plan.md` → `SECTIONS 7/7`, toàn bộ `LINE_REF` PASS.
- Đã kiểm tra thực tế ngân sách ký tự `.agents/rules/` và đối chiếu 7 ảnh chụp `.png` từ `next dev`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                           | Bằng chứng                                                                                                    | Lý do / Hướng xử lý khi triển khai                                                                                   |
| --- | -------------- | ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `.agents/scripts/code-freeze-guard.test.ts:1899`                                      | [SRC] `expect(realTotal).toBeLessThanOrEqual(17000)` đang báo `17159` trên Windows CRLF                       | Cô đọng `02-quality.md` xuống ~`5.540` ký tự (giữ nguyên toàn bộ từ khóa bắt buộc ở dòng `1574-1585`) để `<= 17000`. |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx:15` | [SRC] `DICT` giả lập đặt `novelcrafterScenesLabel: "Phân cảnh"` che khuất khóa bị thiếu trong `vi.ts`/`en.ts` | Khai báo tường minh Loại C tại §8: đổi sang `novelcrafterChapterBeatsLabel` và khẳng định không lộ khóa thô.         |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleTocSidebar.tsx:78-106`            | [SRC] Khối nút `shrink-0` chiếm gần hết chiều ngang `232px` làm `<h2>`/`<p>` bị ép thành cột chữ dọc 1 ký tự  | Chuyển sang xếp dọc `md:flex-col` trên màn hình `md+` để tiêu đề và phụ đề có trọn chiều ngang cột `232px`.          |

#### Kết Luận

Không có `[BLOCKER]` hay `[MAJOR]`. Đủ 2 file test Loại C liệt kê đích danh; ngân sách ký tự rules và 5 lỗi hiển thị từ ảnh chụp thực tế được kiểm soát đầy đủ.

[PLAN_APPROVED]

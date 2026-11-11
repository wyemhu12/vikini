# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 3D: Tên Truy Cập Cho Control Icon-Only (C3) + Test a11y

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: Giai đoạn 1–3C (commit `4836125`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: audit **C3** ("14 control không có tên cho trình đọc màn hình … thêm `aria-label` lấy từ bản dịch vi/en … thêm một test e2e chạy axe trên mỗi route để chặn lỗi này tái diễn"), Lộ trình 3D của plan 3C, và các việc 3C đã dời sang 3D.

**Hiện trạng đo thật (2026-11-11)**: quét axe-core 4.11.1 bằng Playwright + mock (`tests/e2e/helpers`) trên 7 route × 1440/375px. Nhiều lỗi C3 trong audit đã được xử lý ở 2A–3C. Còn **6 lỗi tên truy cập**:

| Route                   | Rule axe      | Phần tử                                                     | Nguồn                                                                     |
| ----------------------- | ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/images` (cả 2 cỡ)     | `button-name` | Nút ⚙ (Button ghost icon) mở Settings của Studio            | `src/app/features/image-gen/components/ControlPanel.tsx:225-227`          |
| `/images` (cả 2 cỡ)     | `button-name` | Switch "AI Enhance" (Radix, không nhãn)                     | `src/app/features/image-gen/components/ControlPanel.tsx:464-468`          |
| `/images` (cả 2 cỡ)     | `button-name` | Trigger chọn model (Radix Select `role="combobox"`)         | `src/app/features/image-gen/components/ControlPanel.tsx:477`              |
| `/gallery` (cả 2 cỡ)    | `select-name` | `<select>` lọc thời gian                                    | `src/app/features/gallery/components/GalleryView.tsx:64-68`               |
| `/?id=…` (cả 2 cỡ)      | `svg-img-alt` | Logo provider `svg role="img"` không có tên trong avatar AI | `src/app/features/chat/components/ModelAvatar.tsx:15`                     |
| `/novelcrafter` (375px) | `button-name` | Nút "Cài đặt GEM & Persona" — nhãn `hidden sm:inline`       | `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:237-244` |

Grep thêm (axe không thấy vì phần tử không render trong mock): nút "Mở rộng / Thu gọn tất cả" (`src/app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx:82-97`) và nút "Đẩy sang Phân cảnh Chương" (`src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx:496-505`) cũng chỉ còn icon dưới `sm`, không có `aria-label`; `<select>` lọc model của Gallery (`src/app/features/gallery/components/GalleryView.tsx:81-85`) cũng thiếu nhãn (chỉ hiện khi có ảnh).

Mục tiêu:

1. **Đặt tên cho 9 control trên** bằng `aria-label` từ bản dịch (tái dùng key có sẵn nếu có). Logo provider trong avatar là trang trí (tên model đã hiện cạnh avatar từ 3B) → `aria-hidden="true"` + `focusable="false"` thay cho `role="img"`. Switch "AI Enhance" có `aria-describedby` trỏ dòng mô tả.
2. **Test chặn tái diễn**: `tests/e2e/a11y.spec.ts` chạy axe trên 7 route × 2 cỡ màn hình (+ mở sheet "Tùy chọn" của composer trên mobile), **fail** khi có vi phạm thuộc nhóm tên truy cập (`button-name`, `link-name`, `select-name`, `label`, `aria-toggle-field-name`, `aria-input-field-name`, `input-button-name`, `aria-command-name`, `svg-img-alt`, `image-alt`); các rule khác chỉ in ra (không fail) để tránh nhiễu từ dữ liệu mock.
3. **Việc dời từ 3C**:
   - `GemQuickSwitch`: chuỗi cứng "No GEMs found", "Remove GEM", toast "Failed to apply gem" → bản dịch; `.catch(() => {})` câm khi tải danh sách Gem (`src/app/features/gems/components/GemQuickSwitch.tsx:40`) → `logger.error` + `toast.error` (quy tắc cấm catch câm).
   - Nhãn "off" khi đổi mức suy luận rồi tạo lại dùng `webSearchOff` ("TẮT") → `thinkingOff` (`src/app/features/chat/components/hooks/useThinkingRegenerate.ts:14`).
   - Nhãn "CHẾ ĐỘ TẠO ẢNH" trong ô nhập: bỏ `uppercase tracking-wider`, giá trị dịch thành chữ thường "Chế độ tạo ảnh" / "Image generation mode" (`src/app/features/chat/components/InputForm.tsx:276-277`).

**Out of Scope (What We're NOT Doing)**:

- Tooltip Radix cho thanh thao tác tin nhắn — 3B đã có `aria-label` + `title` gốc (tooltip của trình duyệt); thêm `TooltipProvider` toàn cục là thay đổi layout riêng.
- Đổi màu, bố cục, chữ in hoa trong Image Studio / Gallery (Giai đoạn 4). 3D chỉ thêm thuộc tính tên truy cập vào `ControlPanel.tsx`/`GalleryView.tsx`.
- Sửa các vi phạm axe ngoài nhóm tên truy cập (contrast, heading-order…) — test chỉ in ra để theo dõi.
- Bật rule `eslint-plugin-jsx-a11y` (sửa `eslint.config.mjs` là thay đổi hạ tầng test, để Giai đoạn 6 cùng đợt lint).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                  | Nội dung rút ra                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Audit UX (`VkdrnhBqKgJiS614bdbmYV`) mục C3, lộ trình "Giai đoạn 0"                   | Danh sách control thiếu tên lúc audit; đề xuất test axe mỗi route                          |
| Kết quả quét axe 2026-11-11 (14 lần quét, JSON + ảnh trong scratchpad QA)            | 6 vi phạm còn lại ở bảng §1                                                                |
| `docs/plans/2026-11-10-vikini-3-phase-3c-composer-plan.md` §1 Out of Scope, Lộ Trình | Việc dời sang 3D                                                                           |
| `tests/e2e/fixtures.ts`, `tests/e2e/helpers/*`, `playwright.config.ts`               | Fixture `authedPage` có network guard chế độ enforce; mock session/chat/projects/image-gen |
| Các file nguồn ở bảng §1                                                             | Vị trí cần sửa                                                                             |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                        | Lý do nạp                                             | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/add-translation/SKILL.md` | Key mới cho Gem/Gallery, đổi giá trị `imageModeLabel` | Thêm vào **cả** `vi.ts`/`en.ts`; tái dùng key có sẵn (`settings`, `studioAiEnhance`, `studioModel`, `galleryDateFilter`, `novelcrafterRoutingButton`, `novelcrafterExpandAllCards`, `novelcrafterCollapseAllCards`, `novelcrafterSendToChapterScenesBtn`, `thinkingOff`) |
| `.agents/skills/vikini-audit/SKILL.md`    | Rà tuân thủ a11y / bilingual trên vùng sửa            | Mọi nhãn mới lấy từ `t()`, không chuỗi cứng; không đổi hành vi ngoài thuộc tính a11y                                                                                                                                                                                     |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                      | Bằng chứng                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `axe-core@4.11.1` đã có trong `node_modules` nhưng chỉ là phụ thuộc bắc cầu (`eslint-config-next` → `eslint-plugin-jsx-a11y` → `axe-core`)            | `[CMD]` `npm ls axe-core` → `eslint-config-next@16.4.0 └ eslint-plugin-jsx-a11y@6.10.2 └ axe-core@4.11.1`                                                                                                                                       |
| A2  | `@playwright/test` là devDependency; có script `test:e2e`                                                                                             | `[SRC]` `package.json:87`, `package.json:23`                                                                                                                                                                                                    |
| A3  | Fixture `authedPage` bật network guard **enforce** — route chưa mock sẽ làm test fail; QA trước dùng `page.route("**/api/**")` trả `{}` đăng ký trước | `[SRC]` `tests/e2e/fixtures.ts:14-16`, `tests/e2e/helpers/network-guard.ts:7-11`                                                                                                                                                                |
| A4  | Switch AI Enhance có `pointer-events-none`, thẻ cha `div onClick` bật/tắt; vẫn nhận focus bàn phím nên phải có tên                                    | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:435-436`, `src/app/features/image-gen/components/ControlPanel.tsx:464-468`                                                                                                      |
| A5  | Avatar AI đặt cạnh tên model hiển thị (3B) → logo là trang trí                                                                                        | `[SRC]` `src/app/features/chat/components/BubbleAvatar.tsx:141`, `src/app/features/chat/components/ModelAvatar.tsx:185-190`                                                                                                                     |
| A6  | `GemQuickSwitch` có catch câm và 3 chuỗi cứng; `PersonaQuickSwitch` đã dùng key dịch (`personaNoneFound`, `personaRemove`, `personaApplyFailed`)      | `[SRC]` `src/app/features/gems/components/GemQuickSwitch.tsx:40`, `src/app/features/gems/components/GemQuickSwitch.tsx:60`, `src/app/features/gems/components/GemQuickSwitch.tsx:95`, `src/app/features/gems/components/GemQuickSwitch.tsx:103` |
| A7  | Test `InputForm` mock `t` trả "IMAGE GENERATION MODE" cho `imageModeLabel` — đổi giá trị dịch/class không làm đỏ ca cũ                                | `[SRC]` `src/app/features/chat/components/InputForm.test.tsx:26`                                                                                                                                                                                |
| A8  | `ModelAvatar.test.tsx` chỉ khẳng định gradient/stop, không khẳng định `role="img"`                                                                    | `[SRC]` `src/app/features/chat/components/ModelAvatar.test.tsx:13-20`                                                                                                                                                                           |
| A9  | `StoryBibleStructuredCards.tsx` đã 530 dòng (> 500) — chỉ thêm 1 thuộc tính, không tách file trong 3D                                                 | `[CMD]` `wc -l` → 530                                                                                                                                                                                                                           |

**Cross-Task Dependencies**: Giai đoạn 4 sẽ làm lại giao diện `ControlPanel`/`GalleryView`; test a11y của 3D là lưới an toàn cho Giai đoạn 4 (không được làm mất tên đã thêm).

**Quyết định sản phẩm (Default Assumption)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Phụ thuộc axe**: _Default_ khai báo `axe-core` **4.11.1** là devDependency trực tiếp (đúng bản đã cài, chỉ đổi `package.json` + mục gốc của `package-lock.json` qua `npm install -D axe-core@4.11.1 --package-lock-only`), không thêm `@axe-core/playwright`. Lý do: không dựa vào phụ thuộc bắc cầu có thể biến mất khi `eslint-config-next` đổi. Đụng file hạ tầng (`package.json`, `package-lock.json`) → Critic Pass; PM đã miễn Critic ở các plan trước — ghi chú lại ở Audit.
- `[NEEDS_PRODUCT_DECISION]` **D2 — Phạm vi fail**: _Default_ test chỉ fail với nhóm rule tên truy cập (§1.2); các rule khác in ra.

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json`             | Phiên bản | Ghi chú                                                         | Nguồn                     |
| ------------------ | -------------------------- | --------- | --------------------------------------------------------------- | ------------------------- |
| `axe-core`         | (chưa khai báo) → `4.11.1` | 4.11.1    | Inject bằng `page.addScriptTag({ path })`, gọi `window.axe.run` | `[CMD]` `npm ls axe-core` |
| `@playwright/test` | `^1.62.1`                  | 1.62.x    | Chạy e2e                                                        | `[SRC]` `package.json:87` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `tests/e2e/a11y.spec.ts` — quét axe (§6.1).
- `[MODIFY]` `package.json`, `package-lock.json` — devDependency `axe-core` 4.11.1 (D1).
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.tsx` — `aria-label` cho nút ⚙ (`t("settings")`), Switch (`t("studioAiEnhance")` + `aria-describedby`), SelectTrigger (`t("studioModel")`).
- `[NEW]` `src/app/features/image-gen/components/ControlPanel.test.tsx` — TC-01.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx` — `aria-label` cho 2 `<select>` (`galleryDateFilter`, key mới `galleryModelFilter`).
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.test.tsx` — TC-02 (chỉ thêm ca).
- `[MODIFY]` `src/app/features/chat/components/ModelAvatar.tsx` — 7 logo: `aria-hidden="true" focusable="false"` thay `role="img"`.
- `[MODIFY]` `src/app/features/chat/components/ModelAvatar.test.tsx` — TC-03 (chỉ thêm ca).
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`, `NovelcrafterHistoryPane.tsx`, `StoryBibleStructuredCards.tsx` — `aria-label` (key có sẵn).
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx` — TC-04 (render 3 component với props tối thiểu, khẳng định tên nút).
- `[MODIFY]` `src/app/features/gems/components/GemQuickSwitch.tsx` + `GemQuickSwitch.test.tsx` — TC-05, TC-06.
- `[MODIFY]` `src/app/features/chat/components/hooks/useThinkingRegenerate.ts` — `off: "thinkingOff"`.
- `[NEW]` `src/app/features/chat/components/hooks/useThinkingRegenerate.test.ts` — TC-07.
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` + `InputForm.test.tsx` — bỏ `uppercase tracking-wider` ở nhãn chế độ ảnh, fallback chữ thường; TC-08 (chỉ thêm ca).
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — key mới `galleryModelFilter` ("Lọc theo model" / "Filter by model"), `gemNoneFound` ("Chưa có Gem nào" / "No Gems yet"), `gemRemove` ("Gỡ Gem" / "Remove Gem"), `gemApplyFailed` ("Không thể áp dụng Gem" / "Couldn't apply the Gem"), `gemLoadFailed` ("Không thể tải danh sách Gem" / "Couldn't load Gems"); đổi giá trị `imageModeLabel` → "Chế độ tạo ảnh" / "Image generation mode".
- `[MODIFY]` `docs/CHANGELOG.md`; `[MODIFY]` `docs/architecture.md` (mục kiểm thử: có `tests/e2e/a11y.spec.ts`).

### 6. Caller-First Design Sketch

**6.1 `tests/e2e/a11y.spec.ts`**

```ts
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mockAuthenticatedSession } from "./helpers/mock-session";
import { setupMockChat } from "./helpers/mock-chat";
import { setupMockProjects } from "./helpers/mock-projects";
import { setupMockImageGen } from "./helpers/mock-image-gen";

const AXE_PATH = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
const NAME_RULES = [
  "button-name",
  "link-name",
  "select-name",
  "label",
  "aria-toggle-field-name",
  "aria-input-field-name",
  "input-button-name",
  "aria-command-name",
  "svg-img-alt",
  "image-alt",
];
const ROUTES = [
  "/",
  "/?id=conv-e2e-123",
  "/images",
  "/gallery",
  "/describe",
  "/gems",
  "/novelcrafter",
];

async function setup(page: Page) {
  // Catch-all registered FIRST so specific mocks below win (Playwright matches last-registered first).
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await mockAuthenticatedSession(page);
  await setupMockChat(page, {
    messages: [
      /* 1 user + 1 assistant */
    ],
  });
  await setupMockProjects(page);
  await setupMockImageGen(page);
}

async function nameViolations(page: Page) {
  await page.addScriptTag({ path: AXE_PATH });
  const all = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
  const blocking = all.violations.filter((v) => NAME_RULES.includes(v.id));
  for (const v of all.violations.filter((v) => !NAME_RULES.includes(v.id)))
    console.warn(`[a11y:info] ${v.id} ×${v.nodes.length}`);
  return blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const vp of [
  { w: 1440, h: 900, tag: "desktop" },
  { w: 375, h: 812, tag: "mobile" },
]) {
  for (const route of ROUTES) {
    test(`a11y names ${vp.tag} ${route}`, async ({ page }) => {
      /* setViewport, setup, goto, wait, expect(await nameViolations(page)).toEqual([]) */
    });
  }
}
test("a11y names mobile composer options sheet", async ({ page }) => {
  /* 375px, mở "Tùy chọn", quét */
});
```

Không dùng fixture `authedPage` (network guard enforce + thứ tự route ngược, A3). Kiểu `window.axe` khai báo cục bộ trong file bằng `declare global` tối thiểu (không `any`).

**6.2 Thuộc tính thêm (ví dụ)**

```tsx
<Button variant="ghost" size="icon" aria-label={t("settings")} title={t("settings")} onClick={…}>
<Switch aria-label={t("studioAiEnhance")} aria-describedby={enhanceDescId} … />   // enhanceDescId = useId()
<SelectTrigger aria-label={t("studioModel")} …>
<select aria-label={g.t("galleryDateFilter")} …>
<svg aria-hidden="true" focusable="false" viewBox=…>   // ModelAvatar logos
<button aria-label={t("novelcrafterRoutingButton")} …>
```

**6.3 `GemQuickSwitch` tải danh sách**

```ts
.catch((error: unknown) => {
  logger.error("[GemQuickSwitch] Failed to load gems:", error);
  toast.error(t("gemLoadFailed"));
  setGems([]);
})
```

Kèm kiểm `r.ok` như `PersonaQuickSwitch` (`src/app/features/personas/components/PersonaQuickSwitch.tsx:41-44`); effect thêm `t` vào dependency.

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-08 → **đỏ**; chạy `a11y.spec.ts` trên code hiện tại → **đỏ** đúng 6 vi phạm ở §1 (chứng minh test bắt được).
- [ ] **B2 — `package.json`/`package-lock.json`** (D1) bằng `npm install -D axe-core@4.11.1 --package-lock-only`.
- [ ] **B3 — Thêm tên truy cập** (ControlPanel, GalleryView, ModelAvatar, Novelcrafter ×3).
- [ ] **B4 — Việc dời từ 3C** (GemQuickSwitch, useThinkingRegenerate, InputForm) + i18n.
- [ ] **B5 — Verify** §9; chạy lại `a11y.spec.ts` → **xanh** 15/15.
- [ ] **B6 — Living docs**.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                             | Input                                                           | Kỳ vọng                                                                                                                                                                |
| ----- | -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `ControlPanel.test.tsx`          | render với props tối thiểu                                      | `getByRole("button", { name: "Cài đặt" })`; `getByRole("switch", { name: "AI Enhance" })` có mô tả = `studioAiEnhanceDesc`; `getByRole("combobox", { name: "Model" })` |
| TC-02 | `GalleryView.test.tsx`           | render (mock controller có `availableModels`)                   | `getByRole("combobox", { name: "Lọc theo thời gian" })`, `getByRole("combobox", { name: "Lọc theo model" })`                                                           |
| TC-03 | `ModelAvatar.test.tsx`           | mỗi loại model (gemini, claude, deepseek, gpt, groq, glm, khác) | `svg` có `aria-hidden="true"`, `focusable="false"`, **không** có `role="img"`; `queryAllByRole("img")` rỗng                                                            |
| TC-04 | `NovelcrafterA11yNames.test.tsx` | 3 component với props tối thiểu                                 | Nút routing có tên "Cài đặt GEM & Persona"; nút mở/thu gọn có tên theo trạng thái; nút đẩy phân cảnh có tên "Đẩy sang Phân cảnh Chương"                                |
| TC-05 | `GemQuickSwitch.test.tsx`        | mở popover, `fetch` trả `{ gems: [] }`                          | Hiện "Chưa có Gem nào" (không còn "No GEMs found"); có Gem hiện tại → mục "Gỡ Gem"                                                                                     |
| TC-06 | `GemQuickSwitch.test.tsx`        | `fetch` reject / `ok: false` (Negative)                         | `logger.error` và `toast.error("Không thể tải danh sách Gem")` mỗi thứ 1 lần; áp dụng Gem lỗi → `toast.error("Không thể áp dụng Gem")`                                 |
| TC-07 | `useThinkingRegenerate.test.ts`  | đổi mức sang `"off"`                                            | Nhãn dùng `t("thinkingOff")`, **không** gọi `t("webSearchOff")`                                                                                                        |
| TC-08 | `InputForm.test.tsx`             | chế độ tạo ảnh                                                  | Nhãn chế độ không có class `uppercase`/`tracking-wider`                                                                                                                |
| E2E   | `tests/e2e/a11y.spec.ts`         | 7 route × 2 cỡ + sheet composer                                 | 0 vi phạm nhóm tên truy cập ở 15/15 ca                                                                                                                                 |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có** — mọi file test có sẵn chỉ được **thêm** ca (A7, A8). Nếu khi chạy một ca cũ đỏ, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/image-gen src/app/features/gallery src/app/features/chat src/app/features/novelcrafter src/app/features/gems --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts   # server dev 3100 + env giả như playwright.config.ts
npx prettier --check --end-of-line auto <các file đã sửa>
```

**Wiring Probes**: W1 Grep `role="img"` trong `ModelAvatar.tsx` → 0. W2 Grep `No GEMs found|Remove GEM|Failed to apply gem` trong `src/app/features/gems` → 0. W3 Grep `webSearchOff` trong `useThinkingRegenerate.ts` → 0. W4 `npm ls axe-core` → có dòng gốc `axe-core@4.11.1` (không chỉ qua `eslint-config-next`).

**Negative Probes** (hoàn tác sau mỗi probe): N1 bỏ `aria-label` của nút ⚙ → TC-01 đỏ **và** `a11y.spec.ts` `/images` đỏ. N2 trả `role="img"` cho logo Gemini → TC-03 đỏ. N3 trả `.catch(() => {})` → TC-06 đỏ. N4 trả `off: "webSearchOff"` → TC-07 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                       | Mức        | Control                                                                                                         |
| ---------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `npm install --package-lock-only` đổi lock ngoài mục `axe-core`              | Trung bình | `git diff package-lock.json` chỉ được có dòng thêm `axe-core` ở `devDependencies` gốc; khác → hoàn tác, sửa tay |
| Test e2e chập chờn (route render chậm với webpack dev)                       | Trung bình | Chờ `networkidle` + phần tử chính của trang; timeout 60s cho lần biên dịch đầu                                  |
| `aria-label` đè nhãn hiển thị gây lệch giữa tên đọc và chữ thấy (WCAG 2.5.3) | Thấp       | `aria-label` dùng **đúng** chuỗi của nhãn hiển thị (cùng key dịch)                                              |
| Test render component Novelcrafter cần nhiều props/store                     | Trung bình | Mock store/hook ở mức module; nếu quá nặng, khẳng định qua render component con tối thiểu                       |

### Lộ Trình

| Bước | Nội dung                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------- |
| 3D   | **Plan này** — tên truy cập còn thiếu (C3) + test axe e2e; dọn việc dời từ 3C                   |
| 4    | Ảnh: header "Ảnh" + tab Tạo ảnh / Thư viện / Mô tả ảnh, token màu Studio, M3, M5                |
| 5    | Novelcrafter theo canvas (H1)                                                                   |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô + jsx-a11y, gỡ alias token |

### 11. Ghi Chú Triển Khai (sai khác so với plan)

- **`GemQuickSwitch` gọi API lặp vô hạn khi danh sách rỗng**: thêm `t` vào dependency của effect (theo §6.3) làm lộ vòng lặp sẵn có (`gems.length === 0` → tải lại sau mỗi lần render). Sửa bằng `requestedRef`: chỉ tải một lần mỗi lần mở popover, đóng thì cho phép tải lại. TC-06 bắt được lỗi này (logger bị gọi 6 lần).
- **TC-04 (Novelcrafter)**: jsdom không áp dụng `hidden sm:inline` nên nhãn ẩn vẫn tạo tên; test khẳng định thêm thuộc tính `aria-label` (tên còn lại trên mobile).
- **Negative Probe N1**: bỏ riêng `aria-label` của nút ⚙ không làm đỏ vì `title` vẫn cho tên; probe đúng là bỏ cả `aria-label` + `title` → TC-01 và e2e `/images` đều đỏ.
- **E2E B1**: trước khi sửa, `a11y.spec.ts` đỏ đúng 7 ca (6 vi phạm ở §1 × cỡ màn hình); sau khi sửa 15/15 xanh.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây"); Critic Pass miễn theo cách PM đã chọn ở các plan trước (`CRITIC_REQUIRED no`) — dù plan chạm `package.json`/`package-lock.json` (D1), PM có thể yêu cầu chạy Critic]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-3d-a11y-names-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS toàn bộ, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- 6 vi phạm ở §1 khớp JSON quét axe 2026-11-11; 3 control bổ sung khớp source (`NovelcrafterHistoryPane.tsx:82-97`, `StoryBibleStructuredCards.tsx:496-505`, `GalleryView.tsx:81-85`). Key tái dùng đều tồn tại (`settings`, `studioAiEnhance`, `studioModel`, `galleryDateFilter`, `novelcrafterRoutingButton`, `novelcrafterExpandAllCards`, `novelcrafterSendToChapterScenesBtn`, `thinkingOff`).

#### Critic Findings

| #   | Loại          | Mức     | `file:line`                                                                  | Bằng chứng                                                                                                                                   | Lý do / Hướng xử lý khi code                                                                                                                                |
| --- | ------------- | ------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT        | [MINOR] | `tests/e2e/helpers/mock-image-gen.ts:8`                                      | [SRC] Mock tin nhắn mẫu được khai báo kiểu `FrontendMessage` (`SAMPLE_IMAGE_MESSAGE`)                                                        | Sketch §6.1 để `messages: [/* … */]`; khi code phải khai báo `FrontendMessage[]` đúng kiểu như helper có sẵn, **không** ép `as never`/`as any` (cấm `any`). |
| 2   | DEFECT        | [MINOR] | `src/app/features/image-gen/components/ControlPanel.tsx:126`                 | [SRC] `ControlPanel` nhận rất nhiều props và render `SettingsModal` bên trong (`src/app/features/image-gen/components/ControlPanel.tsx:215`) | TC-01 dựng `makeProps()` đầy đủ kiểu, mock `SettingsModal` và `useLanguage`; không đổi props component để dễ test.                                          |
| 3   | RISK_ACCEPTED | [MINOR] | `playwright.config.ts:26-31`                                                 | [SRC] `webServer` mặc định chạy `npm run dev` (Turbopack); worktree hiện dùng `node_modules` dạng junction mà Turbopack từ chối              | Chỉ ảnh hưởng máy cục bộ của worktree: khi verify, tự chạy `next dev --webpack -p 3100` trước (`reuseExistingServer` true ngoài CI). CI không bị ảnh hưởng. |
| 4   | RISK_ACCEPTED | [MINOR] | `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx:496` | [CMD] `wc -l` → 530 dòng (> 500)                                                                                                             | 3D chỉ thêm 1 thuộc tính; tách file để đợt Novelcrafter (Giai đoạn 5).                                                                                      |

#### Kết Luận

Không có `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-03, TC-06, TC-07) và Negative Probe N1–N4; e2e chứng minh bắt được lỗi ở B1 (đỏ trước khi sửa). Không có ca test cũ bị thay. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

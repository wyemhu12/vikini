# Implementation Plan: Fix `POST /api/generate-image` PostgreSQL Statement Timeout (`57014`) on `saveMessage`

- **Date**: 2026-11-22
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Status**: Completed
- **Revision**: 2

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Khắc phục triệt để lỗi production `500` do PostgreSQL hủy câu lệnh (`code: '57014', message: 'canceling statement due to statement timeout'`) khi `POST /api/generate-image` gọi `saveMessage()` để lưu ảnh vừa tạo vào bảng `messages`:

1. Loại bỏ hoàn toàn dữ liệu ảnh tham chiếu dạng base64 nặng (`referenceImage` và `referenceImages`) khỏi `savedOptions` trước khi đóng gói vào `messageMeta` tại `src/app/api/generate-image/route.ts:331-361`.
2. Giữ lại toàn bộ các tùy chọn nhẹ (`aspectRatio`, `resolution`, `numberOfImages`, `style`, `enhancer`, `enhancerModel`, `model`) và ghi nhận thông tin nhẹ `referenceImageCount` (chỉ khi có `>= 1` ảnh tham chiếu), đồng thời bảo toàn 100% dữ liệu `referenceImage`/`referenceImages` truyền vào `provider.generate(...)`.
3. Xác nhận không còn trường payload nặng nào khác trong `messageMeta` (kể cả legacy wrapper `messageMeta.metadata.originalOptions`).
4. Bổ sung unit tests co-located trong `src/app/api/generate-image/route.test.ts` để khóa chống hồi quy và hoàn tất Post-Fix Protocol (`docs/lessons-learned.md`, `docs/CHANGELOG.md`).

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** thay đổi schema database, migration SQL, hay `statement_timeout` của PostgreSQL/Supabase (sửa tận gốc phình payload JSONB ở tầng ứng dụng thay vì nới timeout che triệu chứng).
- **KHÔNG** xóa khóa legacy `messageMeta.metadata` (vẫn giữ tương thích ngược cho các reader cũ vì sau khi loại base64 khỏi `savedOptions`, object `metadata` chỉ còn vài trăm bytes).
- **KHÔNG** sửa `src/app/api/edit-image/route.ts`, `src/app/api/edit-image-multi/route.ts`, `src/lib/features/chat/messages.ts`, hay bất kỳ UI component nào (kiểm tra `src/app/api/edit-image/route.ts:241-250` xác nhận route đó không lưu base64 trong `options`; không có UI/client nào đọc `originalOptions.referenceImage(s)`).
- **KHÔNG** tái cấu trúc diện rộng `src/app/api/generate-image/route.ts` ngoài phạm vi tối giản xung quanh `savedOptions`.
- **KHÔNG** thêm/sửa chuỗi UI song ngữ (lỗi backend thuần túy, không thay đổi thông điệp UI).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

| Tài liệu / Skill đã đọc bằng `read_file`                            | Trạng thái                                                                  | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/02-quality.md`                                       | Đã đọc                                                                      | Áp dụng Pre-Work Protocol, Post-Fix Protocol 5 bước, lệnh PowerShell 5.1 dùng `;` (cấm `&&`), và Test Failure Triage Protocol.                                                                                                        |
| `.agents/skills/api-patterns/SKILL.md`                              | Đã đọc                                                                      | Giữ nguyên chuẩn response `{ success, data }` / `{ success: false, error }`, `AppError`, và `unknown` narrowing trong `src/app/api/generate-image/route.ts`.                                                                          |
| `.agents/skills/vikini-debug/SKILL.md`                              | Đã đọc                                                                      | Thực thi đủ Debugging 5 bước (đối chiếu working pattern ở `src/app/api/edit-image/route.ts:241-250`) + Post-Fix Protocol (ghi `docs/lessons-learned.md` mục `Database and Queries` và cập nhật `docs/CHANGELOG.md`).                  |
| `docs/lessons-learned.md`                                           | Đã đọc (`docs/lessons-learned.md:1-100`, `docs/lessons-learned.md:250-450`) | Xác nhận chưa có bài học về JSONB bloat / `57014` statement timeout do nhúng base64 vào `messages.meta`; sẽ bổ sung mục mới dưới `## Database and Queries` (`docs/lessons-learned.md:325`).                                           |
| `docs/CHANGELOG.md`                                                 | Đã đọc (`docs/CHANGELOG.md:1-60`)                                           | Ghi nhận định dạng newest-first để bổ sung bản ghi sửa lỗi sau khi hoàn tất.                                                                                                                                                          |
| `src/app/api/generate-image/route.ts`                               | Đã đọc toàn bộ (`1-426`)                                                    | Xác nhận root cause tại `src/app/api/generate-image/route.ts:331-361` và rà soát toàn bộ trường trong `messageMeta`.                                                                                                                  |
| `src/app/api/generate-image/route.test.ts`                          | Đã đọc toàn bộ (`1-1120`)                                                   | Nắm cấu trúc mock `saveMessage`, `ImageGenFactory`, `mockSupabaseFrom` để viết thêm test cases khớp style hiện hữu.                                                                                                                   |
| `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts` | Đã đọc (`60-160`)                                                           | Xác nhận logic chuẩn hóa ảnh tham chiếu tại `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74` để đồng bộ cách tính `referenceImageCount`.                                                                     |
| `eslint.config.mjs`                                                 | Đã đọc toàn bộ (`1-167`)                                                    | Xác nhận quy tắc `@typescript-eslint/no-unused-vars` cho phép `varsIgnorePattern: "^_"` (`eslint.config.mjs:59-66`), nên destructuring loại bỏ `referenceImage: _referenceImage, referenceImages: _referenceImages` sạch ESLint 100%. |

---

### 3. Assumptions & Cross-Task Dependencies

#### Assumptions (kèm dẫn chứng `[SRC]`)

1. **Root cause xác nhận tại `savedOptions` nhân đôi base64 vào JSONB**:
   - `[SRC]` `src/app/api/generate-image/route.ts:23-52`: `imageGenOptionsSchema` chấp nhận `referenceImage: z.string().optional()` và `referenceImages: z.array(z.string()).max(4).optional()` (chuỗi Data URI base64 không giới hạn độ dài, mỗi ảnh có thể vài MB).
   - `[SRC]` `src/app/api/generate-image/route.ts:331-361`: `const savedOptions = { ...options, model: effectiveModel };` sao chép nguyên si cả `referenceImage` lẫn `referenceImages`, sau đó nhúng `savedOptions` **2 lần** vào `messageMeta` (dòng `340` tại `originalOptions` và dòng `359` tại `metadata.originalOptions`), đẩy payload JSONB hàng chục MB vào `saveMessage()` (`src/lib/features/chat/messages.ts:130-150`), vượt ngưỡng `statement_timeout` của PostgreSQL (`57014`).
2. **Không có consumer nào (client/server) đọc `originalOptions.referenceImage(s)`**:
   - Đã kiểm tra codebase: không có thành phần UI (Image Studio, Gallery, Chat Bubble) hay API route nào đọc `meta.originalOptions.referenceImage` hoặc `meta.originalOptions.referenceImages`.
3. **Không còn trường payload nặng nào khác trong `messageMeta`**:
   - `[SRC]` `src/app/api/generate-image/route.ts:336-361`: Kiểm tra từng trường còn lại của `messageMeta`:
     - `type` (`"image_gen"`), `provider` (tên chuỗi ngắn), `imageUrl` (`finalUrl` là Supabase signed URL ngắn), `attachment` (`url`, `storagePath`, `mimeType`, `filename`), `usage` (số token nhỏ), `aiComment` (text ngắn), `prompt` / `originalPrompt` / `enhancedPrompt` (text prompt bị giới hạn đầu vào `max(10000)` tại `src/app/api/generate-image/route.ts:55`).
     - `metadata` (`{ imageUrl, prompt, originalOptions: savedOptions }`) chỉ lặp lại các trường nhẹ sau khi `savedOptions` đã được làm sạch base64.
4. **Hành vi `provider.generate(...)` không bị ảnh hưởng**:
   - `[SRC]` `src/app/api/generate-image/route.ts:246`: `provider.generate(prompt, options as ImageGenOptions, apiKey)` chạy ở Bước 3, trước Bước 5 (`savedOptions` ở dòng `331`). Destructuring ở dòng `331` không mutate `options`, đảm bảo `provider.generate(...)` luôn nhận nguyên vẹn `referenceImage` và `referenceImages`.
5. **Cleanup ảnh mồ côi khi `saveMessage` lỗi đã có sẵn**:
   - `[SRC]` `src/app/api/generate-image/route.ts:381-394`: Đã có `supabase.storage.from(bucket).remove([storagePath])` trong `catch` của `saveMessage`. Không cần sửa thêm.

#### Cross-Task Dependencies

- Không phụ thuộc vào task hay PR nào khác. Có thể triển khai độc lập hoàn toàn.

---

### 4. Bảng Verified Versions

| Thư viện / Công cụ      | Phiên bản dự án | Nguồn xác minh             | Ghi chú tương thích (2026)                                                                                                                                                                                                                 |
| ----------------------- | --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `next`                  | `^16.4.0`       | `[SRC]` `package.json:64`  | App Router Route Handlers (`POST(req: NextRequest)`, `export const maxDuration = 300`).                                                                                                                                                    |
| `@supabase/supabase-js` | `^2.89.0`       | `[SRC]` `package.json:52`  | PostgREST insert JSONB; lỗi PostgreSQL `57014` (`canceling statement due to statement timeout`) xảy ra khi câu lệnh vượt `statement_timeout` của role trên Supabase (`[URL]` https://supabase.com/docs/guides/database/postgres/timeouts). |
| `@google/genai`         | `^2.10.0`       | `[SRC]` `package.json:40`  | Dùng cho prompt enhancer và `GeminiNativeImageProvider`.                                                                                                                                                                                   |
| `zod`                   | `^4.2.1`        | `[SRC]` `package.json:80`  | Validate `imageGenRequestSchema` tại `src/app/api/generate-image/route.ts:54-59`.                                                                                                                                                          |
| `vitest`                | `^4.1.12`       | `[SRC]` `package.json:118` | Chạy co-located unit tests (`npx vitest run src/app/api/generate-image/route.test.ts`).                                                                                                                                                    |
| `typescript`            | `^5.9.3`        | `[SRC]` `package.json:116` | Strict mode, cấm `any`.                                                                                                                                                                                                                    |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/app/api/generate-image/route.ts` — Loại bỏ `referenceImage` và `referenceImages` khỏi `savedOptions` trước khi lưu `messageMeta`, thêm `referenceImageCount` khi có ảnh tham chiếu.
- `[MODIFY]` `src/app/api/generate-image/route.test.ts` — Bổ sung bộ test co-located kiểm chứng sanitization của `saveMessage` metadata, giữ nguyên option nhẹ, và bảo toàn input truyền cho `provider.generate(...)`.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi bài học mới dưới mục `## Database and Queries` theo Post-Fix Protocol.
- `[MODIFY]` `docs/CHANGELOG.md` — Ghi bản cập nhật mới nhất ở đầu file theo Post-Fix Protocol.

---

### 6. Caller-First Design Sketch

Thay đổi thuần nội bộ trong `POST` handler của `src/app/api/generate-image/route.ts` (không thay đổi HTTP request/response contract với caller). Tại `src/app/api/generate-image/route.ts:331-334`:

```ts
// Strip heavy base64 reference image payloads before persisting to PostgreSQL JSONB
const safeOptions: NonNullable<typeof options> = options ?? {};
const {
  referenceImage: _referenceImage,
  referenceImages: _referenceImages,
  ...persistedOptions
} = safeOptions;

const referenceImageCount =
  _referenceImages && _referenceImages.length > 0
    ? _referenceImages.length
    : _referenceImage
      ? 1
      : 0;

const savedOptions = {
  ...persistedOptions,
  model: effectiveModel,
  ...(referenceImageCount > 0 ? { referenceImageCount } : {}),
};
```

**Phía test (Caller Assertion Sketch tại `src/app/api/generate-image/route.test.ts`)**:

```ts
// 1. Provider vẫn nhận đầy đủ referenceImage / referenceImages để sinh ảnh
expect(generateSpy).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({
    referenceImage: singleRefDataUri,
    referenceImages: [refDataUri1, refDataUri2],
  }),
  undefined
);

// 2. saveMessage KHÔNG BAO GIỜ nhận referenceImage hoặc referenceImages ở cả 2 vị trí
const savedMeta = vi.mocked(saveMessage).mock.calls[0][4] as {
  originalOptions: Record<string, unknown>;
  metadata: { originalOptions: Record<string, unknown> };
};
expect(savedMeta.originalOptions).not.toHaveProperty("referenceImage");
expect(savedMeta.originalOptions).not.toHaveProperty("referenceImages");
expect(savedMeta.metadata.originalOptions).not.toHaveProperty("referenceImage");
expect(savedMeta.metadata.originalOptions).not.toHaveProperty("referenceImages");

// 3. Các option nhẹ và referenceImageCount được giữ nguyên
expect(savedMeta.originalOptions).toEqual({
  aspectRatio: "16:9",
  resolution: "4K",
  numberOfImages: 1,
  style: "photorealistic",
  enhancer: false,
  model: "gemini-3-pro-image",
  referenceImageCount: 2,
});
expect(savedMeta.metadata.originalOptions).toEqual(savedMeta.originalOptions);
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [ ] **Bước 1**: Mở `src/app/api/generate-image/route.ts` tại vùng `331-334`, thay khối `const savedOptions = { ...options, model: effectiveModel };` bằng gán kiểu tường minh `const safeOptions: NonNullable<typeof options> = options ?? {};` rồi destructure `safeOptions` để loại bỏ `referenceImage` và `referenceImages`, tính `referenceImageCount` (chỉ đính kèm vào `savedOptions` khi `> 0`), giữ nguyên mọi trường nhẹ còn lại và `model: effectiveModel`.
- [ ] **Bước 2**: Chạy `npm run type-check` (Tier 1) để đảm bảo không phát sinh lỗi kiểu strict TypeScript.
- [ ] **Bước 3**: Mở `src/app/api/generate-image/route.test.ts`, thêm `describe("Message Metadata Sanitization - Prevent JSONB Statement Timeout (TC-GI-META-01..04)", ...)` ngay trước `TC-IMG-09` (`src/app/api/generate-image/route.test.ts:1116`), bao phủ đầy đủ các test cases trong Test Contract (§8).
- [ ] **Bước 4**: Chạy targeted test `npx vitest run src/app/api/generate-image/route.test.ts` để xác nhận tất cả test mới và cũ đều xanh.
- [ ] **Bước 5**: Cập nhật `docs/lessons-learned.md` dưới mục `## Database and Queries` (`docs/lessons-learned.md:325`) theo mẫu 4 dòng (`Symptom`, `Root Cause`, `Fix`, `Prevention Rule`) của `.agents/skills/vikini-debug/SKILL.md`.
- [ ] **Bước 6**: Cập nhật `docs/CHANGELOG.md` ở đầu danh sách (`docs/CHANGELOG.md:11`) mô tả ngắn gọn bản vá `57014` statement timeout và test coverage.
- [ ] **Bước 7**: Chạy đầy đủ kiểm chứng cuối cùng trên PowerShell 5.1: `npm run type-check; npm run lint; npm run test:run` (hoặc `npm run verify`).

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Mọi test case dưới đây phải pass 100% trong `src/app/api/generate-image/route.test.ts`; cấm dùng `expect.anything()` lỏng lẻo hay giảm chuẩn assertion:

| ID              | Kịch bản (Input)                                                                                                                                                                                                  | Hành vi mong đợi (Output & Side Effects)                                                                                                                                                                                                                                                                                                                                                                                                                                | Failure Mode / Boundary Condition                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-GI-META-01` | Request hợp lệ có `options.referenceImages` (2 ảnh base64 Data URI) + đầy đủ option nhẹ (`aspectRatio: "16:9"`, `resolution: "4K"`, `style: "photorealistic"`, `enhancer: false`, `model: "gemini-3-pro-image"`). | - HTTP `200`, `json.success === true`.<br>- `provider.generate` nhận đủ `options.referenceImages` (mảng 2 chuỗi base64).<br>- `saveMessage` nhận `meta.originalOptions` và `meta.metadata.originalOptions` **KHÔNG** có khóa `"referenceImage"` hay `"referenceImages"`.<br>- Cả 2 vị trí đều có `aspectRatio: "16:9"`, `resolution: "4K"`, `numberOfImages: 1`, `style: "photorealistic"`, `enhancer: false`, `model: "gemini-3-pro-image"`, `referenceImageCount: 2`. | Phải kiểm tra `JSON.stringify(savedMeta)` không chứa chuỗi base64 ảnh tham chiếu (chống rò rỉ sang bất kỳ trường phụ nào khác của `messageMeta`).                                             |
| `TC-GI-META-02` | Request hợp lệ dùng trường backward-compat `options.referenceImage` (1 ảnh base64 Data URI) và không có `referenceImages`.                                                                                        | - HTTP `200`.<br>- `provider.generate` nhận đúng `options.referenceImage`.<br>- `saveMessage` nhận `meta.originalOptions` và `meta.metadata.originalOptions` **KHÔNG** có `"referenceImage"` / `"referenceImages"`, có `referenceImageCount: 1`, và `JSON.stringify(savedMeta)` không chứa payload base64 tham chiếu.                                                                                                                                                   | Kiểm chứng nhánh fallback 1 ảnh tham chiếu đơn lẻ.                                                                                                                                            |
| `TC-GI-META-03` | Request hợp lệ có **cả** `options.referenceImage` lẫn `options.referenceImages` (mảng 3 ảnh base64) — edge case đồng thời cả 2 trường.                                                                            | - HTTP `200`.<br>- `saveMessage` loại bỏ **cả hai** khóa `"referenceImage"` và `"referenceImages"` ở cả `originalOptions` và `metadata.originalOptions`.<br>- `referenceImageCount === 3` (ưu tiên `referenceImages.length`, khớp `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74`).                                                                                                                                                           | Đảm bảo không còn trường base64 nào sót lại khi client cũ gửi trùng cả 2 field.                                                                                                               |
| `TC-GI-META-04` | Request hợp lệ **không có** `referenceImage` / `referenceImages` (hoặc `options` là `undefined`).                                                                                                                 | - HTTP `200`.<br>- `saveMessage` nhận `meta.originalOptions` có `model` mặc định (`"Gemini Image Flash"` khi `options` omitted) và **KHÔNG** có khóa `"referenceImageCount"`, `"referenceImage"`, `"referenceImages"`.                                                                                                                                                                                                                                                  | Đảm bảo không phá vỡ cấu trúc `savedOptions` khi `options` bị bỏ trống (`const safeOptions: NonNullable<typeof options> = options ?? {}` an toàn strict TypeScript và không ném `TypeError`). |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Test File

- `src/app/api/generate-image/route.test.ts` (đặt cạnh `src/app/api/generate-image/route.ts`).

#### Lệnh Kiểm Thử (PowerShell 5.1 — dùng `;`)

```powershell
npm run type-check; npx vitest run src/app/api/generate-image/route.test.ts; npm run lint
```

Sau khi hoàn tất toàn bộ các bước (bao gồm `docs/lessons-learned.md` và `docs/CHANGELOG.md`):

```powershell
npm run verify
```

#### Wiring Probes & Negative Probes

- **Wiring Probe 1 (Provider passthrough)**: Trong `TC-GI-META-01` & `TC-GI-META-02`, assert `generateSpy.mock.calls[0][1]` vẫn chứa nguyên vẹn `referenceImages` / `referenceImage` ➔ chứng minh việc strip diễn ra **sau** khi gọi AI provider, không làm hỏng tính năng ảnh tham chiếu / upscale 4K.
- **Wiring Probe 2 (Persistence integrity)**: Assert `saveMessage` được gọi đúng 1 lần với đầy đủ các option nhẹ (`aspectRatio`, `resolution`, `style`, `enhancer`, `model`, `numberOfImages: 1`, `referenceImageCount`) tại cả `meta.originalOptions` và `meta.metadata.originalOptions`.
- **Negative Probe (Base64 Leak Prevention)**: Truyền payload base64 giả lập đặc trưng (ví dụ `data:image/png;base64,${"A".repeat(1024)}`) vào `referenceImage` và `referenceImages`, sau đó assert:
  - `expect("referenceImage" in savedMeta.originalOptions).toBe(false)`
  - `expect("referenceImages" in savedMeta.originalOptions).toBe(false)`
  - `expect("referenceImage" in savedMeta.metadata.originalOptions).toBe(false)`
  - `expect("referenceImages" in savedMeta.metadata.originalOptions).toBe(false)`
  - `expect(JSON.stringify(savedMeta)).not.toContain("A".repeat(256))`
    ➔ Chứng minh 100% không có dữ liệu base64 ảnh tham chiếu nào lọt xuống PostgreSQL JSONB qua bất kỳ nhánh khóa nào trong `messageMeta`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                                                                                | Mức độ         | Technical Control / Kiểm chứng                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strip `referenceImage(s)` quá sớm làm mất ảnh tham chiếu truyền cho `GeminiNativeImageProvider` (hỏng tính năng upscale / image-to-image).                                                                            | **Cao**        | Chỉ destructure `options` tại Bước 5 (`src/app/api/generate-image/route.ts:331`), **sau** lời gọi `provider.generate(prompt, options as ImageGenOptions, apiKey)` ở dòng `246`, và không mutate `options`. Kiểm chứng trực tiếp bằng Wiring Probe trong `TC-GI-META-01` & `TC-GI-META-02`. |
| Lỗi `TypeError` khi destructure `options` lúc `options` là `undefined` (ví dụ request chỉ gửi `{ prompt, conversationId }`) hoặc lỗi `TS2339` trong TypeScript strict mode khi destructure trực tiếp `options ?? {}`. | **Trung bình** | Gán kiểu tường minh `const safeOptions: NonNullable<typeof options> = options ?? {};` trước khi destructure (mọi trường trong `imageGenOptionsSchema` tại `src/app/api/generate-image/route.ts:24-51` đều `.optional()`). Kiểm chứng bằng `npm run type-check` và `TC-GI-META-04`.         |
| Lỗi ESLint `@typescript-eslint/no-unused-vars` do biến destructured `referenceImage` / `referenceImages` không dùng.                                                                                                  | **Thấp**       | Dùng tiền tố `_referenceImage` và `_referenceImages`, phù hợp `varsIgnorePattern: "^_"` trong `eslint.config.mjs:59-66`, và sử dụng cả hai để tính `referenceImageCount`. Xác minh bằng `npm run lint`.                                                                                    |
| Legacy reader trên client/DB vẫn đọc `meta.metadata.originalOptions`.                                                                                                                                                 | **Thấp**       | Giữ nguyên cấu trúc `messageMeta.metadata.originalOptions = savedOptions` (`src/app/api/generate-image/route.ts:356-360`) nhưng với `savedOptions` đã sạch base64. Kiểm chứng bằng assertion trên cả `meta.originalOptions` và `meta.metadata.originalOptions` trong `TC-GI-META-01..03`.  |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh: `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-generate-image-statement-timeout.md` (exit code `1`):
  ```text
  [PASS] SECTIONS 7/7
  ...
  [FAIL] MISSING_FILE GeminiNativeImageProvider.ts:73-74
  [INFO] CRITIC_REQUIRED no
  [INFO] CRITIC_FLOOR skipped (no audit run)
  VERIFY_PLAN: FAIL (1 failures, 0 warnings)
  ```
- Lỗi cũ: `N/A` (Revision 1 — lượt thẩm định đầu tiên).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                                                               | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MAJOR] | `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74`                                                 | [CMD], [SRC] | Kế hoạch (mục 8, `TC-GI-META-03`) ghi đường dẫn rút gọn `GeminiNativeImageProvider.ts:73-74` thay vì relative path đầy đủ từ repo root, khiến `node scripts/verify-plan.mjs` thoát với exit code `1` (`MISSING_FILE`). Vi phạm Fail Criterion #1.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | DEFECT         | [MAJOR] | `src/app/api/generate-image/route.ts:23-52`                                                                               | [SRC]        | `options` (từ `imageGenRequestSchema.parse`) có kiểu union `NonNullable<typeof options> \| undefined`. Trong Design Sketch mục 6, `const { referenceImage: _referenceImage, referenceImages: _referenceImages, ...persistedOptions } = options ?? {};` suy diễn RHS là union `... \| {}` trong TypeScript strict mode (`tsc --noEmit`), gây lỗi biên dịch `TS2339` (`Property 'referenceImage' does not exist on type '{}'`). Cần gán kiểu tường minh `const safeOptions: NonNullable<typeof options> = options ?? {};` (hợp lệ vì mọi trường trong `imageGenOptionsSchema` tại `src/app/api/generate-image/route.ts:24-51` đều `.optional()`) trước khi destructure. Vi phạm Fail Criterion #2. |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.ts:218-221` & `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74` | [SRC]        | Khi client gửi đồng thời `referenceImages: []` và `referenceImage: "data:..."`, `GeminiNativeImageProvider.ts:73-74` dùng `\|\|` nên coi mảng rỗng là truthy (0 ảnh), còn `route.ts:218-221` và công thức `referenceImageCount` dùng `.length > 0` (tính 1). Không gây rò rỉ base64 hay crash vì cả hai trường đều bị strip; chấp nhận không chặn.                                                                                                                                                                                                                                                                                                                                               |
| 4   | RISK_DISMISSED | [MINOR] | `src/app/api/edit-image/route.ts:241-250` & `src/app/api/edit-image-multi/route.ts:400-417`                               | [SRC]        | Rủi ro phình JSONB tương tự trên các route chỉnh sửa ảnh khác đã được bác bỏ: cả `edit-image` và `edit-image-multi` chỉ lưu `options` nhẹ (`model`, `aspectRatio`), không nhận hay nhúng trường base64 `referenceImage(s)` vào `originalOptions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                        | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                   |
| -------------------------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7 mục)  | FAIL    | [CMD]        | `verify-plan.mjs` báo `SECTIONS 7/7` nhưng tổng kết `FAIL (1 failures)` do `MISSING_FILE GeminiNativeImageProvider.ts:73-74`.                                                                                              |
| Skills Loaded & Applied    | PASS    | [SRC]        | Đã ánh xạ đúng `api-patterns` (`.agents/skills/api-patterns/SKILL.md:1-104`) và `vikini-debug` (`.agents/skills/vikini-debug/SKILL.md:1-93`); không chạm UI/translation/DB migration.                                      |
| S1: Cold-start & Build     | FAIL    | [CMD], [SRC] | Baseline `npm run type-check` pass (`exit 0`), `package.json:40,52,64,80,116,118` khớp phiên bản, nhưng đoạn code mục 6 dùng `options ?? {}` trong destructuring sẽ lỗi `TS2339` khi biên dịch strict.                     |
| S2: Lifecycle & Teardown   | PASS    | [SRC], [CMD] | `src/app/api/generate-image/route.test.ts:160-179` có `beforeEach(() => vi.clearAllMocks())` và 48/48 test baseline xanh; route đã có orphan storage cleanup ở `src/app/api/generate-image/route.ts:381-394`.              |
| S3: Database & Temporal    | N/A     | [SRC]        | Không sửa schema/migration/RLS; chỉ giảm kích thước payload JSONB truyền vào `saveMessage` (`src/lib/features/chat/messages.ts:130-162`).                                                                                  |
| S4: Cross-Task State Flow  | N/A     | [SRC]        | Thay đổi thuần nội bộ trong `POST /api/generate-image` (`src/app/api/generate-image/route.ts:331-361`), không đổi HTTP contract hay Zustand/SWR state.                                                                     |
| S5: Security & 3-Tier Auth | PASS    | [SRC]        | Auth (`route.ts:66-70`), rate limit (`route.ts:73-77`), Zod validation (`route.ts:88`), ownership (`route.ts:101`), gatekeeper (`route.ts:104-127`), và `getSupabaseAdmin` server-only (`route.ts:5,260`) được giữ nguyên. |
| S6: External Resilience    | PASS    | [SRC]        | `maxDuration = 300` (`route.ts:61`), rollback batch quota (`route.ts:402-409`), và cleanup storage khi `saveMessage` lỗi (`route.ts:381-394`) không bị ảnh hưởng.                                                          |
| Domain: Open Inquiry       | PASS    | [SRC]        | Model routing `gemini-native` (`route.ts:218-241`) và `provider.generate` (`route.ts:246`) chạy trước bước strip `savedOptions` (`route.ts:331`); không có chuỗi UI mới cần dịch song ngữ.                                 |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines**:
  1. **Đồng thời**: `N/A` — `savedOptions` là biến cục bộ theo từng request trong `POST`, không chia sẻ trạng thái mutable giữa các request đồng thời.
  2. **Khoảng trống check→use (TOCTOU)**:
     - Cơ chế: Sử dụng `options` giữa Bước 3 (`provider.generate`) và Bước 5 (`saveMessage`).
     - `T1`: `route.ts:246` gọi `await provider.generate(prompt, options, apiKey)` với nguyên vẹn `referenceImage(s)` | `T2`: Bước 4 tải ảnh kết quả lên Supabase Storage (`route.ts:286-313`) | `T3`: Bước 5 destructure tạo bản sao `persistedOptions` không mutate `options` rồi truyền `messageMeta` sạch vào `saveMessage` (`route.ts:371-377`).
     - Kết cục: Không có TOCTOU; provider nhận đủ ảnh tham chiếu còn DB không nhận base64 -> An toàn.
  3. **Thất bại giữa chừng & thất bại bước dọn dẹp**:
     - Cơ chế: `saveMessage` ném lỗi sau khi upload Storage thành công.
     - `T1`: `supabase.storage.upload` thành công (`route.ts:286-291`) | `T2`: `saveMessage` ném lỗi DB | `T3`: `catch` (`route.ts:381-394`) gọi `supabase.storage.remove([storagePath]).catch(...)` rồi rethrow để `catch` ngoài (`route.ts:402-409`) gọi `claim.rollback()`.
     - Kết cục: Nếu chính `remove` lỗi thì chỉ log warn và vẫn rollback quota + trả HTTP 500 -> An toàn.
  4. **Môi trường serverless**: `N/A` — không thêm state in-memory hay timer mới; `maxDuration = 300` (`route.ts:61`) giữ nguyên.

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-generate-image-statement-timeout.md` — exit `1` (`[FAIL] MISSING_FILE GeminiNativeImageProvider.ts:73-74`, `CRITIC_REQUIRED no`).
  2. `npm run type-check` — exit `0` (`tsc --noEmit` sạch trên baseline).
  3. `npx vitest run src/app/api/generate-image/route.test.ts` — exit `0` (`1 passed`, `48 passed`).

#### 4. Kết Luận

Cần `@planner` khắc phục 2 lỗi `[MAJOR]` ở trên (sửa đường dẫn đầy đủ `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74` tại `TC-GI-META-03` để `verify-plan.mjs` đạt exit `0`, và bổ sung chú thích kiểu `NonNullable<typeof options>` cho `options ?? {}` trong Design Sketch mục 6 để tránh lỗi biên dịch `TS2339`) rồi gửi thẩm định lại.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh: `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-generate-image-statement-timeout.md` (exit code `0`):
  ```text
  [PASS] SECTIONS 7/7
  ...
  [PASS] LINE_REF src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74
  [PASS] LINE_REF src/app/api/generate-image/route.ts:24-51
  [INFO] CRITIC_REQUIRED no
  [PASS] CRITIC_FLOOR 4 findings with valid file:line
  VERIFY_PLAN: PASS (0 failures, 0 warnings)
  ```
- Bảng kiểm chứng lỗi cũ từ Audit Run 1:
  | # | Lỗi cũ (Audit Run 1) | Trạng thái | Bằng chứng | Ghi chú xác minh |
  | --- | ----------------------------------------------------------------------------------- | ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 1 | `[MAJOR]` Đường dẫn rút gọn `GeminiNativeImageProvider.ts:73-74` gây `verify-plan` fail | `ĐÃ SỬA` | [CMD], [SRC] | Đã thay bằng `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:73-74`; `verify-plan.mjs` trả exit `0` (`0 failures, 0 warnings`). |
  | 2 | `[MAJOR]` Lỗi `TS2339` khi destructure trực tiếp `options ?? {}` trong strict mode | `ĐÃ SỬA` | [SRC] | Đã gán `const safeOptions: NonNullable<typeof options> = options ?? {};` trước khi destructure; khớp đầy đủ các trường `.optional()` tại `src/app/api/generate-image/route.ts:24-51`. |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                                   | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | ------- | --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.ts:23-52`                                                   | [SRC]      | Kiểm tra khả năng gán `{}` cho `NonNullable<typeof options>` ở strict TypeScript 5.9 (`package.json:116`): toàn bộ 9 thuộc tính trong `imageGenOptionsSchema` tại `src/app/api/generate-image/route.ts:25-50` đều `.optional()`, nên `const safeOptions: NonNullable<typeof options> = options ?? {};` không phát sinh lỗi kiểu hay cần ép kiểu. |
| 2   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.ts:151-152` & `src/app/api/generate-image/route.ts:331-361` | [SRC]      | Kiểm tra tương tác với server-side override `if (options) options.numberOfImages = 1` (`route.ts:152`): khi `options` có giá trị, `persistedOptions` giữ `numberOfImages: 1` (khớp `TC-GI-META-01`); khi `options` là `undefined`, `safeOptions` là `{}` nên không gán thêm `numberOfImages` hay `referenceImageCount` (khớp `TC-GI-META-04`).   |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.ts:263-277` & `src/app/api/generate-image/route.ts:336-361` | [SRC]      | Kiểm tra toàn bộ trường còn lại trong `messageMeta`: khi provider trả về `data:image` hoặc `http`, ảnh được upload lên Supabase Storage và `finalUrl` đổi thành signed/public URL ngắn (`route.ts:279-314`), không còn nguồn base64 lớn nào khác ngoài `referenceImage(s)` đã được loại bỏ.                                                      |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                        | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                              |
| -------------------------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7 mục)  | PASS    | [CMD]        | `node scripts/verify-plan.mjs` trả exit `0` (`SECTIONS 7/7`, `0 failures, 0 warnings`, `CRITIC_REQUIRED no`).                                                                                                         |
| Skills Loaded & Applied    | PASS    | [SRC]        | Ánh xạ đủ `.agents/skills/api-patterns/SKILL.md:1-104` và `.agents/skills/vikini-debug/SKILL.md:1-93`; bao gồm Post-Fix Protocol (`docs/lessons-learned.md:325`, `docs/CHANGELOG.md:11`).                             |
| S1: Cold-start & Build     | PASS    | [CMD], [SRC] | Baseline `npm run type-check` exit `0`; `safeOptions: NonNullable<typeof options> = options ?? {}` tương thích `src/app/api/generate-image/route.ts:24-51` và `eslint.config.mjs:59-66`.                              |
| S2: Lifecycle & Teardown   | PASS    | [SRC], [CMD] | `src/app/api/generate-image/route.test.ts:160-179` có `beforeEach(() => vi.clearAllMocks())` (48/48 test baseline pass); orphan storage cleanup tại `src/app/api/generate-image/route.ts:381-394` giữ nguyên.         |
| S3: Database & Temporal    | N/A     | [SRC]        | Không sửa schema/migration/RLS; chỉ giảm kích thước payload JSONB truyền vào `saveMessage` (`src/lib/features/chat/messages.ts:130-162`).                                                                             |
| S4: Cross-Task State Flow  | N/A     | [SRC]        | Thay đổi thuần nội bộ trong `POST /api/generate-image` (`src/app/api/generate-image/route.ts:331-361`), không đổi HTTP contract hay Zustand/SWR state.                                                                |
| S5: Security & 3-Tier Auth | PASS    | [SRC]        | Auth (`route.ts:66-70`), rate limit (`route.ts:73-77`), Zod validation (`route.ts:88`), ownership (`route.ts:101`), gatekeeper (`route.ts:104-127`), và `getSupabaseAdmin` server-only (`route.ts:5,260`) giữ nguyên. |
| S6: External Resilience    | PASS    | [SRC]        | `maxDuration = 300` (`route.ts:61`), rollback batch quota (`route.ts:402-409`), và cleanup storage khi `saveMessage` lỗi (`route.ts:381-394`) giữ nguyên.                                                             |
| Domain: Open Inquiry       | PASS    | [SRC]        | Model routing `gemini-native` (`route.ts:218-241`) và `provider.generate` (`route.ts:246`) chạy trước bước strip `savedOptions` (`route.ts:331`); không có chuỗi UI mới cần dịch song ngữ.                            |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines**: Giữ nguyên kết quả kiểm chứng từ Audit Run 1 (TOCTOU giữa `route.ts:246` và `route.ts:331`: An toàn; thất bại `saveMessage` + cleanup Storage + rollback quota tại `route.ts:381-409`: An toàn; trục Đồng thời & Serverless: `N/A` do biến cục bộ per-request).
- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-generate-image-statement-timeout.md` — exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`).
  2. (Tái xác nhận baseline Audit Run 1) `npm run type-check` — exit `0`; `npx vitest run src/app/api/generate-image/route.test.ts` — exit `0` (`48 passed`).

#### 4. Kết Luận

Kế hoạch Revision 2 đã khắc phục toàn bộ lỗi `[MAJOR]` từ Audit Run 1, không còn lỗi `[BLOCKER]`/`[MAJOR]`, `verify-plan.mjs` đạt exit `0`, và `CRITIC_REQUIRED no`. Đủ điều kiện mở khóa triển khai.

[PLAN_APPROVED]

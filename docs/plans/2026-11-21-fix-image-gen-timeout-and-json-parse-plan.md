# Implementation Plan: Fix Image Generation 504 Timeout & Non-JSON Error Parsing

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Revision**: 1
- **Status**: Completed

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Goal

Khắc phục triệt để hai lỗi gốc xảy ra trên Vercel Production khi tạo/chỉnh sửa ảnh bằng model chậm như `gemini-3-pro-image`:

1. **Serverless 60s Timeout (`504 Gateway Timeout`)**: Nâng `export const maxDuration` từ `60` lên `300` (5 phút, tương thích Vercel Fluid Compute đã bật sẵn trên production) tại cả 3 image route (`generate-image`, `edit-image`, `edit-image-multi`) bằng thay đổi in-place giữ nguyên tuyệt đối số dòng đã được pin bởi `TC-G4 & TC-G5`.
2. **Crash `response.json()` trên phản hồi lỗi không phải JSON**: Bổ sung helper thuần `parseImageApiResponse` trong `src/lib/features/image-gen/studioHelpers.ts` để parse phản hồi an toàn trên toàn bộ client caller (`/api/generate-image` qua `postGenerateImageRequest` và `useImageGenController.ts`, `/api/edit-image-multi` qua `EditPanel.tsx`), bổ sung nhánh phân loại lỗi timeout/gateway (`504`) kèm cặp khóa song ngữ `studioErrorTimeout` / `studioErrorTimeoutSuggestion`, chấm dứt hoàn toàn thông báo lỗi thô `Unexpected token 'A', "An error o"... is not valid JSON`.

#### Out of Scope (What We're NOT Doing)

- **Không** chỉnh sửa bất kỳ tệp governance nào trong `.agents/` (kể cả `.agents/agents/reviewer/mental-simulation.md:59` đang trích dẫn `src/app/api/edit-image/route.ts:36`) để tránh mở rộng phạm vi sang bề mặt governance; việc sửa in-place trên dòng 36 vẫn giữ nguyên chuỗi `maxDuration` tại đúng dòng 36 nên `TC-G4 & TC-G5` tiếp tục đạt 100%.
- **Không** refactor `parseApiResponse` trong `src/lib/store/projectStore.ts:15-28` hay các endpoint ngoài domain image-gen (`chat`, `projects`, `admin`, `novelcrafter`).
- **Không** thêm cơ chế retry tự động ở tầng server/client cho `generate-image` (tránh lặp trừ quota / tốn phí gọi Gemini lần 2) và không đổi timeout nội bộ của `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:100-104`.
- **Không** thay đổi schema DB, RLS policy, auth/rate-limit, hay UI layout/CSS (không kích hoạt Visual QA Gate).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

| Skill / Rule / Doc đã đọc trực tiếp                                                       | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                |
| :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/02-quality.md`                                                             | Tuân thủ Pre-Work Protocol, kiểm thử PowerShell 5.1 dùng `;`, Post-Fix Protocol cập nhật `docs/lessons-learned.md` & `docs/CHANGELOG.md`.                                                         |
| `.agents/skills/api-patterns/SKILL.md`                                                    | Giữ nguyên hợp đồng `{ success, data }` / `{ success: false, error: { message, code } }` và luồng auth/rate-limit/gatekeeper trên 3 route ảnh; chỉ cập nhật `export const maxDuration = 300;`.    |
| `.agents/skills/vikini-debug/SKILL.md`                                                    | Xác nhận đủ 2 root cause bằng chứng cứ trước khi lên phương án (`maxDuration = 60` + raw `response.json()`), kèm bước `/post-fix` ghi `docs/lessons-learned.md` và `docs/CHANGELOG.md`.           |
| `.agents/skills/add-translation/SKILL.md` & `.agents/rules/04-bilingual.md`               | Thêm đối xứng 2 khóa `studioErrorTimeout` & `studioErrorTimeoutSuggestion` vào cả `vi.ts` (tiếng Việt thuần, không chèn tiếng Anh trong ngoặc đơn) và `en.ts`, gọi qua `t("...")` không hardcode. |
| `.agents/scripts/code-freeze-guard.test.ts:1861-1880` & `docs/lessons-learned.md:811-816` | Xác minh `TC-G4 & TC-G5` kiểm tra dòng 36 của `src/app/api/edit-image/route.ts` phải chứa `maxDuration`; sửa in-place giữ nguyên số dòng và khớp chuẩn Prettier (`printWidth: 100`).              |

---

### 3. Assumptions & Cross-Task Dependencies

- **A1 — Vercel Fluid Compute đã bật trên production `[SRC]`**: `src/app/api/chat-stream/route.ts:6` đang dùng `export const maxDuration = 800;` và `src/app/api/novelcrafter/stream/route.ts:24` đang dùng `export const maxDuration = 300;`. Do đó nâng 3 image route từ `60` lên `300` nằm hoàn toàn trong hạn mức Fluid Compute hiện tại và không bị tính phí Active CPU trong lúc chờ I/O từ Google Gemini.
- **A2 — Không có timeout 60s ẩn trong Gemini SDK provider `[SRC]`**: `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:100-104` gọi trực tiếp `ai.models.generateContent(...)` không bọc `AbortController` 60s; giới hạn 60s duy nhất nằm ở `export const maxDuration = 60;` của `src/app/api/generate-image/route.ts:61`, `src/app/api/edit-image/route.ts:36`, và `src/app/api/edit-image-multi/route.ts:69`.
- **A3 — Phạm vi client callers của 3 image route `[SRC]`**:
  - `/api/generate-image` được gọi bởi `postGenerateImageRequest` (`src/lib/features/image-gen/studioHelpers.ts:145-165`, dùng bởi `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:145` và `requestImageVariation`) và `src/app/features/chat/components/hooks/useImageGenController.ts:76-93`.
  - `/api/edit-image-multi` được gọi bởi `src/app/features/image-gen/components/EditPanel.tsx:160-188`.
  - `/api/edit-image` không còn caller UI mới nhưng vẫn nâng `maxDuration = 300` đồng bộ và giữ nguyên dòng 36 (`src/app/api/edit-image/route.ts:36`) theo pin của `.agents/agents/reviewer/mental-simulation.md:59`.
- **A4 — Không xung đột giới hạn số dòng file (`TC-13`) `[SRC]`**: `studioHelpers.ts` hiện `255` dòng (sau sửa ~`295` dòng `<= 400`), `useImageGenController.ts` hiện `154` dòng (sau sửa ~`150` dòng `<= 350`), `EditPanel.tsx` hiện `472` dòng (sau sửa ~`462` dòng `<= 500`).
- **Cross-Task Dependencies**: Không phụ thuộc task hay migration nào khác; độc lập hoàn toàn.

---

### 4. Bảng Verified Versions

| Package / Platform                   | Version / Spec                                                   | Nguồn xác minh                                                                                                                                                         |
| :----------------------------------- | :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next` (App Router `maxDuration`)    | `^16.4.0`                                                        | `[SRC]` `package.json:64` + `[URL]` https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#maxduration                                        |
| Vercel Fluid Compute (`maxDuration`) | Hỗ trợ `300s` (Hobby/Pro) tới `800s` (Pro) với I/O pause billing | `[SRC]` `src/app/api/chat-stream/route.ts:6`, `src/app/api/novelcrafter/stream/route.ts:24` + `[URL]` https://vercel.com/docs/functions/configuring-functions/duration |
| `@google/genai`                      | `^2.10.0`                                                        | `[SRC]` `package.json:40`                                                                                                                                              |
| `react`                              | `^19.2.3`                                                        | `[SRC]` `package.json:69`                                                                                                                                              |
| `zod`                                | `^4.2.1`                                                         | `[SRC]` `package.json:80`                                                                                                                                              |
| `vitest`                             | `^4.1.12`                                                        | `[SRC]` `package.json:118`                                                                                                                                             |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/app/api/generate-image/route.ts` — đổi in-place dòng 61 `maxDuration = 60` ➔ `300`.
- `[MODIFY]` `src/app/api/edit-image/route.ts` — đổi in-place dòng 36 `maxDuration = 60` ➔ `300` (giữ nguyên tuyệt đối số dòng 36).
- `[MODIFY]` `src/app/api/edit-image-multi/route.ts` — đổi in-place dòng 69 `maxDuration = 60` ➔ `300`.
- `[MODIFY]` `src/lib/features/image-gen/studioHelpers.ts` — thêm `parseImageApiResponse`, dùng trong `postGenerateImageRequest`, và thêm nhánh timeout/504 trong `classifyStudioError`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useImageGenController.ts` — dùng `parseImageApiResponse` thay cho raw `await response.json()`.
- `[MODIFY]` `src/app/features/image-gen/components/EditPanel.tsx` — dùng `parseImageApiResponse` thay cho raw `await res.json()` và xóa khối trích xuất lỗi trùng lặp.
- `[MODIFY]` `src/lib/utils/translations/en.ts` — thêm `studioErrorTimeout` và `studioErrorTimeoutSuggestion`.
- `[MODIFY]` `src/lib/utils/translations/vi.ts` — thêm `studioErrorTimeout` và `studioErrorTimeoutSuggestion`.
- `[MODIFY]` `src/lib/features/image-gen/studioHelpers.test.ts` — thêm unit tests & negative probes cho `parseImageApiResponse`, `postGenerateImageRequest`, và `classifyStudioError`.
- `[NEW]` `src/app/features/chat/components/hooks/useImageGenController.test.ts` — unit test kiểm chứng `useImageGenController` xử lý 504 plain-text / 502 HTML không crash JSON parse và hiện `toast.error` thân thiện.
- `[MODIFY]` `src/app/api/generate-image/route.test.ts` — bổ sung assertion `expect(maxDuration).toBe(300)`.
- `[MODIFY]` `src/app/api/edit-image/route.test.ts` — bổ sung assertion `expect(maxDuration).toBe(300)`.
- `[MODIFY]` `src/app/api/edit-image-multi/route.test.ts` — bổ sung assertion `expect(maxDuration).toBe(300)`.
- `[MODIFY]` `docs/lessons-learned.md` — ghi nhận bài học `/post-fix` về Vercel `maxDuration = 60` và raw `response.json()` trên non-JSON gateway errors.
- `[MODIFY]` `docs/CHANGELOG.md` — ghi nhận bản sửa lỗi mới nhất ở đầu file.

---

### 6. Caller-First Design Sketch

#### A. Shared Safe JSON Parser (`src/lib/features/image-gen/studioHelpers.ts`)

```ts
export interface ImageApiJsonPayload {
  success?: boolean;
  data?: unknown;
  error?: { message?: string } | string;
  [key: string]: unknown;
}

/**
 * Safely reads and parses a JSON response from image API routes.
 * Never throws raw JSON SyntaxError on Vercel 502/503/504 plain-text/HTML bodies.
 */
export async function parseImageApiResponse(
  response: Response,
  fallbackError: string,
  timeoutError?: string
): Promise<ImageApiJsonPayload>;
```

- Đọc body qua `try { rawText = await response.text(); } catch { rawText = ""; }` rồi `JSON.parse(rawText)` trong `try/catch`, chỉ chấp nhận plain object (`parsed && typeof parsed === "object" && !Array.isArray(parsed)`).
- Nếu `!response.ok`:
  - Ưu tiên `error.message` (object) hoặc `error` (non-empty string) từ JSON đã parse.
  - Nếu body không phải JSON (hoặc thiếu message): nếu `response.status === 504 && timeoutError` ➔ `throw new Error(timeoutError)`; ngược lại ➔ `throw new Error(`${fallbackError} (HTTP ${response.status})`)`.
- Nếu `response.ok` nhưng body không phải JSON object hợp lệ ➔ `throw new Error(fallbackError)`.

#### B. Call Sites

1. `postGenerateImageRequest` (`src/lib/features/image-gen/studioHelpers.ts:145-165`):
   ```ts
   const response = await fetch("/api/generate-image", {
     method: "POST",
     headers: { "Content-Type": "application/json", "x-api-key": apiKey },
     body: JSON.stringify(body),
   });
   return parseImageApiResponse(response, fallbackError);
   ```

   - Khi 504 plain-text: ném `Error("Generation failed (HTTP 504)")` ➔ `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:185` truyền vào `classifyStudioError(err.message, t)` ➔ khớp `"504"` và hiển thị `{ message: t("studioErrorTimeout"), suggestion: t("studioErrorTimeoutSuggestion") }` trên `AlertDialog` (`src/app/features/image-gen/components/ImageGenStudio.tsx:116-144`).
2. `src/app/features/chat/components/hooks/useImageGenController.ts:89-107`:
   ```ts
   const data = await parseImageApiResponse(
     response,
     t("studioGenerateFailed"),
     t("studioErrorTimeout")
   );
   const responseData =
     data.data && typeof data.data === "object" ? (data.data as { imageUrl?: string }) : undefined;
   ```

   - Khi 504 plain-text: ném `Error(t("studioErrorTimeout"))` ➔ `toast.error(t("studioErrorTimeout"))`.
3. `src/app/features/image-gen/components/EditPanel.tsx:174-198`:
   ```ts
   const data = await parseImageApiResponse(res, t("studioEditFailed"), t("studioErrorTimeout"));
   const responseData =
     data.data && typeof data.data === "object"
       ? (data.data as Record<string, unknown>)
       : undefined;
   ```

   - Khi 504 plain-text: ném `Error(t("studioErrorTimeout"))` ➔ `setError(t("studioErrorTimeout"))` và khôi phục `editHistory`.

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [x] **Bước 1 — Nâng `maxDuration` in-place trên 3 image API routes**:
  - Sửa dòng 61 của `src/app/api/generate-image/route.ts` thành `export const maxDuration = 300; // Set max duration to 300s (Vercel Fluid Compute)`.
  - Sửa dòng 36 của `src/app/api/edit-image/route.ts` thành `export const maxDuration = 300;` (bảo toàn tuyệt đối số dòng 36).
  - Sửa dòng 69 của `src/app/api/edit-image-multi/route.ts` thành `export const maxDuration = 300;`.
- [x] **Bước 2 — Thêm khóa dịch song ngữ timeout**:
  - Thêm `studioErrorTimeout` và `studioErrorTimeoutSuggestion` ngay dưới `studioErrorContentPolicySuggestion` trong `src/lib/utils/translations/en.ts:867` và `src/lib/utils/translations/vi.ts:875`.
- [x] **Bước 3 — Hiện thực `parseImageApiResponse` & nhánh timeout trong `classifyStudioError`**:
  - Thêm `ImageApiJsonPayload` và `parseImageApiResponse` trong `src/lib/features/image-gen/studioHelpers.ts`.
  - Cập nhật `postGenerateImageRequest` gọi `parseImageApiResponse(response, fallbackError)`.
  - Thêm nhánh kiểm tra `"504"`, `"timeout"`, `"timed out"`, `"gateway"` vào `classifyStudioError` (`src/lib/features/image-gen/studioHelpers.ts:11-35`).
- [x] **Bước 4 — Nối `parseImageApiResponse` vào 2 caller còn lại**:
  - Cập nhật `src/app/features/chat/components/hooks/useImageGenController.ts:89-107` gọi `parseImageApiResponse(response, t("studioGenerateFailed"), t("studioErrorTimeout"))`.
  - Cập nhật `src/app/features/image-gen/components/EditPanel.tsx:174-198` gọi `parseImageApiResponse(res, t("studioEditFailed"), t("studioErrorTimeout"))`.
- [x] **Bước 5 — Bổ sung unit tests co-located**:
  - Cập nhật `src/lib/features/image-gen/studioHelpers.test.ts` (TC-IMG-01..TC-IMG-06 + Negative Probes).
  - Tạo `src/app/features/chat/components/hooks/useImageGenController.test.ts` (TC-IMG-07..TC-IMG-08).
  - Bổ sung assertion `maxDuration === 300` vào `src/app/api/generate-image/route.test.ts`, `src/app/api/edit-image/route.test.ts`, và `src/app/api/edit-image-multi/route.test.ts` (TC-IMG-09).
- [x] **Bước 6 — Cập nhật Living Docs & Kiểm chứng toàn diện**:
  - Ghi bài học mới vào `docs/lessons-learned.md` (mục `API Response Parsing` hoặc cuối file theo format `/post-fix`).
  - Ghi mục mới ở đầu `docs/CHANGELOG.md`.
  - Chạy kiểm tra Prettier trên 3 route ảnh, chạy `code-freeze-guard.test.ts`, và chạy đầy đủ `npm run type-check; npm run lint; npm run test:run`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID            | Hàm / Route                                     | Đầu vào & Điều kiện                                                                                                                                                                                 | Hành vi & Kết quả bắt buộc (Pass Criteria)                                                                                                                                                                    |
| :------------ | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TC-IMG-01** | `parseImageApiResponse`                         | `200 OK` với `{"success":true,"data":{"imageUrl":"https://..."}}`                                                                                                                                   | Trả về đúng object đã parse, không throw.                                                                                                                                                                     |
| **TC-IMG-02** | `parseImageApiResponse`                         | `504` plain-text `"An error occurred with your deployment\nFUNCTION_INVOCATION_TIMEOUT"`, có `timeoutError = "Custom timeout"`                                                                      | Reject `Error("Custom timeout")`; **KHÔNG** chứa `"Unexpected token"` hay `"is not valid JSON"`.                                                                                                              |
| **TC-IMG-03** | `parseImageApiResponse`                         | `504` plain-text `"An error occurred..."`, không truyền `timeoutError`, `fallbackError = "Generation failed"`                                                                                       | Reject `Error("Generation failed (HTTP 504)")`.                                                                                                                                                               |
| **TC-IMG-04** | `parseImageApiResponse`                         | `502` HTML `"<html>502 Bad Gateway</html>"` hoặc `503` empty body `""`                                                                                                                              | Reject `Error("Generation failed (HTTP 502)")` / `Error("Generation failed (HTTP 503)")`.                                                                                                                     |
| **TC-IMG-05** | `parseImageApiResponse`                         | `200 OK` nhưng body là HTML/non-JSON hoặc JSON array `[]` / `null`                                                                                                                                  | Reject `Error(fallbackError)` (fail-closed, không trả primitive/array).                                                                                                                                       |
| **TC-IMG-06** | `parseImageApiResponse` & `classifyStudioError` | `400` JSON `{"error":{"message":"Safety blocked"}}` và `422` JSON `{"error":"Custom string"}`; `classifyStudioError` nhận `"Generation failed (HTTP 504)"`, `"Task timed out"`, `"502 Bad Gateway"` | Giữ nguyên message JSON (`"Safety blocked"`, `"Custom string"`); `classifyStudioError` trả `{ message: t("studioErrorTimeout"), suggestion: t("studioErrorTimeoutSuggestion") }` cho lỗi timeout/504/gateway. |
| **TC-IMG-07** | `useImageGenController`                         | `fetch("/api/generate-image")` trả `504` plain-text `"An error occurred with your deployment"`                                                                                                      | Trả `false`, gọi `toast.error("studioErrorTimeout")`, reset `lastGeneratedImage` về `null`, không ném unhandled rejection hay chuỗi `SyntaxError`.                                                            |
| **TC-IMG-08** | `useImageGenController`                         | `fetch("/api/generate-image")` trả `200` `{"success":true,"data":{"imageUrl":"https://cdn/1.png"}}`                                                                                                 | Trả `true`, cập nhật `lastGeneratedImage.url`, gọi `toast.success("studioGenerateSuccess")` và `onSuccess()`.                                                                                                 |
| **TC-IMG-09** | 3 Image API Routes                              | Import `maxDuration` từ `generate-image`, `edit-image`, `edit-image-multi`                                                                                                                          | Cả 3 đều bằng `300`, và `code-freeze-guard.test.ts` (`TC-G4 & TC-G5`) xác nhận dòng 36 của `src/app/api/edit-image/route.ts` vẫn chứa `maxDuration`.                                                          |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Unit Tests

1. `src/lib/features/image-gen/studioHelpers.test.ts`: Phủ `TC-IMG-01`..`TC-IMG-06`, gồm cả test `postGenerateImageRequest` với `Response("An error occurred with your deployment", { status: 504 })`.
2. `src/app/features/chat/components/hooks/useImageGenController.test.ts`: Phủ `TC-IMG-07`..`TC-IMG-08` với `@testing-library/react` `renderHook` + `vi.stubGlobal("fetch", ...)` và dọn sạch trong `afterEach(() => { vi.unstubAllGlobals(); })`.
3. `src/app/api/generate-image/route.test.ts`, `src/app/api/edit-image/route.test.ts`, `src/app/api/edit-image-multi/route.test.ts`: Phủ `TC-IMG-09`.

#### Wiring Probes & Negative Probes

- **Wiring Probe WP-1 (Prettier Line-Pin Stability)**: Chạy `npx prettier --check src/app/api/edit-image/route.ts src/app/api/generate-image/route.ts src/app/api/edit-image-multi/route.ts` + `npx vitest run .agents/scripts/code-freeze-guard.test.ts` để chứng minh `lint-staged` khi commit không làm dịch dòng 36 của `edit-image/route.ts`.
- **Wiring Probe WP-2 (Translation Key Parity)**: `npm run type-check` kiểm tra `_AssertTranslationsParity` giữa `vi.ts` và `en.ts`.
- **Negative Probe NP-1 (Non-JSON Gateway Response)**: Truyền `new Response("An error occurred with your deployment...", { status: 504, headers: { "Content-Type": "text/plain" } })` vào `postGenerateImageRequest` và `useImageGenController` — xác nhận hàm reject với thông báo HTTP 504 / `studioErrorTimeout` và **không** chứa `"Unexpected token"`.
- **Negative Probe NP-2 (200 Non-Object Payload)**: Truyền `new Response("<html>Proxy</html>", { status: 200 })` và `new Response("null", { status: 200 })` vào `parseImageApiResponse` — xác nhận đều bị chặn và throw `Error(fallbackError)`.

#### Verification Commands (PowerShell 5.1 — bắt buộc dùng `;`)

```powershell
npx vitest run src/lib/features/image-gen/studioHelpers.test.ts src/app/features/chat/components/hooks/useImageGenController.test.ts src/app/api/generate-image/route.test.ts src/app/api/edit-image/route.test.ts src/app/api/edit-image-multi/route.test.ts .agents/scripts/code-freeze-guard.test.ts
npm run type-check; npm run lint; npm run test:run
```

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Mức độ         | Rủi ro                                                                                                                                                       | Technical Control & Bằng chứng kiểm chứng                                                                                                                                                                           |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cao**        | Sửa `src/app/api/edit-image/route.ts` làm dịch số dòng 36 (hoặc bị `lint-staged` Prettier format lại khi commit), làm vỡ `TC-G4 & TC-G5` trên CI.            | Chỉ thay 2 ký tự `60` ➔ `300` tại đúng `src/app/api/edit-image/route.ts:36` (`[SRC]`), xác minh qua **WP-1** (`npx prettier --check` + `.agents/scripts/code-freeze-guard.test.ts:1861-1880`).                      |
| **Trung bình** | Lệch khóa song ngữ `studioErrorTimeout` / `studioErrorTimeoutSuggestion` giữa `vi.ts` và `en.ts` gây lỗi build hoặc lộ tên khóa thô.                         | Thêm đối xứng đồng thời tại `src/lib/utils/translations/en.ts:867` và `src/lib/utils/translations/vi.ts:875` (`[SRC]`), xác minh biên dịch qua **WP-2** (`npm run type-check`).                                     |
| **Trung bình** | `response.text()` nhận phản hồi lỗi không phải JSON có status khác 504 (502/503/500) hoặc 200 trả về HTML từ proxy CDN làm crash caller khi đọc `data.data`. | `parseImageApiResponse` kiểm tra `typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)` và ném `Error` có mã HTTP rõ ràng, khóa bằng **NP-1** & **NP-2** trong `studioHelpers.test.ts`.          |
| **Thấp**       | Tăng `maxDuration` lên `300` làm kéo dài request treo nếu upstream Gemini thực sự không phản hồi.                                                            | Vercel Fluid Compute không tính phí CPU khi chờ I/O (`[SRC]` cùng cấu hình `300` với `src/app/api/novelcrafter/stream/route.ts:24`), và nếu vượt 300s trả 504 thì UI đã phân loại và hiển thị nút Retry thân thiện. |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 (chưa có lỗi cũ cần kiểm lại).
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-21-fix-image-gen-timeout-and-json-parse-plan.md`:
  ```text
  [PASS] SECTIONS 7/7
  [PASS] LINE_REF (25/25 verified)
  [INFO] CRITIC_REQUIRED no
  [INFO] CRITIC_FLOOR skipped (no audit run)
  VERIFY_PLAN: PASS (0 failures, 0 warnings)
  ```

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                           | Bằng chứng        | Lý do                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------- | ------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/chat/components/hooks/useImageGenController.ts:106` | `[SRC]`           | Khi thay `await response.json()` (`any`) bằng `parseImageApiResponse` (`ImageApiJsonPayload` với `error?: { message?: string } \| string`), nhánh `else` ở dòng 106 (`data.error?.message`) sẽ báo lỗi `TS2339` nếu không thu hẹp kiểu `typeof data.error === "string" ? data.error : data.error?.message`. Cần thu hẹp kiểu khi triển khai bước 4.                       |
| 2   | RISK_DISMISSED | [MINOR] | `src/app/api/edit-image/route.ts:36`                                  | `[SRC]` + `[CMD]` | `.agents/scripts/code-freeze-guard.test.ts:1877` chỉ kiểm tra dòng 36 chứa chuỗi `"maxDuration"`, không cố định giá trị `60`, và `npx vitest run .agents/scripts/code-freeze-guard.test.ts` pass (128/128). Thay `60` thành `300` in-place (31 ký tự <= `printWidth: 100`) không gây dịch dòng hay vỡ `TC-G4 & TC-G5`.                                                    |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.test.ts:889`                        | `[CMD]`           | Chạy baseline `npx vitest run src/app/api/generate-image/route.test.ts` ghi nhận 3 test sẵn có (`TC-GI-02`, `TC-GI-04`, `TC-GI-04b`) đang fail do diff uncommitted của `model-catalog-redesign` (`gemini-3.8-flash` vs `gemini-4-hydrogen`), không liên quan tới plan này. Khi xác minh bước 6, kiểm tra `TC-IMG-09` pass độc lập và không tự ý sửa 3 test ngoài phạm vi. |
| 4   | RISK_DISMISSED | [MINOR] | `src/lib/features/image-gen/studioHelpers.ts:145-165`                 | `[SRC]` + `[CMD]` | `postGenerateImageRequest` có kiểu trả về `Promise<{ success?: boolean; [key: string]: unknown }>`, tương thích hoàn toàn với `ImageApiJsonPayload`; `src/lib/features/image-gen/studioHelpers.test.ts` pass baseline (9/9) và test HTTP 400 JSON (`Safety blocked`) ở dòng 136-146 vẫn giữ nguyên hành vi.                                                               |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                      | Kết quả | Bằng chứng        | Chi tiết                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7/7)                  | PASS    | `[CMD]`           | `node scripts/verify-plan.mjs` exit 0 (`SECTIONS 7/7`, 0 failures, 0 warnings, `CRITIC_REQUIRED no`).                                                                                                                                                                                  |
| Skills Loaded & Applied                  | PASS    | `[SRC]`           | Kế hoạch ánh xạ đầy đủ `api-patterns`, `vikini-debug`, `add-translation`, `04-bilingual.md`, `02-quality.md`.                                                                                                                                                                          |
| S1: Cold-start & Build                   | PASS    | `[CMD]` + `[SRC]` | `npm run type-check` exit 0; `package.json:40,64,69,80,118` khớp phiên bản khai báo; không thêm biến môi trường hay dependency mới.                                                                                                                                                    |
| S2: Runner Lifecycle & Teardown          | PASS    | `[SRC]`           | `useImageStudioActions.ts:188-198` dọn `genTimerRef`/`generatingRef` trong `finally`; `EditPanel.tsx:215-223` khôi phục `editHistory` & reset `loading`; `studioHelpers.test.ts:116-119` và kế hoạch `useImageGenController.test.ts` đều dùng `afterEach` gọi `vi.unstubAllGlobals()`. |
| S3: Database & Temporal Logic            | N/A     | N/A               | Kế hoạch không thay đổi bảng, cột, migration SQL hay RLS policy trên Supabase.                                                                                                                                                                                                         |
| S4: Cross-Task State Flow                | PASS    | `[SRC]`           | Đã đối chiếu `useImageStudioActions.ts:145,185,251-266`, `useImageGenController.ts:56-116`, `EditPanel.tsx:160-224`, `ImageGenStudio.tsx:116-144`; không làm lệch Zustand store, SWR key hay URL sync.                                                                                 |
| S5: Security Boundary & 3-Tier Auth      | PASS    | `[SRC]`           | `generate-image/route.ts:66-77`, `edit-image/route.ts:18,41-52`, `edit-image-multi/route.ts:19-21` giữ nguyên `auth()`, `consumeRateLimit()` và SSRF guard; `parseImageApiResponse` là hàm thuần phía client, không chạm `.server.ts`.                                                 |
| S6: External Resilience & Serverless Cap | PASS    | `[SRC]` + `[ADV]` | `chat-stream/route.ts:6` (`800`) và `novelcrafter/stream/route.ts:24` (`300`) xác nhận Fluid Compute hỗ trợ `maxDuration = 300`; `GeminiNativeImageProvider.ts:100-104` không có AbortController 60s ẩn; parser an toàn chặn lỗi `SyntaxError` trên 502/503/504.                       |
| Domain: Bilingual & Risk Controls        | PASS    | `[SRC]`           | `src/lib/utils/translations/index.ts:24-34` cưỡng chế `_AssertTranslationsParity`; `en.ts:861-867` và `vi.ts:869-875` khớp vị trí thêm khóa; mọi rủi ro Cao/Trung bình đều gắn technical control và WP-1/WP-2/NP-1/NP-2.                                                               |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 (Đồng thời — Batch image generation 504)**:
  - Cơ chế: `useImageStudioActions.ts:165-173` (`Promise.allSettled` gọi song song nhiều `postGenerateImageRequest`)
  - T1: 2 request batch gửi song song tới `/api/generate-image` | T2: Cả 2 đều vượt ngưỡng hoặc nhận `504` plain-text từ gateway Vercel | T3: `parseImageApiResponse` đọc `response.text()`, không ném `SyntaxError`, trả `Error("Generation failed (HTTP 504)")` -> `resolveBatchFailureReason` lấy lỗi đầu tiên -> `classifyStudioError` khớp `"504"` và hiển thị `studioErrorTimeout` + `studioErrorTimeoutSuggestion`.
  - Kết cục: UI hiển thị thông báo timeout song ngữ kèm nút thử lại, không crash -> An toàn.
- **Trục 2 (Khoảng trống check→use / TOCTOU)**: `N/A` — Kế hoạch không thay đổi cơ chế auth, rate-limit, quota check-then-act hay SSRF fetch.
- **Trục 3 (Thất bại giữa chừng & cleanup)**:
  - Cơ chế: `EditPanel.tsx:160-223` optimistic update `editHistory` khi gặp `504` / `502` non-JSON
  - T1: User gửi lượt chỉnh sửa, `editHistory` thêm `newUserTurn` lạc quan | T2: Server trả `504` plain-text hoặc `200` HTML proxy | T3: `parseImageApiResponse` ném `Error(t("studioErrorTimeout"))` / `Error(t("studioEditFailed"))` -> khối `catch` đặt `setError(message)` và hoàn tác `setEditHistory(editHistory)`, khối `finally` đặt `setLoading(false)`.
  - Kết cục: Trạng thái lịch sử chỉnh sửa và nút tải được khôi phục sạch -> An toàn.
- **Trục 4 (Môi trường serverless)**:
  - Cơ chế: Vercel Serverless `maxDuration = 300` trên 3 image routes
  - T1: Model `gemini-3-pro-image` xử lý ảnh 90–150s | T2: Không còn bị cắt ở mốc 60s; nếu vẫn vượt quá 300s, Vercel trả `504` plain-text | T3: Client dùng `parseImageApiResponse` xử lý an toàn mà không phụ thuộc in-memory state giữa các instance.
  - Kết cục: Giảm mạnh tỷ lệ 504 thực tế và fail-closed khi chạm trần 300s -> An toàn.

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-fix-image-gen-timeout-and-json-parse-plan.md` (exit 0: `VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`)
  2. `npm run type-check` (exit 0)
  3. `npx vitest run src/lib/features/image-gen/studioHelpers.test.ts --reporter=dot` (exit 0: 9/9 passed)
  4. `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` (exit 0: 128/128 passed)
  5. `npx vitest run src/app/api/generate-image/route.test.ts src/app/api/edit-image/route.test.ts src/app/api/edit-image-multi/route.test.ts --reporter=dot` (exit 1: `edit-image` & `edit-image-multi` passed; 3 pre-existing failures in `generate-image/route.test.ts` lines 889/951/976 from uncommitted `model-catalog-redesign` diff)
  6. `git status` (exit 0: xác nhận diff uncommitted hiện tại thuộc `model-catalog-redesign` & `streaming-progress-and-upload-ux-audit`)

#### 4. Kết Luận

[PLAN_APPROVED]

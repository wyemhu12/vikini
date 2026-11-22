# Implementation Plan: Reference Images 40MB Direct Upload (Image Studio)

- **Status**: Completed
- **Revision**: 2
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-22
- **Task**: Tăng giới hạn dung lượng ảnh tham chiếu (`referenceImages`) trong Image Studio lên **40 MB / ảnh** (tối đa 4 ảnh) bằng Direct Upload lên Supabase Storage + Gemini Files API cho payload lớn

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục tiêu (Goal)

Cho phép người dùng tải lên tối đa **4 ảnh tham chiếu** với dung lượng lên đến **40 MB / ảnh** (tổng tối đa 160 MB) trong Image Studio mà:

1. **Vượt qua trần 4.5 MB request body của Vercel Serverless Functions** bằng cơ chế **Direct Upload** (`POST /api/generate-image/reference-upload-url` cấp batch Signed Upload URLs cho 1–4 ảnh trong 1 request → trình duyệt `PUT` trực tiếp lên Supabase Storage bucket `"attachments"` → chỉ gửi mảng `referenceImagePaths` nhẹ sang `POST /api/generate-image`).
2. **Không làm phình PostgreSQL JSONB** (`saveMessage` strip toàn bộ `referenceImagePaths`, `resolvedReferenceImages`, `referenceImages`, `referenceImage`, chỉ lưu `referenceImageCount`) và **không để rác Supabase Storage / Gemini Files** (dọn sạch trong `finally` ngay từ sau khi xác thực ownership, kể cả khi bị chặn gatekeeper/quota hay generation thất bại).
3. **An toàn trước IDOR, Path Traversal, OOM và khai báo gian dối dung lượng/MIME**: xác thực nghiêm ngặt prefix `${userId}/${conversationId}/ref-<uuid>.<ext>`, đồng bộ whitelist 4 MIME (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) ở cả Client lẫn Server, kiểm tra `blob.size <= 40 MB` **trước** `blob.arrayBuffer()` (chống OOM) và kiểm tra magic bytes thực tế.
4. **Không dính trần `inlineData` của Gemini** khi gửi 1–4 ảnh lớn: tự động chuyển sang **Gemini Files API** (`ai.files.upload` + `{ fileData: { fileUri, mimeType } }`) khi tổng dung lượng ảnh tham chiếu vượt ngưỡng **15 MB**, và xóa ngay qua `ai.files.delete` trong `finally`.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** thay đổi `DEFAULT_REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024` trong `src/lib/features/files/uploadPresentation.ts` để giữ nguyên hành vi và test của `src/app/features/image-gen/components/TemplateModal.tsx` (`src/app/features/image-gen/components/TemplateModal.tsx:42`) và trang Describe Image (`describeFileTooLarge`).
- **KHÔNG** thay đổi `DEFAULT_PREVIEW_MAX_BYTES = 15 * 1024 * 1024` trong `readImagePreviewDataUrl` (`src/lib/features/files/uploadPresentation.ts:14`) — ảnh 15–40 MB dùng fallback icon có sẵn tại `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:209-213` để tránh ngốn RAM trình duyệt khi dựng base64 thumbnail.
- **KHÔNG** loại bỏ backward compatibility cho `options.referenceImage` / `options.referenceImages` (vẫn dùng bởi `requestImageVariation` tại `src/lib/features/image-gen/studioHelpers.ts:258-287` và các caller cũ).
- **KHÔNG** thay đổi database schema hay tạo SQL migration mới (tái sử dụng bucket `"attachments"` hiện có).
- **KHÔNG** thay đổi CSP trong `next.config.ts` vì `connect-src` đã cho phép `https://*.supabase.co` (`next.config.ts:77`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài liệu đã đọc trong phiên

- `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`
- `.agents/skills/api-patterns/SKILL.md`
- `.agents/skills/add-translation/SKILL.md`
- `package.json`, `next.config.ts`
- `src/app/api/generate-image/route.ts`, `src/app/api/generate-image/route.test.ts`
- `src/lib/features/image-gen/core/types.ts`
- `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts`
- `src/lib/features/image-gen/studioHelpers.ts`, `src/lib/features/image-gen/studioHelpers.test.ts`
- `src/app/features/image-gen/components/hooks/useImageStudioActions.ts`, `src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts`
- `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`, `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx`
- `src/app/features/image-gen/components/TemplateModal.tsx`
- `src/lib/features/files/uploadPresentation.ts`, `src/lib/features/files/uploadPresentation.test.ts`
- `src/lib/features/files/geminiFiles.server.ts`
- `src/lib/features/chat/storageCleanup.ts`
- `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`

#### Bảng Ánh Xạ Skills Loaded & Applied

| Skill / Rule Đã Đọc                                                         | Phạm Vi Áp Dụng                                                                                                                                                                                                         | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng                                                                                                                                                                                                                                                                                                                                                  |
| :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/api-patterns/SKILL.md`                                      | `src/app/api/generate-image/reference-upload-url/route.ts`, `src/app/api/generate-image/route.ts`                                                                                                                       | Mọi API route trả về chuẩn `success(data)` / `errorFromAppError(err)` / `error(msg, status)`; dùng `UnauthorizedError`, `ValidationError`, `ForbiddenError`, `RateLimitError`, `AppError`; bắt lỗi bằng `catch (err: unknown)`.                                                                                                                                                     |
| `.agents/skills/add-translation/SKILL.md` & `.agents/rules/04-bilingual.md` | `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`, `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`, `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` | Thêm đồng bộ 2 khóa song ngữ `studioRefFileTooLarge` và `studioRefUploadFailed` vào cả `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`; component chỉ gọi `t("key")` qua `useLanguage()`, không hardcode chuỗi hay ternary ngôn ngữ.                                                                                                                       |
| `.agents/rules/01-coding.md`                                                | Toàn bộ module mới & sửa đổi                                                                                                                                                                                            | Cấm tuyệt đối `any` và `console.log`; mọi thất bại thao tác người dùng (upload ảnh tham chiếu lỗi) bắt buộc gọi `toast.error()` + `logger.error()`; giữ diff trong `src/app/api/generate-image/route.ts` tối thiểu (`<= 25` dòng) bằng cách tách logic storage/magic-bytes sang `src/lib/features/image-gen/referenceImageStorage.ts`; bắt buộc viết test co-located (`*.test.ts`). |

---

### 3. Assumptions & Cross-Task Dependencies

1. **CSP đã cho phép direct upload tới Supabase Storage** `[SRC: next.config.ts:77]`:
   `connect-src 'self' ws: wss: https://*.supabase.co https://*.googleapis.com https://*.google.com` đã bao gồm wildcard `https://*.supabase.co`, nên `fetch(signedUrl, { method: "PUT", ... })` từ trình duyệt không bị CSP chặn.
2. **Định dạng `userId` trong Image Studio** `[SRC: src/app/api/generate-image/route.ts:70]`:
   `userId = session.user.email.toLowerCase()` (có thể chứa `@`, `.`, `+`, `-`, `_`). Do đó kiểm tra ownership path phải dùng literal prefix `${userId}/${conversationId}/ref-` rồi mới kiểm tra regex ASCII chặt cho phần suffix `<uuid>.<ext>`.
3. **Bucket `"attachments"` trên Supabase Storage** `[SRC: src/app/api/generate-image/route.ts:261]`, `[SRC: src/lib/features/chat/storageCleanup.ts:47]`:
   Image Studio đang dùng chung bucket `"attachments"`. Giả định cấu hình bucket trên Supabase Dashboard cho phép `file_size_limit >= 40 MB` và CORS cho phép method `PUT` từ origin ứng dụng (nếu cấu hình thấp hơn, Supabase trả HTTP 413/CORS error và client xử lý sạch bằng `toast.error(t("studioRefUploadFailed"))`).
4. **Hành vi preview ảnh > 15 MB** `[SRC: src/lib/features/files/uploadPresentation.ts:14,34-40]`, `[SRC: src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:203-213]`:
   `readImagePreviewDataUrl` trả `undefined` cho ảnh > 15 MB và UI đã có fallback `<ImageIcon />`, đảm bảo an toàn bộ nhớ trình duyệt.
5. **Batch generation (`numberOfImages > 1`) & Rate Limit** `[SRC: src/app/features/image-gen/components/hooks/useImageStudioActions.ts:133-176]`, `[SRC: src/lib/core/rateLimit.ts:11-12]`:
   - `POST /api/generate-image/reference-upload-url` nhận mảng `files` (1..4 ảnh) trong **1 request duy nhất** (tiêu tốn đúng 1 lượt `consumeRateLimit("image-gen-ref-upload:${userId}")` thay vì 4 lượt/ảnh).
   - Trong `src/app/features/image-gen/components/hooks/useImageStudioActions.ts`, `uploadReferenceImages` được gọi bên trong `sendOne()` để mỗi request trong batch `Promise.allSettled` sở hữu bộ `ref-<uuid>` độc lập (0 race condition khi `POST /api/generate-image` xóa trong `finally`; batch 4 ảnh chỉ tốn 4/20 lượt rate-limit thay vì 16/20).
   - `uploadReferenceImages` ném typed error `ReferenceImageUploadError` (KHÔNG tự `toast.error` hay `return` bên trong `sendOne()`). Nhờ đó `Promise.allSettled` + `resolveBatchFailureReason` giữ nguyên ngữ nghĩa (nếu tất cả nhánh fail, `catch` ngoài cùng chạy **đúng 1 lần**, kiểm tra `error instanceof ReferenceImageUploadError` và gọi `toast.error(t("studioRefUploadFailed"))` đúng **1 lần**, không bao giờ spam 4 toast).
6. **Không xung đột tên file `.server.ts`** `[SRC: src/lib/features/chat/storageCleanup.ts:1]`:
   Helper mới đặt tên `src/lib/features/image-gen/referenceImageStorage.ts` (không dùng hậu tố `.server.ts`) để đồng nhất với `src/lib/features/chat/storageCleanup.ts` và `src/lib/features/chat/messages.ts`.
7. **Approved Spec Change (Loại C) cho test cũ** `[SRC: src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx:88-101]`:
   Test hiện tại dùng file giả 12 MB để kiểm tra lỗi quá dung lượng (`describeFileTooLarge`). Sau khi nâng giới hạn Image Studio lên 40 MB và đồng bộ whitelist 4 MIME, ảnh 12 MB trở thành hợp lệ, ảnh > 40 MB (ví dụ 41 MB) kích hoạt `studioRefFileTooLarge`, và ảnh ngoài whitelist (`image/svg+xml`, `image/heic`) kích hoạt `describeInvalidImage`. Cần cập nhật test case theo Test Contract mới (Loại C).

---

### 4. Bảng Verified Versions

| Thư viện / Nền tảng     | Phiên bản trong repo | Nguồn xác minh                                                                                                                         | Ghi chú tương thích 2026                                                                                                                                                                                                                                                             |
| :---------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                  | `^16.4.0`            | `[SRC: package.json:64]`                                                                                                               | App Router Route Handlers (`NextRequest`, `maxDuration = 300`).                                                                                                                                                                                                                      |
| `react`                 | `^19.2.3`            | `[SRC: package.json:69]`                                                                                                               | Hooks & concurrent rendering.                                                                                                                                                                                                                                                        |
| `@supabase/supabase-js` | `^2.89.0`            | `[SRC: package.json:52]`, `[URL: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl]`                   | `supabase.storage.from(bucket).createSignedUploadUrl(path)` trả về `{ data: { signedUrl, token, path }, error }`; hỗ trợ client `fetch(signedUrl, { method: "PUT", headers: { "Content-Type": mimeType, "x-upsert": "false" }, body: file })`, `download(path)`, và `remove(paths)`. |
| `@google/genai`         | `^2.10.0`            | `[SRC: package.json:40]`, `[SRC: src/lib/features/files/geminiFiles.server.ts:43-49]`, `[URL: https://github.com/googleapis/js-genai]` | `ai.files.upload({ file: Blob, config: { mimeType, displayName } })` trả `{ name, uri, mimeType }`; truyền vào `contents[].parts` qua `{ fileData: { fileUri, mimeType } }`; xóa ngay qua `ai.files.delete({ name })`.                                                               |
| `zod`                   | `^4.2.1`             | `[SRC: package.json:80]`                                                                                                               | `z.object`, `z.string().uuid()`, `z.enum(...)`, `z.number().int().min(1).max(...)`.                                                                                                                                                                                                  |
| `vitest`                | `^4.1.12`            | `[SRC: package.json:118]`                                                                                                              | Co-located unit & API integration tests.                                                                                                                                                                                                                                             |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]`

1. `src/lib/features/image-gen/referenceImageStorage.ts` — Hằng số `MAX_STUDIO_REF_IMAGE_BYTES` (40 MB), `ALLOWED_REF_IMAGE_MIME_TYPES`, tạo đường dẫn thuần ASCII (`buildReferenceImageStoragePath`), xác thực ownership + chống IDOR/Path Traversal (`validateReferenceImagePaths`), kiểm tra magic bytes (`detectImageMimeFromBytes`), tải + kiểm tra OOM `blob.size <= 40 MB` trước `arrayBuffer()` (`downloadReferenceImagesFromStorage`), và dọn dẹp an toàn (`cleanupTempReferenceImages`).
2. `src/lib/features/image-gen/referenceImageStorage.test.ts` — Co-located unit tests cho toàn bộ hàm exported + Negative Probes (IDOR, `..`, backslash, control chars, spoofed size > 40 MB chặn trước `arrayBuffer()`, magic bytes giả mạo).
3. `src/app/api/generate-image/reference-upload-url/route.ts` — API route `POST` nhận mảng `files` (1..4 ảnh) và cấp batch Signed Upload URLs trên bucket `"attachments"` với đầy đủ Auth, Rate Limit (`image-gen-ref-upload:${userId}`), Zod validation, Ownership check (`assertConversationOwner`), Gatekeeper (`getUserProfile` fail-closed 503/403).
4. `src/app/api/generate-image/reference-upload-url/route.test.ts` — Co-located API integration tests (401, 429, 400 validation với mảng rỗng / > 4 file / MIME ngoài whitelist / size > 40 MB, 404/403 ownership, 503/403 gatekeeper, 200 happy path multi-file, 500 storage error).
5. `src/lib/features/image-gen/providers/GeminiNativeImageProvider.test.ts` — Co-located unit tests cho `GeminiNativeImageProvider` (`inlineData <= 15 MB`, Gemini Files API `> 15 MB`, `ai.files.delete` cleanup trong `finally` cả khi thành công lẫn lỗi, BYOK key consistency, backward-compat `referenceImages` base64).

#### `[MODIFY]`

6. `src/lib/features/files/uploadPresentation.ts` — Xuất thêm hằng số `export const STUDIO_REF_IMAGE_MAX_BYTES = 40 * 1024 * 1024;` và `export const STUDIO_REF_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;`; thêm tham số tùy chọn `allowedMimeTypes?: readonly string[]` vào `validateReferenceImages` (giữ mặc định `file.type.startsWith("image/")` và `DEFAULT_REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024` cho backward-compat).
7. `src/lib/features/files/uploadPresentation.test.ts` — Bổ sung test xác minh `STUDIO_REF_IMAGE_MAX_BYTES === 40 * 1024 * 1024`, `STUDIO_REF_ALLOWED_MIME_TYPES`, `validateReferenceImages` với ngưỡng 40 MB + whitelist 4 MIME (chấp nhận 35 MB PNG, chặn 41 MB, chặn `image/svg+xml` & `image/heic`) trong khi mặc định vẫn chặn 12 MB.
8. `src/lib/utils/translations/vi.ts` — Thêm `studioRefFileTooLarge` và `studioRefUploadFailed`.
9. `src/lib/utils/translations/en.ts` — Thêm `studioRefFileTooLarge` và `studioRefUploadFailed`.
10. `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx` — Đồng bộ `accept="image/png,image/jpeg,image/webp,image/gif"`, truyền `STUDIO_REF_IMAGE_MAX_BYTES` và `STUDIO_REF_ALLOWED_MIME_TYPES` vào `validateReferenceImages(...)`, và đổi toast lỗi dung lượng sang `t("studioRefFileTooLarge")`.
11. `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx` — Cập nhật test (Loại C) cho ngưỡng 40 MB + whitelist 4 MIME (chấp nhận 12 MB PNG, chặn 41 MB với `studioRefFileTooLarge`, chặn `image/svg+xml` với `describeInvalidImage`).
12. `src/lib/features/image-gen/core/types.ts` — Thêm `ResolvedReferenceImage` interface và mở rộng `ImageGenOptions` với `referenceImagePaths?: string[]` và `resolvedReferenceImages?: ResolvedReferenceImage[]`.
13. `src/lib/features/image-gen/studioHelpers.ts` — Thêm `ReferenceImageUploadError`, `uploadReferenceImages(files, conversationId, fallbackError)` (gọi batch `POST /api/generate-image/reference-upload-url` 1 lần rồi `PUT` từng file lên `signedUrl`), và mở rộng `buildGenerateImageBody` nhận `referenceImagePaths?: string[]` (giữ `referenceImagesBase64` optional cho backward-compat).
14. `src/lib/features/image-gen/studioHelpers.test.ts` — Bổ sung tests cho `uploadReferenceImages` (happy path multi-file với 1 call sign-URL, sign URL error, PUT 413/500 error ném `ReferenceImageUploadError`, malformed response) và `buildGenerateImageBody` với `referenceImagePaths`.
15. `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` — Thay `convertReferenceImagesToBase64` bằng `uploadReferenceImages` bên trong `sendOne()` (mỗi nhánh batch có bộ `ref-<uuid>` độc lập); ở outer `catch` hiển thị `toast.error(t("studioRefUploadFailed"))` đúng 1 lần khi `error instanceof ReferenceImageUploadError` và giữ nguyên `Promise.allSettled` + `resolveBatchFailureReason`.
16. `src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts` — Bổ sung tests cho cả single (`numberOfImages = 1`) và batch (`numberOfImages = 2..4`): flow `uploadReferenceImages` → `postGenerateImageRequest` với `referenceImagePaths` độc lập từng nhánh, lỗi upload chỉ bắn `toast.error` **đúng 1 lần**, không gọi `postGenerateImageRequest` cho nhánh lỗi, và reset `generating = false`.
17. `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts` — Hỗ trợ `options.resolvedReferenceImages`: dùng `inlineData` khi tổng `<= 15 MB`, dùng Gemini Files API (`ai.files.upload` + `fileData`) khi tổng `> 15 MB`, và dọn sạch qua `ai.files.delete` trong `finally`.
18. `src/app/api/generate-image/route.ts` — Giữ diff tối thiểu (`<= 25` dòng): mở rộng `imageGenOptionsSchema` với `referenceImagePaths: z.array(z.string().min(1).max(512)).max(4).optional()`, đặt `validateReferenceImagePaths` + `getSupabaseAdmin()` + `try { ... } finally { cleanupTempReferenceImages(...) }` ngay sau `assertConversationOwner` (trước gatekeeper/batchSize/quota), tải ảnh qua `downloadReferenceImagesFromStorage`, auto-route `"gemini-native"`, truyền `resolvedReferenceImages` cho provider, strip `referenceImagePaths` & `resolvedReferenceImages` trước `saveMessage`, và tính `referenceImageCount`.
19. `src/app/api/generate-image/route.test.ts` — Bổ sung tests cho `referenceImagePaths`: happy path, IDOR 403 không xóa file nạn nhân, path traversal 400/403, early failure cleanup (403 `BATCH_SIZE_EXCEEDS_RANK`, 403 quota, 503 profile null vẫn gọi `storage.remove(validatedPaths)`), oversize 400, metadata sanitization + `referenceImageCount`, và `finally` cleanup khi provider lỗi.
20. `docs/CHANGELOG.md` — Ghi nhận tính năng nâng giới hạn ảnh tham chiếu Image Studio lên 40 MB qua Direct Upload.

#### `[DELETE]`

- Không có file nào bị xóa.

---

### 6. Caller-First Design Sketch

#### A. Client → Batch Signed URL API → Supabase Storage → Generate API (Nhất quán Single & Batch)

```typescript
// 1. Client helper (src/lib/features/image-gen/studioHelpers.ts)
export class ReferenceImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceImageUploadError";
  }
}

export async function uploadReferenceImages(
  files: readonly File[],
  conversationId: string,
  fallbackError = "Failed to upload reference image"
): Promise<string[]>;
// - Gửi 1 request POST /api/generate-image/reference-upload-url với { conversationId, files: [...] }
// - PUT từng file lên signedUrl với headers { "Content-Type": mimeType, "x-upsert": "false" }
// - Bất kỳ lỗi nào -> throw new ReferenceImageUploadError(message)

// 2. Call site thống nhất trong src/app/features/image-gen/components/hooks/useImageStudioActions.ts
const sendOne = async () => {
  const referenceImagePaths =
    referenceImages.length > 0
      ? await uploadReferenceImages(referenceImages, resolvedTargetId, t("studioRefUploadFailed"))
      : [];
  if (isUnmountedRef.current) return { success: false };

  const body = buildGenerateImageBody({
    prompt: finalPrompt,
    conversationId: resolvedTargetId,
    model,
    aspectRatio,
    resolution,
    style,
    isEnhancerOn,
    referenceImagePaths,
    batchSize: numberOfImages > 1 ? numberOfImages : undefined,
  });
  const json = await postGenerateImageRequest(body, key, "Generation failed");
  if (json.success) {
    successCount++;
    // ... update progress label
  }
  return json;
};

// Outer catch trong handleGenerate (chạy TỐI ĐA 1 lần cho cả single lẫn batch):
} catch (error: unknown) {
  logger.error("Gen Error:", error);
  if (successCount === 0 && !isUnmountedRef.current) {
    if (error instanceof ReferenceImageUploadError) {
      toast.error(t("studioRefUploadFailed"));
    } else {
      setShowError(classifyStudioError(error instanceof Error ? error.message : "", t));
    }
  }
}
```

#### B. Batch Signed Upload URL API Contract (`POST /api/generate-image/reference-upload-url`)

```typescript
// Request JSON (1..4 ảnh trong 1 request -> chỉ tốn 1 lượt rate limit)
interface ReferenceUploadUrlRequest {
  conversationId: string; // UUID
  files: Array<{
    filename: string; // 1..255 chars (chỉ dùng cho validation/logging, KHÔNG ghép trực tiếp vào storagePath)
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    sizeBytes: number; // integer: 1 .. 41943040 (40 * 1024 * 1024)
  }>; // min(1).max(4)
}

// Response 200 JSON (chuẩn .agents/skills/api-patterns/SKILL.md)
{
  success: true,
  data: {
    uploads: Array<{
      signedUrl: string,
      token: string,
      storagePath: string // `${userId}/${conversationId}/ref-${uuid}.${safeExt}`
    }>
  }
}
```

#### C. Server Storage Helper (`src/lib/features/image-gen/referenceImageStorage.ts`)

```typescript
export const MAX_STUDIO_REF_IMAGE_BYTES = 40 * 1024 * 1024;
export const ALLOWED_REF_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export type AllowedRefImageMime = (typeof ALLOWED_REF_IMAGE_MIME_TYPES)[number];

export function buildReferenceImageStoragePath(
  userId: string,
  conversationId: string,
  mimeType: AllowedRefImageMime
): string;

export function validateReferenceImagePaths(
  paths: readonly string[],
  userId: string,
  conversationId: string
): string[];

export function detectImageMimeFromBytes(bytes: Uint8Array): AllowedRefImageMime | null;

// Kiểm tra blob.size <= 0 || blob.size > MAX_STUDIO_REF_IMAGE_BYTES TRƯỚC await blob.arrayBuffer()
export async function downloadReferenceImagesFromStorage(
  supabase: SupabaseClient,
  validatedPaths: readonly string[]
): Promise<ResolvedReferenceImage[]>;

export async function cleanupTempReferenceImages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  paths: readonly string[]
): Promise<void>;
```

#### D. Server Route Lifecycle (`src/app/api/generate-image/route.ts`)

```typescript
// Sau bước 4: await assertConversationOwner(conversationId, userId);
// Bước 4.5: Validate paths TRƯỚC gatekeeper/quota (IDOR throw 403 -> không bao giờ xóa file nạn nhân)
const validatedRefPaths = options?.referenceImagePaths?.length
  ? validateReferenceImagePaths(options.referenceImagePaths, userId, conversationId)
  : [];
const supabase = getSupabaseAdmin();

try {
  // Bước 5: getUserProfile (503/403)
  // Bước 6: effectiveBatchSize > maxBatchSize (403)
  // Bước 7: tryClaimBatchGenSlot (403/503)
  // Bước 8: downloadReferenceImagesFromStorage -> enhancer -> provider -> upload output -> saveMessage
} finally {
  if (validatedRefPaths.length > 0) {
    await cleanupTempReferenceImages(supabase, userId, conversationId, validatedRefPaths);
  }
}
```

#### E. Provider (`src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts`)

```typescript
export const INLINE_REF_IMAGE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB

// Bên trong GeminiNativeImageProvider.generate():
// - Nếu options?.resolvedReferenceImages có phần tử:
//   - Tính totalBytes = sum(img.sizeBytes)
//   - Nếu totalBytes <= INLINE_REF_IMAGE_THRESHOLD_BYTES -> push { inlineData: { data: img.buffer.toString("base64"), mimeType: img.mimeType } }
//   - Ngược lại -> upload từng ảnh qua ai.files.upload({ file: new Blob([new Uint8Array(img.buffer)], { type: img.mimeType }), config: { mimeType: img.mimeType, displayName: img.filename || "ref-image" } })
//     và push { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || img.mimeType } }, lưu uploaded.name vào uploadedGeminiFileNames
// - Trong finally: Promise.allSettled(uploadedGeminiFileNames.map((name) => ai.files.delete({ name })))
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Shared Types & Storage Security Module**:
  - Cập nhật `src/lib/features/image-gen/core/types.ts` thêm `ResolvedReferenceImage` và mở rộng `ImageGenOptions` (`referenceImagePaths?`, `resolvedReferenceImages?`).
  - Tạo `src/lib/features/image-gen/referenceImageStorage.ts` với tạo path thuần ASCII, validate IDOR/Path Traversal, kiểm tra magic bytes (PNG/JPEG/WebP/GIF), tải từ bucket `"attachments"` kèm kiểm tra `blob.size <= 40 MB` **trước** `await blob.arrayBuffer()` (OOM guard), và cleanup fail-safe.
  - Viết `src/lib/features/image-gen/referenceImageStorage.test.ts`.
- [ ] **Bước 2 — Batch Signed Upload URL API Route**:
  - Tạo `src/app/api/generate-image/reference-upload-url/route.ts` (`POST`) với chuỗi: `auth()` → `consumeRateLimit(\`image-gen-ref-upload:${userId}\`)`→ parse JSON + Zod validate`{ conversationId, files: min(1).max(4) }`→`assertConversationOwner(conversationId, userId)`→`getUserProfile(userId)`(fail-closed 503/403) → sinh path & gọi`createSignedUploadUrl`cho từng file trong`files`→`success({ uploads })`.
  - Viết `src/app/api/generate-image/reference-upload-url/route.test.ts`.
- [ ] **Bước 3 — Gemini Provider (Inline vs Gemini Files API + Cleanup)**:
  - Cập nhật `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts` hỗ trợ `resolvedReferenceImages` với ngưỡng `INLINE_REF_IMAGE_THRESHOLD_BYTES = 15 * 1024 * 1024`, dùng `ai.files.upload` + `fileData` khi lớn hơn 15 MB, và xóa file tạm qua `ai.files.delete` trong `finally`.
  - Viết `src/lib/features/image-gen/providers/GeminiNativeImageProvider.test.ts`.
- [ ] **Bước 4 — Generate Image Route Integration & Early-Failure Cleanup**:
  - Cập nhật `src/app/api/generate-image/route.ts` (giữ diff tối thiểu `<= 25` dòng):
    - Mở rộng `imageGenOptionsSchema` với `referenceImagePaths: z.array(z.string().min(1).max(512)).max(4).optional()`.
    - Đặt `validateReferenceImagePaths` + `getSupabaseAdmin()` + `try { ... } finally { cleanupTempReferenceImages(...) }` ngay sau `assertConversationOwner` (trước gatekeeper, `batchSize` và `tryClaimBatchGenSlot`).
    - Tải ảnh qua `downloadReferenceImagesFromStorage` trước khi gọi provider, auto-route `"gemini-native"`, truyền `resolvedReferenceImages` vào provider.
    - Strip `referenceImagePaths` và `resolvedReferenceImages` (cùng `referenceImage`, `referenceImages`) khỏi `savedOptions` trước `saveMessage()`, tính `referenceImageCount`.
  - Cập nhật `src/app/api/generate-image/route.test.ts`.
- [ ] **Bước 5 — Client Constants, MIME Whitelist Alignment, Translations & Direct Upload Flow**:
  - Cập nhật `src/lib/features/files/uploadPresentation.ts` (xuất `STUDIO_REF_IMAGE_MAX_BYTES`, `STUDIO_REF_ALLOWED_MIME_TYPES`, thêm `allowedMimeTypes?` vào `validateReferenceImages`) và `src/lib/features/files/uploadPresentation.test.ts`.
  - Thêm khóa `studioRefFileTooLarge` & `studioRefUploadFailed` vào `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
  - Cập nhật `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx` (`accept="image/png,image/jpeg,image/webp,image/gif"`, truyền `STUDIO_REF_IMAGE_MAX_BYTES` + `STUDIO_REF_ALLOWED_MIME_TYPES`) và `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx`.
  - Thêm `ReferenceImageUploadError`, `uploadReferenceImages` (batch sign-URL) và mở rộng `buildGenerateImageBody` trong `src/lib/features/image-gen/studioHelpers.ts` + cập nhật `src/lib/features/image-gen/studioHelpers.test.ts`.
  - Cập nhật `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` + `src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts`.
- [ ] **Bước 6 — Living Docs & Full Verification**:
  - Cập nhật `docs/CHANGELOG.md`.
  - Chạy `npm run type-check; npm run lint; npm run test:run` (PowerShell 5.1 dùng `;`) và kiểm tra 0 errors / 0 warnings.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID            | Thành phần                                                                                                                      | Input / Kịch bản                                                                                                                                                                                                     | Expected Output / Hành vi bắt buộc                                                                                                                                                                                                                                                                                                          | Tiêu chí Pass/Fail                                                                |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| **TC-REF-01** | `POST /api/generate-image/reference-upload-url`                                                                                 | Request hợp lệ (`conversationId` UUID thuộc user, `files` gồm 2 ảnh: 40 MB PNG và 10 MB WebP)                                                                                                                        | HTTP `200`, `{ success: true, data: { uploads: [ ...2 items ] } }`, mỗi `storagePath` khớp `${userId}/${conversationId}/ref-<uuid>.<ext>` thuần ASCII; chỉ tiêu tốn 1 lượt `consumeRateLimit`                                                                                                                                               | Pass nếu đúng status, envelope, thứ tự, prefix và 1 lượt rate limit               |
| **TC-REF-02** | `POST /api/generate-image/reference-upload-url`                                                                                 | Auth thiếu / rate limit vượt / `files: []` hoặc 5 files / `sizeBytes: 0` hoặc `40MB + 1` / `mimeType: "image/svg+xml"` / user không sở hữu conversation / profile null (503) / blocked (403) / not_whitelisted (403) | Trả đúng mã lỗi `401`, `429`, `400`, `403`/`404`, `503`, `403` theo `.agents/skills/api-patterns/SKILL.md` và KHÔNG gọi `createSignedUploadUrl`                                                                                                                                                                                             | Pass nếu mọi nhánh fail-closed chặn trước khi gọi Supabase Storage                |
| **TC-REF-03** | `src/lib/features/image-gen/referenceImageStorage.ts`                                                                           | `validateReferenceImagePaths` với path hợp lệ thuộc `${userId}/${conversationId}/ref-<uuid>.webp`                                                                                                                    | Trả về mảng path đã trim, giữ nguyên thứ tự                                                                                                                                                                                                                                                                                                 | Pass nếu trả đúng mảng                                                            |
| **TC-REF-04** | `src/lib/features/image-gen/referenceImageStorage.ts` (Security)                                                                | Path thuộc user khác (`other@x.com/...`), conversation khác, chứa `..`, `\`, ký tự điều khiển `\u0000`, hoặc không bắt đầu bằng `ref-` (ví dụ `gen-123.png`), hoặc đuôi `.svg`/`.exe`                                | Throw `ForbiddenError` (sai owner/conversation) hoặc `ValidationError` (path traversal / format sai)                                                                                                                                                                                                                                        | Pass nếu 100% input độc hại bị từ chối                                            |
| **TC-REF-05** | `src/lib/features/image-gen/referenceImageStorage.ts` (OOM Guard & Magic Bytes)                                                 | Blob tải từ Storage có `blob.size > 40 MB` (với `arrayBuffer: vi.fn()`), hoặc `blob.size === 0`, hoặc nội dung HTML/EXE giả danh `.png`                                                                              | Throw `ValidationError`; khi `blob.size > 40 MB` thì `blob.arrayBuffer()` **KHÔNG** được gọi (OOM guard); chấp nhận magic bytes hợp lệ của PNG, JPEG, WebP, GIF                                                                                                                                                                             | Pass nếu chặn trước `arrayBuffer()` và chặn spoofed MIME                          |
| **TC-REF-06** | `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts`                                                             | `resolvedReferenceImages` tổng `<= 15 MB` (ví dụ 2 × 5 MB)                                                                                                                                                           | Gửi bằng `inlineData`, KHÔNG gọi `ai.files.upload`, KHÔNG gọi `ai.files.delete`                                                                                                                                                                                                                                                             | Pass nếu `generateContent` nhận đúng `inlineData` parts                           |
| **TC-REF-07** | `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts`                                                             | `resolvedReferenceImages` tổng `> 15 MB` (ví dụ 2 × 20 MB), cả khi `generateContent` thành công và khi `generateContent` throw                                                                                       | Gọi `ai.files.upload` (dùng đúng `ai` client của request/BYOK), gửi `{ fileData: { fileUri, mimeType } }`, và LUÔN gọi `ai.files.delete({ name })` cho mọi file đã upload trong `finally`                                                                                                                                                   | Pass nếu `ai.files.delete` được gọi đủ số lượng trong cả 2 nhánh thành công & lỗi |
| **TC-REF-08** | `src/app/api/generate-image/route.ts`                                                                                           | Request có `options.referenceImagePaths` hợp lệ (2 ảnh): (a) thành công, (b) provider throw, (c) fail sớm ở 403 `BATCH_SIZE_EXCEEDS_RANK` / 403 quota / 503 profile null                                             | (a) Auto-route `"gemini-native"`, download, truyền `resolvedReferenceImages`, `saveMessage` không chứa `referenceImagePaths`/`resolvedReferenceImages` và có `referenceImageCount: 2`, `finally` xóa `validatedPaths`; (b) & (c) `finally` VẪN gọi `storage.remove(validatedPaths)`                                                         | Pass nếu mọi nhánh sau ownership đều dọn sạch Storage                             |
| **TC-REF-09** | `src/lib/features/files/uploadPresentation.ts` & `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`        | Chọn/kéo thả ảnh 12 MB PNG, 41 MB PNG, `image/svg+xml`, `image/heic` trong Image Studio; gọi `validateReferenceImages` mặc định (`TemplateModal`) với ảnh 12 MB                                                      | Image Studio chấp nhận 12 MB PNG, từ chối 41 MB bằng `toast.error(t("studioRefFileTooLarge"))`, từ chối `image/svg+xml` & `image/heic` bằng `toast.error(t("describeInvalidImage"))`; `validateReferenceImages` mặc định vẫn từ chối 12 MB                                                                                                  | Pass nếu tách biệt ngưỡng 40 MB / 10 MB và đồng bộ whitelist 4 MIME               |
| **TC-REF-10** | `src/lib/features/image-gen/studioHelpers.ts` & `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` (Single) | `numberOfImages = 1`, upload 2 ảnh thành công → gọi `POST /api/generate-image` với `referenceImagePaths`; và kịch bản upload thất bại (HTTP 413/500)                                                                 | Thành công: 1 call sign-URL + 2 `PUT` (`Content-Type`, `x-upsert: false`) → generate body có `referenceImagePaths`. Thất bại: ném `ReferenceImageUploadError`, `logger.error` + `toast.error(t("studioRefUploadFailed"))` đúng 1 lần, KHÔNG gọi `POST /api/generate-image`, reset `generating = false`                                      | Pass nếu không bị treo trạng thái và hiển thị đúng 1 toast                        |
| **TC-REF-11** | `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` (Batch `numberOfImages > 1`)                             | (a) `numberOfImages = 3` với 2 ảnh tham chiếu thành công; (b) `numberOfImages = 3` khi tất cả nhánh upload đều lỗi (`ReferenceImageUploadError`); (c) 1 nhánh thành công + 1 nhánh upload lỗi                        | (a) Mỗi `sendOne()` upload bộ `referenceImagePaths` độc lập (3 bộ path khác nhau → 0 race condition cleanup); (b) `Promise.allSettled` + `resolveBatchFailureReason` ném lỗi về outer `catch`, chỉ gọi `toast.error(t("studioRefUploadFailed"))` **đúng 1 lần** (KHÔNG spam 3 toast); (c) `successCount === 1`, không hiển thị lỗi toàn cục | Pass nếu 0 duplicate toast, 0 race condition và giữ đúng ngữ nghĩa batch          |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Danh sách file test co-located

- `src/lib/features/image-gen/referenceImageStorage.test.ts` `[NEW]`
- `src/app/api/generate-image/reference-upload-url/route.test.ts` `[NEW]`
- `src/lib/features/image-gen/providers/GeminiNativeImageProvider.test.ts` `[NEW]`
- `src/app/api/generate-image/route.test.ts` `[MODIFY]`
- `src/lib/features/image-gen/studioHelpers.test.ts` `[MODIFY]`
- `src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts` `[MODIFY]`
- `src/lib/features/files/uploadPresentation.test.ts` `[MODIFY]`
- `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx` `[MODIFY]`

#### Lệnh kiểm chứng (Windows PowerShell 5.1 — bắt buộc dùng `;`)

```powershell
npm run type-check; npm run lint; npx vitest run src/lib/features/image-gen/ src/app/api/generate-image/ src/app/features/image-gen/components/ src/lib/features/files/uploadPresentation.test.ts --reporter=dot
```

Và trước khi hoàn tất toàn task:

```powershell
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes (Kiểm chứng nối dây đầu-cuối)

1. **WP-1 (Client Direct Upload Wiring — Single & Batch)**: Trong `src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts`, kiểm tra khi `referenceImages = [file1, file2]`, `uploadReferenceImages` được gọi với `(referenceImages, conversationId, "studioRefUploadFailed")` và `postGenerateImageRequest` nhận `options.referenceImagePaths` (và `options.referenceImages` là `undefined`); khi `numberOfImages = 2`, 2 lần `postGenerateImageRequest` nhận 2 bộ `referenceImagePaths` riêng biệt.
2. **WP-2 (Server Download → Provider → DB Sanitization → Cleanup Wiring)**: Trong `src/app/api/generate-image/route.test.ts`, kiểm tra request chứa `referenceImagePaths` gọi `storage.download(path)` → `provider.generate(prompt, expect.objectContaining({ resolvedReferenceImages: [...] }))` → `saveMessage` nhận `referenceImageCount` và không chứa `referenceImagePaths`/`resolvedReferenceImages` → `storage.remove(validatedPaths)` trong `finally`.
3. **WP-3 (Gemini Files API Wiring)**: Trong `src/lib/features/image-gen/providers/GeminiNativeImageProvider.test.ts`, kiểm tra khi `totalBytes > 15 MB`, `ai.files.upload` trả `{ name, uri, mimeType }` được gắn vào `generateContent` dạng `{ fileData: { fileUri, mimeType } }` và `ai.files.delete({ name })` chạy trong `finally`.

#### Negative Probes (Chứng minh lớp bảo vệ chặn đúng input vi phạm)

1. **NP-1 (IDOR + Zero-Delete Safety)**: Gửi `referenceImagePaths: ["victim@example.com/<convId>/ref-<uuid>.png"]` tới `POST /api/generate-image` → trả `403 FORBIDDEN`, KHÔNG gọi `storage.download`, KHÔNG gọi `provider.generate`, và KHÔNG gọi `storage.remove` trên file của nạn nhân.
2. **NP-2 (Path Traversal & Non-Temp Prefix)**: Gửi `["test@example.com/<convId>/../other/ref-<uuid>.png"]` hoặc `["test@example.com/<convId>/gen-123.png"]` → chặn với `400`/`403`, không chạm Storage.
3. **NP-3 (OOM Guard & Spoofed MIME + Early-Reject Cleanup)**:
   - (a) Blob 41 MB trả từ `storage.download` → `downloadReferenceImagesFromStorage` ném `400 VALIDATION_ERROR` mà `blob.arrayBuffer()` **KHÔNG** được gọi, và `finally` vẫn xóa file tạm rác trên Storage.
   - (b) Request có `referenceImagePaths` hợp lệ nhưng bị chặn `403 BATCH_SIZE_EXCEEDS_RANK` hoặc `403 BATCH_GEN_LIMIT_EXCEEDED` → `finally` VẪN gọi `storage.remove(validatedPaths)`.
4. **NP-4 (Upload Failure Abort & Zero Duplicate Toast in Batch)**: `PUT` tới `signedUrl` trả `413` hoặc network error với cả `numberOfImages = 1` và `numberOfImages = 3` → `useImageStudioActions` gọi `toast.error("studioRefUploadFailed")` **đúng 1 lần**, KHÔNG gọi `POST /api/generate-image`, giải phóng `generatingRef` (lần bấm tiếp theo không deadlock).
5. **NP-5 (TemplateModal Regression Guard & Client MIME Whitelist)**: `validateReferenceImages([file12MB], 0, 1)` (không truyền `maxBytes`/`allowedMimeTypes`) vẫn trả `tooLargeCount: 1`, `accepted: []`; tại `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`, drop file `image/svg+xml` hoặc `image/heic` bị chặn ngay tại UI với `toast.error(t("describeInvalidImage"))`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                    |   Mức độ   | Biện pháp kiểm soát kỹ thuật (Technical Control)                                                                                                                                                                                                                                                                                                                                | Kiểm chứng                                                                                                                                       |
| :-------------------------------------------------------------------------------------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **IDOR / Path Traversal xóa hoặc đọc nhầm file người khác trên bucket `"attachments"`**                   |    Cao     | `validateReferenceImagePaths` trong `src/lib/features/image-gen/referenceImageStorage.ts` bắt buộc literal prefix `${userId}/${conversationId}/ref-`, suffix khớp regex UUID + ext ảnh hợp lệ, cấm `..`/`\`/control chars. Chỉ các path đã qua validation mới được đưa vào `validatedRefPaths` để `download` và `finally remove`.                                               | **NP-1**, **NP-2**, **TC-REF-04**                                                                                                                |
| **OOM hoặc file độc hại do client khai báo gian dối `sizeBytes`/MIME khi xin Signed URL**                 |    Cao     | `downloadReferenceImagesFromStorage` trong `src/lib/features/image-gen/referenceImageStorage.ts` kiểm tra `blob.size <= 0 \|\| blob.size > MAX_STUDIO_REF_IMAGE_BYTES` **trước** khi gọi `await blob.arrayBuffer()`, sau đó xác thực `buffer.byteLength` và magic bytes (`detectImageMimeFromBytes` cho PNG/JPEG/WebP/GIF); `finally` vẫn dọn file tạm.                         | **NP-3**, **TC-REF-05**                                                                                                                          |
| **Rác file tạm trên Supabase Storage khi bị chặn sớm (`batchSize`/quota/gatekeeper) hoặc lỗi generation** | Trung bình | Trong `src/app/api/generate-image/route.ts`, đặt `validateReferenceImagePaths` + `getSupabaseAdmin()` + `try/finally { cleanupTempReferenceImages }` ngay sau `assertConversationOwner` (trước gatekeeper, `batchSize`, `tryClaimBatchGenSlot`, enhancer, provider). `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts` cũng xóa Gemini Files trong `finally`. | **NP-3**, **TC-REF-07**, **TC-REF-08**, **WP-2**, **WP-3**                                                                                       |
| **Race condition, spam toast & cạn rate-limit khi batch `numberOfImages > 1`**                            | Trung bình | `POST /api/generate-image/reference-upload-url` nhận mảng `files` (1..4 ảnh = 1 lượt rate limit); mỗi `sendOne()` trong `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` upload bộ `ref-<uuid>` độc lập (0 race condition) và ném `ReferenceImageUploadError` để outer `catch` chỉ gọi `toast.error` đúng 1 lần (batch 4 ảnh tốn 4/20 rate limit).        | **TC-REF-11**, **WP-1**, **NP-4**                                                                                                                |
| **Lệch whitelist MIME giữa UI (`image/*`) và Server (`png/jpeg/webp/gif`)**                               | Trung bình | Xuất `STUDIO_REF_ALLOWED_MIME_TYPES` trong `src/lib/features/files/uploadPresentation.ts`, đồng bộ `accept="image/png,image/jpeg,image/webp,image/gif"` và truyền `allowedMimeTypes` tại `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`.                                                                                                               | **TC-REF-09**, **NP-5**                                                                                                                          |
| **BYOK API key không đọc được file upload bằng server Gemini key**                                        | Trung bình | `src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts` gọi `ai.files.upload` và `ai.files.delete` trên chính instance `ai = new GoogleGenAI({ apiKey: key })` của request (`src/lib/features/image-gen/providers/GeminiNativeImageProvider.ts:26`), đảm bảo đồng nhất project/API key.                                                                             | **TC-REF-07**                                                                                                                                    |
| **Trình duyệt ngốn RAM / giật lag khi tạo base64 preview cho 4 ảnh × 40 MB**                              | Trung bình | Giữ nguyên `DEFAULT_PREVIEW_MAX_BYTES = 15 * 1024 * 1024` (`src/lib/features/files/uploadPresentation.ts:14`); `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:209-213` tự động hiển thị fallback `<ImageIcon />` cho ảnh > 15 MB.                                                                                                                       | `[SRC: src/lib/features/files/uploadPresentation.ts:14]`, `[SRC: src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:209-213]` |
| **Bucket `"attachments"` trên Supabase có `file_size_limit < 40 MB` hoặc chưa bật CORS `PUT`**            | Trung bình | `uploadReferenceImages` ném `ReferenceImageUploadError` trên mọi lỗi HTTP status (413/403/network); `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` bắt lỗi, log và hiển thị `toast.error(t("studioRefUploadFailed"))`, không làm treo UI. (Cần đảm bảo cấu hình bucket trên Supabase Dashboard >= 40 MB).                                               | **NP-4**, **TC-REF-10**                                                                                                                          |
| **Làm vỡ `TemplateModal` (10 MB limit) khi nâng ngưỡng Image Studio lên 40 MB**                           | Trung bình | Giữ nguyên `DEFAULT_REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024` và hành vi mặc định của `validateReferenceImages` trong `src/lib/features/files/uploadPresentation.ts:13`, chỉ xuất thêm `STUDIO_REF_IMAGE_MAX_BYTES = 40 * 1024 * 1024` cho `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`.                                                               | **NP-5**, **TC-REF-09**                                                                                                                          |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh: `node scripts/verify-plan.mjs docs/plans/2026-11-22-reference-images-40mb-direct-upload.md` → **Exit code 1 (`VERIFY_PLAN: FAIL — 3 failures, 0 warnings`)**:
  - `[PASS] SECTIONS 7/7`
  - `[FAIL] MISSING_FILE ControlPanelReferenceImages.tsx:209-213` (dòng 24, 332 dùng đường dẫn rút gọn)
  - `[FAIL] MISSING_FILE GeminiNativeImageProvider.ts:26` (dòng 331 dùng đường dẫn rút gọn)
  - `[FAIL] MISSING_FILE uploadPresentation.ts:14` (dòng 332 dùng đường dẫn rút gọn)
  - `[INFO] CRITIC_REQUIRED no`
- Lỗi cũ: N/A (Revision 1).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                    | Bằng chứng                                                                                                                               | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MAJOR] | `scripts/verify-plan.mjs:1`                                                    | `[CMD]` `node scripts/verify-plan.mjs ...` exit 1 (3 `MISSING_FILE`)                                                                     | Kế hoạch dùng 3 shorthand path (`ControlPanelReferenceImages.tsx:209-213`, `GeminiNativeImageProvider.ts:26`, `uploadPresentation.ts:14`) thay vì đường dẫn tương đối đầy đủ từ repo root, vi phạm Fail Criteria #1 và `.agents/rules/02-quality.md`. Cần sửa toàn bộ sang full relative path (`src/...`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2   | DEFECT         | [MAJOR] | `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:133-176` | `[SRC]` `useImageStudioActions.ts:133-176`, `[SRC]` `src/lib/core/rateLimit.ts:11-12`, `[SRC]` `src/app/api/cron/cleanup/route.ts:39-42` | **Mâu thuẫn batch generation (`numberOfImages > 1`) & thiếu Test Contract**: (a) Design Sketch A đặt `try { uploadReferenceImages } catch { toast.error; return }` ngoài `sendOne()`, trái với Mục 3 #5 & Mục 10 ("mỗi `sendOne()` tự upload"). Nếu đặt y nguyên khối `catch { toast.error; return }` vào trong `sendOne()`, lỗi upload ở batch 4 ảnh sẽ bắn 4 `toast.error` trùng lặp và `Promise.allSettled` coi là `fulfilled` (lọt `resolveBatchFailureReason`). (b) `consumeRateLimit` mặc định `MAX_REQUESTS_PER_WINDOW = 20 / 60s` (`rateLimit.ts:12`); 1 lần bấm batch 4 × 4 ảnh ngốn 16/20 request (bấm lần 2 dính 429) và tốn 4× băng thông upload (tới 640 MB). (c) Mục 10 (rủi ro Trung bình batch race condition) ghi "unit test batch generation" nhưng Mục 8 & Mục 9 không có Test Case / Probe nào cho `numberOfImages > 1` (vi phạm Evidence Bar 4.5.4). Cần đồng bộ thiết kế batch (chỉ rõ cơ chế upload + khử trùng lặp toast + xử lý partial upload orphan) và bổ sung TC batch vào Mục 8 & 9. |
| 3   | DEFECT         | [MAJOR] | `src/app/api/generate-image/route.ts:121-154`                                  | `[SRC]` `src/app/api/generate-image/route.ts:121-154,260`                                                                                | **Sót cleanup Storage khi từ chối `batchSize`/quota & thiếu bảo vệ OOM trước `arrayBuffer()`**: Trong `route.ts`, kiểm tra `effectiveBatchSize > maxBatchSize` (dòng 125) và `tryClaimBatchGenSlot` (dòng 138) nằm TRƯỚC khối `try` ở dòng 154, còn `getSupabaseAdmin()` nằm ở dòng 260. Nếu `validateReferenceImagePaths` chạy trước quota claim nhưng `try/finally` chỉ gắn vào dòng 154, mọi request bị chặn 403/503 ở bước batch/quota sẽ bỏ lại file tạm vĩnh viễn trên bucket `"attachments"` (cron `cleanup/route.ts` không quét file không có DB row). Cần nêu rõ đặt `getSupabaseAdmin()` + `try/finally { cleanupTempReferenceImages }` bao trọn ngay từ sau `validateReferenceImagePaths`, và trong `downloadReferenceImagesFromStorage` kiểm tra `blob.size > 0 && blob.size <= MAX_STUDIO_REF_IMAGE_BYTES` TRƯỚC khi gọi `await blob.arrayBuffer()`.                                                                                                                                                  |
| 4   | DEFECT         | [MAJOR] | `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:179`    | `[SRC]` `ControlPanelReferenceImages.tsx:179`, `[SRC]` `src/lib/features/files/uploadPresentation.ts:267`                                | **Lệch whitelist MIME giữa Client và Server**: Client dùng `accept="image/*"` và `file.type.startsWith("image/")`, chấp nhận cả `image/avif`, `image/heic`, `image/bmp`, `image/svg+xml`, nhưng `POST /api/generate-image/reference-upload-url` chỉ cho phép 4 MIME (`png/jpeg/webp/gif`). Người dùng chọn ảnh `.avif`/`.heic`/`.svg` sẽ qua được UI rồi thất bại khi bấm Generate với lỗi upload chung `studioRefUploadFailed`. Cần đồng bộ `accept="image/png,image/jpeg,image/webp,image/gif"` và giới hạn 4 MIME trong `ControlPanelReferenceImages.tsx` (giữ backward-compat cho `TemplateModal.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | DEFECT         | [MINOR] | `src/app/api/generate-image/route.ts:442`                                      | `[SRC]` `src/app/api/generate-image/route.ts:442`                                                                                        | File `route.ts` hiện đã dài 442 dòng (vượt Hard Max 300 dòng của API route). Tách `referenceImageStorage.ts` là hợp lý, nhưng cần kiểm soát diff trong `route.ts` ở mức tối thiểu (<= 25 dòng) để không tiếp tục phình thêm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | RISK_DISMISSED | [MINOR] | `next.config.ts:77`                                                            | `[SRC]` `next.config.ts:77`, `[SRC]` `node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts:344-350`                          | Rủi ro CSP chặn `PUT` trực tiếp lên Supabase Storage bị bác bỏ: `connect-src` đã khai báo `https://*.supabase.co`, và `createSignedUploadUrl` trả đúng `{ signedUrl, token, path }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7   | RISK_DISMISSED | [MINOR] | `src/app/features/image-gen/components/TemplateModal.tsx:42`                   | `[SRC]` `TemplateModal.tsx:42`, `[SRC]` `src/lib/features/files/uploadPresentation.ts:13-14,34-40`                                       | Rủi ro hồi quy giới hạn 10 MB của `TemplateModal` và OOM preview ảnh > 15 MB bị bác bỏ: `TemplateModal` gọi `validateReferenceImages([file], 0, 1)` dùng `DEFAULT_REF_IMAGE_MAX_BYTES = 10 MB`, còn `readImagePreviewDataUrl` trả `undefined` cho ảnh > 15 MB và `ControlPanelReferenceImages.tsx:203-213` đã có fallback `<ImageIcon />`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                      | Kết quả | Bằng chứng                                                                                                                 | Chi tiết                                                                                                                                                                              |
| ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7/7 headings)         | FAIL    | `[CMD]` `node scripts/verify-plan.mjs` exit 1                                                                              | Đủ 7/7 heading nhưng thất bại 3 `MISSING_FILE` do đường dẫn rút gọn.                                                                                                                  |
| Skills Loaded & Applied                  | PASS    | `[SRC]` `.agents/skills/api-patterns/SKILL.md`, `.agents/skills/add-translation/SKILL.md`, `.agents/rules/04-bilingual.md` | Đã ánh xạ đúng `api-patterns`, `add-translation`, `04-bilingual`, `01-coding`.                                                                                                        |
| S1: Cold-start & Build                   | PASS    | `[CMD]` `npm run type-check` exit 0; `[CMD]` `npx vitest run ...` 5 files / 74 tests passed; `[SRC]` `package.json`        | Baseline type-check & test suite liên quan đều xanh; không thêm dependency mới hay biến môi trường mới.                                                                               |
| S2: Runner Lifecycle & Teardown          | FAIL    | `[SRC]` `src/app/api/generate-image/route.ts:121-154`, `[SRC]` `useImageStudioActions.ts:133-176`                          | Thiếu cleanup `validatedRefPaths` nếu bị chặn ở `batchSize`/quota (dòng 125–149); batch `numberOfImages > 1` có mâu thuẫn vị trí upload/cleanup giữa Design Sketch A và Mục 3/10.     |
| S3: Database & Temporal Logic            | N/A     | Không thay đổi schema DB hay tạo SQL migration mới                                                                         | Chỉ strip `referenceImagePaths`/`resolvedReferenceImages` khỏi JSONB `saveMessage` và tái sử dụng bucket `"attachments"`.                                                             |
| S4: Cross-Task State Flow                | FAIL    | `[SRC]` `useImageStudioActions.ts:133-176`, `[SRC]` `ControlPanelReferenceImages.tsx:179`                                  | Mâu thuẫn luồng `sendOne()` khi `numberOfImages > 1` (4× `toast.error` / mất `batchError`) và lệch MIME whitelist giữa UI (`image/*`) và API (`png/jpeg/webp/gif`).                   |
| S5: Security Boundary & 3-Tier Auth      | PASS    | `[SRC]` `src/app/api/generate-image/route.ts:66-118`, `[SRC]` `src/lib/features/chat/storageCleanup.ts:10-52`              | Đầy đủ Auth, Rate Limit, Ownership (`assertConversationOwner`), Gatekeeper fail-closed (503/403), prefix `${userId}/${conversationId}/ref-`, magic bytes, Negative Probes NP-1..NP-3. |
| S6: External Resilience & Serverless Cap | PASS    | `[SRC]` `src/app/api/generate-image/route.ts:61`, `[SRC]` `src/lib/features/files/geminiFiles.server.ts:43-49`             | Route giữ `maxDuration = 300`, tách ngưỡng 15 MB sang Gemini Files API dùng đúng instance `ai` của request (an toàn BYOK) và dọn trong `finally`.                                     |
| Domain: Bilingual & Test Contract        | FAIL    | `[SRC]` `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx:88-101`                                | Song ngữ đạt (2 khóa `vi.ts`/`en.ts` qua `t()`), nhưng Test Contract thiếu TC cho batch `numberOfImages > 1` dù Mục 10 viện dẫn.                                                      |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 — Đồng thời (Batch `numberOfImages = 4` với 4 ảnh tham chiếu)**:
  - Cơ chế: `useImageStudioActions.handleGenerate` (`Promise.allSettled`) + `consumeRateLimit("image-gen-ref-upload:${userId}")`
  - T1: User bấm Generate với `numberOfImages = 4`, 4 ảnh tham chiếu (40 MB/ảnh) → nếu mỗi `sendOne()` upload riêng, phát sinh 16 request sign URL song song (tốn 16/20 rate limit window 60s) + 640 MB upload.
  - T2: Nếu 1 request upload lỗi (413/429) và `catch` nằm trong `sendOne()` như Design Sketch A → cả 4 nhánh cùng gọi `toast.error` và `return` (không throw).
  - T3: `Promise.allSettled` thấy 4 `fulfilled` (`undefined`), `resolveBatchFailureReason` trả `null`, 4 toast trùng lặp bật cùng lúc, các file đã upload thành công trước khi lỗi bị bỏ mồ côi trên Storage.
  - Kết cục: UX lỗi & rò rỉ file tạm / cạn rate limit → **Lỗi (`[MAJOR]`)**.
- **Trục 2 — Khoảng trống check→use (TOCTOU — Spoofed size/MIME & IDOR)**:
  - Cơ chế: `POST /api/generate-image/reference-upload-url` → `PUT` Supabase Storage → `POST /api/generate-image`
  - T1: Attacker khai báo `sizeBytes: 1024`, `mimeType: "image/png"` để lấy Signed Upload URL hợp lệ.
  - T2: Attacker `PUT` file 100 MB (nếu bucket limit chưa siết) hoặc file HTML giả danh `.png`, hoặc gửi `referenceImagePaths` trỏ sang file của nạn nhân.
  - T3: `validateReferenceImagePaths` chặn IDOR trước khi chạm Storage (không xóa file nạn nhân). Tuy nhiên, nếu `downloadReferenceImagesFromStorage` gọi `blob.arrayBuffer()` trước khi check `blob.size <= 40 MB`, có thể gây đỉnh RAM/OOM trước khi ném `ValidationError`.
  - Kết cục: IDOR an toàn; TOCTOU size cần chốt check `blob.size` trước `arrayBuffer()` → **Lỗi (`[MAJOR]` gộp Finding #3)**.
- **Trục 3 — Thất bại giữa chừng & thất bại của bước dọn dẹp**:
  - Cơ chế: `POST /api/generate-image` (`batchSize`/quota reject hoặc provider throw) + `GeminiNativeImageProvider` (`ai.files.delete`)
  - T1: Client upload thành công 2 ảnh tạm lên `"attachments"` rồi gọi `POST /api/generate-image` với `batchSize = 4` (vượt rank `basic`).
  - T2: Route chạy `validateReferenceImagePaths` thành công, sau đó `effectiveBatchSize > maxBatchSize` ném `403 BATCH_SIZE_EXCEEDS_RANK` trước khối `try` ở dòng 154.
  - T3: Khối `finally` ở dòng 154 không chạy → 2 file tạm nằm vĩnh viễn trên bucket `"attachments"` vì `cron/cleanup` chỉ dọn bảng `files`.
  - Kết cục: Rò rỉ storage object trên nhánh fail-early → **Lỗi (`[MAJOR]` Finding #3)**.
- **Trục 4 — Môi trường serverless**:
  - Cơ chế: Vercel Serverless (`maxDuration = 300`) + Upstash Redis rate limit fallback in-memory.
  - T1: Không có state in-memory phụ thuộc giữa `reference-upload-url` và `generate-image` (mọi trạng thái đi qua `storagePath` + Supabase Storage).
  - T2: Upstash Redis fallback về in-memory (`rateLimit.ts:165,199`) vẫn an toàn ở mức best-effort theo quy ước hiện hành của dự án.
  - Kết cục: Kiến trúc stateless phù hợp serverless → **An toàn**.

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-reference-images-40mb-direct-upload.md` (exit 1 — 3 `MISSING_FILE`)
  2. `npm run type-check` (exit 0)
  3. `npx vitest run src/app/api/generate-image/route.test.ts src/lib/features/image-gen/studioHelpers.test.ts src/app/features/image-gen/components/hooks/useImageStudioActions.test.ts src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx src/lib/features/files/uploadPresentation.test.ts --reporter=dot` (exit 0 — 5 files, 74 tests passed)

#### 4. Kết Luận

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh: `node scripts/verify-plan.mjs docs/plans/2026-11-22-reference-images-40mb-direct-upload.md` → **Exit code 0 (`VERIFY_PLAN: PASS — 0 failures, 0 warnings`)**:
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ 22 tham chiếu `LINE_REF` đều `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `[PASS] CRITIC_FLOOR 7 findings with valid file:line`

| Lỗi cũ (Audit Run 1)                                                                           |    Mức    | Trạng thái | Bằng chứng xác minh                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | :-------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 — 3 `MISSING_FILE` shorthand path trong `verify-plan.mjs`                                   | `[MAJOR]` |  `ĐÃ SỬA`  | `[CMD]` `node scripts/verify-plan.mjs ...` exit 0 (0 failures, 0 warnings)                                                                                                                                                                                                                  |
| #2 — Mâu thuẫn batch `numberOfImages > 1`, duplicate toast, rate-limit burst & thiếu TC        | `[MAJOR]` |  `ĐÃ SỬA`  | `[SRC]` `src/lib/core/rateLimit.ts:11-12`, `[SRC]` `src/lib/features/image-gen/studioHelpers.ts:244-256` (batch sign-URL 1 request/1..4 ảnh; `ReferenceImageUploadError` giữ nguyên qua `resolveBatchFailureReason` về outer `catch` đúng 1 toast; bổ sung TC-REF-11, WP-1, NP-4)           |
| #3 — Sót cleanup Storage khi từ chối `batchSize`/quota & thiếu OOM guard trước `arrayBuffer()` | `[MAJOR]` |  `ĐÃ SỬA`  | `[SRC]` `src/app/api/generate-image/route.ts:101-154,260` (`try/finally` bao từ ngay sau `validateReferenceImagePaths`; check `blob.size` trước `blob.arrayBuffer()` kèm TC-REF-05, TC-REF-08(c), NP-3)                                                                                     |
| #4 — Lệch whitelist MIME giữa Client (`image/*`) và Server (`png/jpeg/webp/gif`)               | `[MAJOR]` |  `ĐÃ SỬA`  | `[SRC]` `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:179`, `[SRC]` `src/lib/features/files/uploadPresentation.ts:254-283` (đồng bộ `accept` + `STUDIO_REF_ALLOWED_MIME_TYPES` + `allowedMimeTypes?` giữ backward-compat `TemplateModal.tsx`; kèm TC-REF-09, NP-5) |
| #5 — Giới hạn diff trong `route.ts` (442 dòng)                                                 | `[MINOR]` |  `ĐÃ SỬA`  | `[SRC]` `src/app/api/generate-image/route.ts:442` (ràng buộc giữ diff `<= 25` dòng)                                                                                                                                                                                                         |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                           | Bằng chứng                                                     | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | ------- | ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/lib/features/files/uploadPresentation.ts:267`    | `[SRC]` `src/lib/features/files/uploadPresentation.ts:266-270` | Khi thêm `allowedMimeTypes` vào `validateReferenceImages`, nên so khớp `file.type.toLowerCase()` (tránh trường hợp browser/OS trả MIME viết hoa) và giữ chặn an toàn khi `file.type === ""`. Không chặn phê duyệt.                                                                                                                                                                                                           |
| 2   | RISK_DISMISSED | [MINOR] | `src/lib/features/image-gen/studioHelpers.ts:244-256` | `[SRC]` `src/lib/features/image-gen/studioHelpers.ts:250-255`  | Rủi ro hồi quy mất kiểu `ReferenceImageUploadError` khi đi qua `resolveBatchFailureReason` trong batch `Promise.allSettled` bị bác bỏ: `resolveBatchFailureReason` trả trực tiếp `reason` khi `reason instanceof Error`, bảo toàn nguyên vẹn `ReferenceImageUploadError` cho nhánh `instanceof` tại outer `catch`.                                                                                                           |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/api/generate-image/route.ts:100-154`         | `[SRC]` `src/app/api/generate-image/route.ts:100-154`          | Rủi ro `validateReferenceImagePaths` chạy trước `getUserProfile` gây bypass gatekeeper bị bác bỏ: `validateReferenceImagePaths` chỉ kiểm tra chuỗi thuần túy (không I/O, không tiết lộ dữ liệu); nếu path thuộc user khác thì ném 403 trước `try/finally` (0 xóa file nạn nhân); nếu path hợp lệ của chính user bị blocked/not_whitelisted thì `getUserProfile` vẫn ném 403/503 và `finally` dọn file tạm của chính user đó. |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                      | Kết quả | Bằng chứng                                                                                                                                                                                         | Chi tiết                                                                                                                                                                                                      |
| ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7/7 headings)         | PASS    | `[CMD]` `node scripts/verify-plan.mjs` exit 0                                                                                                                                                      | Đủ 7/7 heading, 22/22 `LINE_REF` hợp lệ, 0 failures / 0 warnings.                                                                                                                                             |
| Skills Loaded & Applied                  | PASS    | `[SRC]` `.agents/skills/api-patterns/SKILL.md`, `.agents/skills/add-translation/SKILL.md`, `.agents/rules/04-bilingual.md`                                                                         | Ánh xạ đủ skill và quy tắc song ngữ / coding invariants.                                                                                                                                                      |
| S1: Cold-start & Build                   | PASS    | `[CMD]` `npm run type-check` exit 0; `[CMD]` `npx vitest run ...` 5 files / 74 tests passed                                                                                                        | Baseline type-check và test suite liên quan xanh; không thêm package hay biến môi trường mới.                                                                                                                 |
| S2: Runner Lifecycle & Teardown          | PASS    | `[SRC]` `src/app/api/generate-image/route.ts:101-154`, `[SRC]` `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:133-176`                                                      | `finally` tại `route.ts` bao trọn từ sau `validateReferenceImagePaths` (dọn cả khi reject `batchSize`/quota/gatekeeper hoặc lỗi provider); `GeminiNativeImageProvider` dọn `ai.files.delete` trong `finally`. |
| S3: Database & Temporal Logic            | N/A     | Không thay đổi schema DB hay SQL migration                                                                                                                                                         | Chỉ strip payload tham chiếu khỏi JSONB `saveMessage` và tái sử dụng bucket `"attachments"`.                                                                                                                  |
| S4: Cross-Task State Flow                | PASS    | `[SRC]` `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:133-198`, `[SRC]` `src/lib/features/image-gen/studioHelpers.ts:244-256`                                              | Thống nhất `sendOne()` + `ReferenceImageUploadError` cho cả single và batch (`Promise.allSettled`), khử trùng lặp toast, đồng bộ MIME whitelist giữa UI và API.                                               |
| S5: Security Boundary & 3-Tier Auth      | PASS    | `[SRC]` `src/app/api/generate-image/route.ts:66-118`, `[SRC]` `src/lib/features/chat/storageCleanup.ts:10-52`                                                                                      | Auth, Rate Limit (batch 1 request = 1 lượt), Ownership, Gatekeeper fail-closed (503/403), IDOR/Path Traversal guard, OOM guard trước `arrayBuffer()`, magic bytes, Negative Probes NP-1..NP-5.                |
| S6: External Resilience & Serverless Cap | PASS    | `[SRC]` `src/app/api/generate-image/route.ts:61`, `[SRC]` `src/lib/features/files/geminiFiles.server.ts:43-49`, `[SRC]` `node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts:344-350` | `maxDuration = 300`, ngưỡng 15 MB sang Gemini Files API dùng đúng instance `ai` của request (an toàn BYOK), dọn dẹp fail-safe.                                                                                |
| Domain: Bilingual & Test Contract        | PASS    | `[SRC]` `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx:88-101`                                                                                                        | Đủ 2 khóa song ngữ `vi.ts`/`en.ts` qua `t()`, 11 Test Cases (TC-REF-01..11), 3 Wiring Probes, 5 Negative Probes khớp toàn bộ Risk Table.                                                                      |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 — Đồng thời (Batch `numberOfImages = 4` với 4 ảnh tham chiếu)**:
  - Cơ chế: `useImageStudioActions.handleGenerate` (`Promise.allSettled`) + `POST /api/generate-image/reference-upload-url` (batch `files: 1..4`)
  - T1: 4 `sendOne()` chạy song song → mỗi nhánh gọi 1 request sign-URL (tổng 4/20 lượt rate limit window 60s) và nhận bộ `ref-<uuid>` riêng biệt.
  - T2: Nhánh #1 xong trước chạy `finally cleanupTempReferenceImages` chỉ xóa đúng `ref-<uuid>` của nhánh #1; nhánh #2..#4 vẫn tải bình thường. Nếu cả 4 nhánh upload đều fail → đều throw `ReferenceImageUploadError`.
  - T3: `Promise.allSettled` + `resolveBatchFailureReason` trả `ReferenceImageUploadError` về outer `catch` → gọi `toast.error(t("studioRefUploadFailed"))` đúng 1 lần.
  - Kết cục: Không race condition cleanup, không vượt rate limit, không spam toast → **An toàn**.
- **Trục 2 — Khoảng trống check→use (TOCTOU — Spoofed size/MIME & IDOR)**:
  - Cơ chế: `validateReferenceImagePaths` + `downloadReferenceImagesFromStorage`
  - T1: Attacker khai báo `sizeBytes: 1024` nhưng `PUT` file 100 MB hoặc file HTML giả `.png`, hoặc truyền path của nạn nhân.
  - T2: `validateReferenceImagePaths` chặn path của nạn nhân bằng `ForbiddenError` trước `try/finally` (không xóa file nạn nhân). Với file 100 MB của chính attacker, `downloadReferenceImagesFromStorage` kiểm tra `blob.size <= 40 MB` trước `await blob.arrayBuffer()` và ném `ValidationError`.
  - T3: `finally` xóa file tạm rác của attacker trên Storage.
  - Kết cục: Chặn IDOR, chặn OOM và dọn rác → **An toàn**.
- **Trục 3 — Thất bại giữa chừng & thất bại của bước dọn dẹp**:
  - Cơ chế: `try/finally` bao từ sau `validateReferenceImagePaths` trong `route.ts` + `finally` trong `GeminiNativeImageProvider.ts`
  - T1: Request bị chặn 403 `BATCH_SIZE_EXCEEDS_RANK`, 403 quota, 503 profile null, hoặc provider throw lỗi.
  - T2: `finally` luôn chạy `cleanupTempReferenceImages` (Storage) và `ai.files.delete` (Gemini Files) với `Promise.allSettled` + log warning không che khuất lỗi gốc.
  - T3: `claim.rollback()` vẫn chạy khi lỗi sau bước quota claim.
  - Kết cục: Không rò rỉ file tạm trên các nhánh fail sớm hay fail giữa chừng → **An toàn**.
- **Trục 4 — Môi trường serverless**:
  - Cơ chế: Vercel Serverless (`maxDuration = 300`) + Upstash Redis rate limit fallback in-memory.
  - T1–T3: Toàn bộ luồng upload → generate hoàn toàn stateless qua `storagePath` trên Supabase Storage; không giữ state in-memory giữa các request.
  - Kết cục: Tương thích serverless → **An toàn**.

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-reference-images-40mb-direct-upload.md` (exit 0 — `VERIFY_PLAN: PASS`, 0 failures, 0 warnings, `CRITIC_REQUIRED no`)
  2. Kế thừa kết quả baseline không đổi codebase từ Audit Run 1: `npm run type-check` (exit 0), `npx vitest run ...` (exit 0 — 5 files, 74 tests passed).

#### 4. Kết Luận

[PLAN_APPROVED]

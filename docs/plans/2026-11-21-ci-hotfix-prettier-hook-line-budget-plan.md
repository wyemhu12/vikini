# CI Hotfix Plan — Prettier/`lint-staged` Hook Line-Budget Regression (`TC-13`)

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Status**: Completed
- **Revision**: 1
- **CRITIC_REQUIRED**: no

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục tiêu (Goal)

Khắc phục triệt để lỗi CI trên commit `adcb4b6` tại `TC-13` (`src/lib/config/theme-config.test.ts:437-460`) khiến `npm run test:run` thất bại (`src/app/features/chat/components/hooks/useChatStreamExecution.ts` đạt `355` dòng > `MAX_HOOK_LINES = 350` tại `src/lib/config/theme-config.test.ts:518`), đồng thời gia cố biên an toàn cho hook lân cận dễ vỡ `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` (đang ở `345/350` dòng — chỉ còn dư `5` dòng):

1. **Nguyên nhân gốc đã xác nhận**: Trong Phase 6, `src/app/features/chat/components/hooks/useChatStreamExecution.ts` từng được nén thủ công xuống `318` dòng bằng cách xếp nhiều phần tử trên cùng một dòng trong dependency arrays của `useCallback` mà không chạy Prettier. Khi commit `adcb4b6`, Husky (`.husky/pre-commit`) chạy `lint-staged` (`package.json:131-135`: `eslint --fix` → `prettier --write` với `printWidth: 100` tại `.prettierrc`), tự động bung các dependency arrays thành 1 phần tử/dòng (+37 dòng → `355` dòng). Hook lân cận `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` cũng bị bung lên `345` dòng.
2. **Giải pháp kiến trúc bền vững**: Tách logic thuần/async không phụ thuộc React ra khỏi 2 hook về đúng lớp domain (`src/lib/features/chat/streamProtocol.ts` và `src/lib/features/image-gen/studioHelpers.ts`), bổ sung unit test co-located đầy đủ (`*.test.ts`), loại bỏ mã lặp nội bộ (`clearStreamBuffers`, hợp nhất nhánh hậu xử lý `successCount > 0`), và khóa **đầu ra sau `npx prettier --check`** ở mức:
   - `src/app/features/chat/components/hooks/useChatStreamExecution.ts`: **`<= 305` dòng** (dự kiến `~287` dòng, dư `>= 60` dòng dưới `350`).
   - `src/app/features/image-gen/components/hooks/useImageStudioActions.ts`: **`<= 320` dòng** (dự kiến `~314` dòng, dư `>= 36` dòng dưới `350`).
   - Bảo toàn **100%** public signature (`UseChatStreamExecutionParams`, `UseImageStudioActionsParams`) và return shape của cả hai hook.
3. **Ghi nhận bài học `/post-fix`**: Cập nhật `docs/lessons-learned.md` và `docs/CHANGELOG.md` theo đúng giao thức `.agents/skills/vikini-debug/SKILL.md:62-93`.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** thay đổi `MAX_HOOK_LINES = 350` hoặc nới lỏng bất kỳ kiểm tra nào trong `src/lib/config/theme-config.test.ts` (cấm hạ chuẩn test theo `.agents/rules/02-quality.md:62-64`).
- **KHÔNG** chỉnh sửa file kế hoạch khác (`docs/plans/2026-11-21-code-audit-wave-2b-frontend-perf-hooks-ui-plan.md`) hay bất kỳ file hook/component nào ngoài danh sách 8 file khai báo tại Mục 5.
- **KHÔNG** chỉnh sửa `.agents/rules/**`, `.prettierrc`, `package.json`, hay `.husky/pre-commit` trong hotfix này (giữ phạm vi tối giản, `CRITIC_REQUIRED: no`; việc thăng cấp luật phòng ngừa Prettier/`lint-staged` lần thứ 4 lên `.agents/rules/` được ghi chú trong `docs/lessons-learned.md` để xử lý riêng ở PR governance nếu cần).
- **KHÔNG** thay đổi giao diện UI, CSS, bản dịch song ngữ (`vi.ts`/`en.ts`), API route (`/api/chat-stream`, `/api/generate-image`, `/api/batch-gen-quota`), hay hành vi runtime của Chat / Image Studio.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

| Tài liệu / `SKILL.md` đã đọc bằng `read_file`           | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp trong kế hoạch                                                                                                                                                                                                                                                                            |
| :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/02-quality.md:8-25,41-52,77-80`          | Áp dụng Pre-Work Protocol theo domain (Streaming, Image Studio, Debugging, Blast-Radius, Audit), lệnh PowerShell 5.1 dùng `;` (cấm `&&`), cấm hạ chuẩn `TC-13`, bắt buộc `/post-fix` & `npm run verify`.                                                                                                                               |
| `.agents/rules/01-coding.md:19,64-70,100-106`           | Tuân thủ giới hạn Hard Max `350` dòng cho Custom Hook và `400` dòng cho `src/lib/` (`streamProtocol.ts` dự kiến `~302` dòng, `studioHelpers.ts` dự kiến `~235` dòng); cấm tuyệt đối `any` (dùng `unknown` narrowing); bắt buộc co-located tests (`*.test.ts`) phủ happy path + error path cho mọi hàm mới xuất từ `src/lib/features/`. |
| `.agents/skills/streaming-patterns/SKILL.md:80-102`     | Bảo toàn 100% hợp đồng SSE client (`AbortController` hủy request cũ trước khi tạo request mới, giữ nguyên `credentials: "same-origin"`, flush typewriter buffer `stopTypewriter(true)` và trễ `30ms` + kiểm tra `isUnmountedRef` trước `finalizeAssistantMessage`).                                                                    |
| `.agents/skills/vikini-debug/SKILL.md:62-93`            | Áp dụng đủ 5 bước `/post-fix`: `npm run verify` → ghi entry chuẩn (`Symptom`, `Root Cause`, `Fix`, `Prevention Rule`) vào `docs/lessons-learned.md` (ghi nhận chuỗi 4 sự cố Prettier/`lint-staged`) → cập nhật `docs/CHANGELOG.md` → xác nhận câu chốt bài học.                                                                        |
| `.agents/skills/vikini-investigate/SKILL.md:78-111`     | Thực hiện Mode 4 `/blast-radius` cho cả 4 module (`streamProtocol.ts`, `useChatStreamExecution.ts`, `studioHelpers.ts`, `useImageStudioActions.ts`) để xác nhận toàn bộ thay đổi ở `src/lib/features/` là additive 100% và mọi caller tầng 1–2 tương thích ngược hoàn toàn.                                                            |
| `.agents/skills/vikini-audit/SKILL.md:14-56`            | Xác minh 0 `any`, 0 `console.log`, giữ nguyên `toast.error()` + `logger.error()` trên mọi nhánh lỗi hành động người dùng, và chạy `npm run verify`.                                                                                                                                                                                    |
| `docs/contracts.md:282-300`, `docs/features.md:161-190` | Đối chiếu payload `ChatStreamRequest` và luồng Image Studio (`/api/generate-image`, `/api/batch-gen-quota`) để không làm sai lệch bất kỳ trường wire contract nào khi trích xuất `requestChatStream`, `requestImageVariation`, `fetchStudioBatchQuota`.                                                                                |
| `docs/lessons-learned.md:748-765,804-817`               | Rà soát 3 tiền lệ Prettier/`lint-staged` trước đây (`2026-10-24`, `2026-10-27`, `2026-11-03`) và áp dụng ngay chốt chặn `npx prettier --check` TRƯỚC khi chạy Vitest `TC-13`.                                                                                                                                                          |

---

### 3. Assumptions & Cross-Task Dependencies (kèm Blast-Radius Analysis)

#### Assumptions (Giả định có bằng chứng `[SRC]`)

1. **Quy tắc đếm dòng của `TC-13`**: `countFileLines` tại `src/lib/config/theme-config.test.ts:521-524` loại bỏ đúng 1 ký tự `\n` cuối file rồi đếm `split("\n").length`, áp dụng cho mọi file khớp `/^use[A-Z].*\.(ts|tsx)$/` (không phải `*.test.*`/`*.spec.*`) trong `src/app/` với trần cứng `MAX_HOOK_LINES = 350` (`src/lib/config/theme-config.test.ts:453-460,518`).
2. **Prettier & Husky pre-commit**: `.husky/pre-commit` gọi `npx lint-staged`; `package.json:131-135` chạy `eslint --fix` và `prettier --write` cho `*.{ts,tsx,js,jsx}` theo `.prettierrc` (`printWidth: 100`, `trailingComma: "es5"`, `semi: true`, `singleQuote: false`, `endOfLine: "lf"`). Vì vậy, mọi giới hạn dòng (`<= 305`, `<= 320`) chỉ có giá trị nếu đạt **sau khi** `npx prettier --check` thoát mã `0`.
3. **Tính tương thích cấu trúc Ref trong React 19**: Tại `node_modules/@types/react/index.d.ts:153-158`, `RefObject<T>` định nghĩa `{ current: T }` (mutable trong React 19), và `MutableRefObject<T>` cũng là `{ current: T }`. Do đó `MutableRefBox<T> = { current: T }` trong `src/lib/features/chat/streamProtocol.ts` (không import React) tương thích cấu trúc 2 chiều 100% với `MutableRefObject<T>` và `RefObject<T>`, giúp `UseChatStreamExecutionParams extends StreamExecutionRefs` giữ nguyên 100% chữ ký công khai.
4. **Môi trường test Vitest**: `vitest.config.ts:8` dùng `environment: "happy-dom"`, hỗ trợ `Response`, `Blob`, `FileReader`, `AbortController`, `localStorage`, và `src/lib/features/image-gen/studioHelpers.test.ts:111-114` dọn sạch global stub qua `vi.unstubAllGlobals()` trong `afterEach`.
5. **Ranh giới `lib/features/` → `app/`**: `src/lib/features/image-gen/studioHelpers.ts:1` hiện đã dùng `import type` (erased at compile time, 0 runtime import) đối với `GeneratedImage` từ `Canvas.tsx`; dùng tương tự `import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel"` (`src/app/features/image-gen/components/ControlPanel.tsx:23-27`) không tạo phụ thuộc runtime hay vòng lặp ES module. `src/lib/features/chat/streamProtocol.ts` giữ **0** import từ `app/` và **0** import từ `react`.

#### Cross-Task Dependencies

- Độc lập hoàn toàn với Wave 2B (`docs/plans/2026-11-21-code-audit-wave-2b-frontend-perf-hooks-ui-plan.md`); không đụng chạm hay xung đột kế hoạch đó.
- Phụ thuộc vào các test hiện hành `src/app/features/chat/components/hooks/useChatStreamController.test.ts:446-511` (toàn bộ 9 test tích hợp gồm `CT-6C-01 (#10)`) và `src/lib/config/theme-config.test.ts:437-480` (`TC-13`).

#### Blast-Radius Analysis (`/blast-radius` Mode 4)

| Caller / Consumer                 | `file:line`                                                                     | Tầng | Cách tham chiếu                       | Usage Pattern                                                                                                                                               | Compatible?                                                                                       |
| :-------------------------------- | :------------------------------------------------------------------------------ | :--: | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `useChatStreamController`         | `src/app/features/chat/components/hooks/useChatStreamController.ts:16,186-225`  |  1   | `static import`                       | Gọi `useChatStreamExecution({ ... })`, dùng `.cancelStream`, `.coreSend`, `.handleSend`, `.handleStop`                                                      | **Yes** — `UseChatStreamExecutionParams` & return shape giữ nguyên 100%                           |
| `useChatStreamController`         | `src/app/features/chat/components/hooks/useChatStreamController.ts:6-10`        |  1   | `static import`                       | Dùng `normalizeFrontendMessages`, `ChatFrontendMessage`, `StreamError` từ `streamProtocol.ts`                                                               | **Yes** — export cũ không đổi                                                                     |
| `useChatPartialPersistence`       | `src/app/features/chat/components/hooks/useChatPartialPersistence.ts:8-12`      |  1   | `static import`                       | Dùng `normalizeFrontendMessages`, `safeArray`, `ChatFrontendMessage`                                                                                        | **Yes** — export cũ không đổi                                                                     |
| `useChatStreamReader`             | `src/app/features/chat/components/hooks/useChatStreamReader.ts:5-10`            |  1   | `static import`                       | Dùng `parseSSEEvent`, `safeArray`, `ParsedSSEEvent`, `StreamError`                                                                                          | **Yes** — export cũ không đổi                                                                     |
| `useChatMessageActions`           | `src/app/features/chat/components/hooks/useChatMessageActions.ts:11-16`         |  1   | `static import`                       | Dùng `findMessageIndex`, `normalizeFrontendMessages`, `ChatFrontendMessage`, `CoreSendOptions`                                                              | **Yes** — export cũ không đổi                                                                     |
| `useChatStreamController.test.ts` | `src/app/features/chat/components/hooks/useChatStreamController.test.ts:3,7-8`  |  2   | `static import` + `global.fetch` mock | Kiểm thử tích hợp toàn bộ luồng `useChatStreamController` → `useChatStreamExecution` (gồm mock `res = { ok: true, body: { getReader } }` không có `cancel`) | **Yes** — `requestChatStream` dùng đúng `fetch("/api/chat-stream", ...)` & `res.body.getReader()` |
| `useImageGenStudio`               | `src/app/features/image-gen/components/hooks/useImageGenStudio.ts:12-17,92-125` |  1   | `static import`                       | Gọi `useImageStudioActions({ ... })` và `mapMessagesToGeneratedImages` từ `studioHelpers.ts`                                                                | **Yes** — `UseImageStudioActionsParams` & return shape giữ nguyên 100%                            |

- **Co-Located Tests Affected**:
  - `src/lib/features/chat/streamProtocol.test.ts` (cập nhật bổ sung test cho `resetStreamExecutionRefs` & `requestChatStream`)
  - `src/lib/features/image-gen/studioHelpers.test.ts` (cập nhật bổ sung test cho `convertReferenceImagesToBase64`, `resolveBatchFailureReason`, `requestImageVariation`, `fetchStudioBatchQuota`)
  - `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (chạy hồi quy nguyên vẹn, không sửa)
  - `src/lib/config/theme-config.test.ts` (chạy hồi quy `TC-13`, không sửa)

---

### 4. Bảng Verified Versions

| Thư viện / Công cụ                     | Phiên bản trong repo (`[SRC]`)                | Xác minh 2026 & Ghi chú tương thích (`[URL]` / `[SRC]`)                                                                                                                                                                                                   |
| :------------------------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prettier`                             | `^3.7.4` (`package.json:112`)                 | Prettier 3.7/3.8 giữ nguyên ngữ nghĩa `printWidth` (`.prettierrc` = `100`, `trailingComma: "es5"`); bung array/import vượt `100` ký tự thành 1 mục/dòng ([Prettier Options](https://prettier.io/docs/options#print-width) `[URL]`).                       |
| `vitest`                               | `^4.1.12` (`package.json:118`)                | Vitest 4.1.x với `@vitest/coverage-v8` đồng bộ phiên bản (`package.json:97`), chạy `happy-dom` `^20.0.11` (`vitest.config.ts:8`, `package.json:107`) ([Vitest Coverage Guide](https://vitest.dev/guide/coverage) `[URL]`).                                |
| `react` / `react-dom`                  | `^19.2.3` (`package.json:69-70`)              | React 19 hợp nhất `RefObject<T>` có `.current` mutable (`node_modules/@types/react/index.d.ts:153-158` `[SRC]`), tương thích hoàn toàn với `{ current: T }` ([React 19 Upgrade Guide](https://react.dev/blog/2024/12/05/react-19-upgrade-guide) `[URL]`). |
| `next`                                 | `^16.4.0` (`package.json:64`)                 | Next.js 16 App Router; giữ `"use client"` trên cả 2 custom hooks (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:1`, `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:1`).                                        |
| `typescript`                           | `^5.9.3` (`package.json:116`)                 | `strict: true`, `noEmit: true` (`tsconfig.json:7-8` `[SRC]`).                                                                                                                                                                                             |
| `eslint` + `eslint-plugin-react-hooks` | `^9.39.2` / `^7.0.1` (`package.json:102,105`) | Cưỡng chế `"react-hooks/rules-of-hooks": "error"`, `"react-hooks/exhaustive-deps": "error"`, `"@typescript-eslint/no-explicit-any": "error"` (`eslint.config.mjs:32-33,71` `[SRC]`).                                                                      |
| `husky` + `lint-staged`                | `^9.1.7` / `^16.2.7` (`package.json:108,110`) | Pre-commit chạy `npx lint-staged` (`.husky/pre-commit`) → `eslint --fix` & `prettier --write` (`package.json:131-135` `[SRC]`).                                                                                                                           |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

Phạm vi **CHỈ** gồm đúng 8 tệp chỉnh sửa sau (không tạo mới, không xóa tệp):

- `[MODIFY]` `src/lib/features/chat/streamProtocol.ts` — Thêm `MutableRefBox<T>`, `StreamExecutionRefs`, `resetStreamExecutionRefs`, `ChatStreamRequestParams`, `ChatStreamFetchResult`, `requestChatStream` (hiện `232` dòng → dự kiến `~302` dòng, `<= 400` dòng).
- `[MODIFY]` `src/lib/features/chat/streamProtocol.test.ts` — Thêm unit test co-located phủ đầy đủ happy path, edge cases và Negative Probes cho `resetStreamExecutionRefs` và `requestChatStream`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamExecution.ts` — Kế thừa `StreamExecutionRefs` trong `UseChatStreamExecutionParams`, dùng `resetStreamExecutionRefs`, `requestChatStream`, hợp nhất `clearStreamBuffers` và loại bỏ pass-through `prepareStreamRequest` trùng lặp để đạt **`<= 305` dòng** (dự kiến `~287` dòng) sau `npx prettier --check`.
- `[MODIFY]` `src/lib/features/image-gen/studioHelpers.ts` — Thêm `convertReferenceImagesToBase64`, `resolveBatchFailureReason`, `requestImageVariation`, `fetchStudioBatchQuota` (hiện `164` dòng → dự kiến `~235` dòng, `<= 400` dòng).
- `[MODIFY]` `src/lib/features/image-gen/studioHelpers.test.ts` — Thêm unit test co-located phủ đầy đủ happy path, error paths và Negative Probes cho cả 4 helper mới.
- `[MODIFY]` `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` — Sử dụng 4 helper từ `studioHelpers.ts`, hợp nhất khối hậu xử lý `if (successCount > 0)` dùng chung giữa nhánh batch/đơn lẻ và lược bỏ fallback trùng với `classifyStudioError` (`src/lib/features/image-gen/studioHelpers.ts:33`) để đạt **`<= 320` dòng** (dự kiến `~314` dòng) sau `npx prettier --check`.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi nhận bài học `/post-fix` về Prettier/`lint-staged` bung dòng dependency array gây vỡ `TC-13` (ghi chú chuỗi 4 sự cố Prettier/`lint-staged` để theo dõi thăng cấp rule ở PR governance riêng).
- `[MODIFY]` `docs/CHANGELOG.md` — Bổ sung mục hotfix mới nhất ở đầu file.

---

### 6. Caller-First Design Sketch

#### 6.1 Chat Stream Execution (`streamProtocol.ts` → `useChatStreamExecution.ts`)

**Chữ ký mới trong `src/lib/features/chat/streamProtocol.ts`** (thuần TypeScript, 0 import React):

```typescript
export interface MutableRefBox<T> {
  current: T;
}

export interface StreamExecutionRefs {
  abortControllerRef: MutableRefBox<AbortController | null>;
  currentClientMessageIdRef: MutableRefBox<string | null>;
  currentTruncateClientMessageIdRef: MutableRefBox<string | null>;
  localSourcesRef: MutableRefBox<unknown[]>;
  localRagSourcesRef: MutableRefBox<unknown[]>;
  localUrlContextRef: MutableRefBox<unknown[]>;
  hasStreamErrorRef: MutableRefBox<boolean>;
  lastStreamErrorRef: MutableRefBox<StreamError | null>;
  accumulatedAssistantRef: MutableRefBox<string>;
  accumulatedThinkingRef: MutableRefBox<string>;
  emptyAnswerReasonRef: MutableRefBox<"length" | "no_content" | null>;
}

export interface ChatStreamRequestParams {
  conversationId: string | null;
  content: string;
  clientMessageId: string | null;
  truncateMessageId?: string;
  truncateClientMessageId?: string;
  regenerate: boolean;
  skipSaveUserMessage?: boolean;
  thinkingLevel: string;
  strataSampling?: unknown;
  fileIds?: string[];
  signal: AbortSignal;
}

export type ChatStreamFetchResult =
  | { ok: true; reader: ReadableStreamDefaultReader<Uint8Array> }
  | { ok: false; error: StreamError };

export function resetStreamExecutionRefs(
  refs: StreamExecutionRefs,
  truncateClientMessageId?: string
): AbortSignal;

export async function requestChatStream(
  params: ChatStreamRequestParams
): Promise<ChatStreamFetchResult>;
```

- **`resetStreamExecutionRefs` hành vi** (thay thế `src/app/features/chat/components/hooks/useChatStreamExecution.ts:183-196`):
  1. Nếu `refs.abortControllerRef.current` khác `null`, gọi `.abort()`.
  2. Khởi tạo `new AbortController()`, gán vào `refs.abortControllerRef.current`.
  3. Gán `refs.currentClientMessageIdRef.current = generateClientMessageId()`, `refs.currentTruncateClientMessageIdRef.current = truncateClientMessageId || null`.
  4. Reset toàn bộ mảng/trạng thái: `localSourcesRef = []`, `localRagSourcesRef = []`, `localUrlContextRef = []`, `hasStreamErrorRef = false`, `lastStreamErrorRef = null`, `accumulatedAssistantRef = ""`, `accumulatedThinkingRef = ""`, `emptyAnswerReasonRef = null`.
  5. Trả về `controller.signal`.
- **`requestChatStream` hành vi** (thay thế `src/app/features/chat/components/hooks/useChatStreamExecution.ts:265-298`):
  1. Tách `const { signal, ...payloadParams } = params;` (không để `signal` lọt vào JSON body).
  2. Xây dựng payload bằng `buildChatStreamPayload(payloadParams)` (`src/lib/features/chat/streamProtocol.ts:164-188`).
  3. Gọi `fetch("/api/chat-stream", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload), signal })`.
  4. Nếu `!res.ok || !res.body` → trả `{ ok: false, error: await extractStreamHttpError(res) }`.
  5. Ngược lại → trả `{ ok: true, reader: res.body.getReader() }`.
  6. Nếu `fetch` ném lỗi (`AbortError` hoặc lỗi mạng), cho phép reject lan lên caller để `coreSend` xử lý đồng nhất như trước (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:311-316`).

**Call site trong `src/app/features/chat/components/hooks/useChatStreamExecution.ts`**:

- `export interface UseChatStreamExecutionParams extends StreamExecutionRefs { ... }` — kế thừa đúng 11 ref từ `StreamExecutionRefs`, giữ 100% tập trường và kiểu tương thích cấu trúc cho `src/app/features/chat/components/hooks/useChatStreamController.ts:186-225` (-11 dòng).
- Thêm `clearStreamBuffers = useCallback((assistantValue: string | null) => { ... }, [...])` gom 7 lệnh reset buffer UI dùng chung giữa `cancelStream(false)` (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:122-130`) và khởi tạo lượt gửi mới (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:200-206`).
- Trong `cancelStream`: gọi `abortControllerRef.current?.abort(); abortControllerRef.current = null;`, gộp `if (selectedConversationId) void reloadMessagesAfterStream(selectedConversationId);` vào nhánh `if (commitPartial)`, và gọi `clearStreamBuffers(null)` ở nhánh `else`.
- Gộp bước chuẩn bị của `prepareStreamRequest` (vốn là helper nội bộ không export, chỉ gọi 1 chỗ duy nhất tại `src/app/features/chat/components/hooks/useChatStreamExecution.ts:255` và tốn 23 dòng dependency array + 10 dòng pass-through `options`) vào đầu `coreSend` thông qua `resetStreamExecutionRefs(...)` + `clearStreamBuffers("")`, đồng thời gọi `requestChatStream(...)` và kiểm tra `if (isUnmountedRef.current) return;` ngay sau `await requestChatStream(...)`.
- Truyền trực tiếp `{ current: [] }, { current: [] }` cho `processStreamResponse` (vì 2 biến cục bộ tại `src/app/features/chat/components/hooks/useChatStreamExecution.ts:299-300` không bao giờ được đọc lại sau dòng `302`), rút gọn `handleStop` thành 1 dòng `useCallback(() => cancelStream(true), [cancelStream])`.
- **Dự toán dòng sau `prettier --write` (`printWidth: 100`)**: `~287` dòng (`<= 305` dòng, dư `18` dòng dưới mục tiêu và `63` dòng dưới trần `350`).

#### 6.2 Image Studio Actions (`studioHelpers.ts` → `useImageStudioActions.ts`)

**Chữ ký mới trong `src/lib/features/image-gen/studioHelpers.ts`**:

```typescript
import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel";

export async function convertReferenceImagesToBase64(
  files: readonly Blob[],
  onError?: (error: unknown) => void
): Promise<string[]>;

export function resolveBatchFailureReason(
  results: readonly PromiseSettledResult<unknown>[],
  successCount: number,
  fallbackMessage?: string
): Error | null;

export async function requestImageVariation(params: {
  imageUrl: string;
  originalPrompt: string;
  conversationId: string;
  model: string;
  aspectRatio: string;
}): Promise<{ success?: boolean; [key: string]: unknown }>;

export async function fetchStudioBatchQuota(
  onError?: (error: unknown) => void
): Promise<BatchQuotaInfo | null>;
```

- **`convertReferenceImagesToBase64`** (thay thế `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:148-157`): Nếu `files.length === 0` trả `[]` ngay; lặp tuần tự `await fileToBase64(file)`, đẩy vào mảng; nếu lỗi, gọi `onError?.(error)` và trả về phần mảng đã mã hóa thành công (non-fatal, bảo toàn hành vi gốc).
- **`resolveBatchFailureReason`** (thay thế `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:197,202-207`): Nếu `successCount > 0` trả `null`. Tìm phần tử đầu tiên có `r.status === "rejected"`; nếu không có trả `null`. Nếu `reason instanceof Error` trả nguyên instance; nếu là chuỗi không rỗng trả `new Error(reason)`; ngược lại (kể cả `null`/`undefined`/object) trả `new Error(fallbackMessage)` (mặc định `"Generation failed"`) — tránh bẫy rejection mang giá trị falsy không bị `throw`.
- **`requestImageVariation`** (thay thế `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:279-295`): `fetch(params.imageUrl)` → kiểm tra `if (response.ok === false) throw new Error("Failed to fetch source image");` → `fileToBase64(await response.blob())` → `readStoredApiKey("vikini-gemini-key")` → chọn `variationModel` (`gemini-3` giữ nguyên, ngược lại `"gemini-3.1-flash-image"`) → gọi `postGenerateImageRequest(..., key, "Variation failed")`.
- **`fetchStudioBatchQuota`** (thay thế `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:98-107`): `fetch("/api/batch-gen-quota")` → nếu `!res.ok` trả `null`; parse `raw: unknown`, thu hẹp an toàn `envelope.data ?? raw`, chỉ trả `BatchQuotaInfo` khi `typeof payload.maxBatchSize === "number" && payload.maxBatchSize > 0`; nếu lỗi mạng/JSON gọi `onError?.(error)` và trả `null`.

**Call site trong `src/app/features/image-gen/components/hooks/useImageStudioActions.ts`**:

- Giữ nguyên **100%** `UseImageStudioActionsParams` (`src/app/features/image-gen/components/hooks/useImageStudioActions.ts:26-53`) và return shape (`src/app/features/image-gen/components/hooks/useImageStudioActions.ts:338-344`).
- `fetchBatchQuota` gọi `fetchStudioBatchQuota((e) => logger.warn("Failed to fetch batch quota:", e))` rồi `if (quota) setBatchQuota(quota)`.
- `handleGenerate` gọi `convertReferenceImagesToBase64(referenceImages, (e) => logger.warn(...))`, dùng trực tiếp `numberOfImages` (bỏ biến bí danh `totalImages`), gọi `resolveBatchFailureReason(results, successCount, t("studioGenerateFailed"))`, hợp nhất khối `if (successCount > 0)` (gọi `await loadConversation(targetId!)`, `void refreshConversations()`, `addToPromptHistory(prompt)`) thành 1 khối duy nhất cho cả single và batch, và gọi `setShowError(classifyStudioError(error instanceof Error ? error.message : "", t))` (vì `classifyStudioError` tại `src/lib/features/image-gen/studioHelpers.ts:33` đã fallback `t("studioGenerateFailed")`).
- `handleVariation` gọi `requestImageVariation({ imageUrl: image.url, originalPrompt: image.prompt, conversationId: targetId, model, aspectRatio: image.aspectRatio || aspectRatio })`, và đơn giản hóa `catch` tương tự.
- Gỡ 2 import không còn dùng trực tiếp (`fileToBase64`, `buildVariationPrompt`).
- **Dự toán dòng sau `prettier --write` (`printWidth: 100`)**: `~314` dòng (`<= 320` dòng, dư `6` dòng dưới mục tiêu và `36` dòng dưới trần `350`).

#### 6.3 Adversarial Timelines (`.agents/agents/reviewer/evidence-bar.md` §4.5.2)

- **Cơ chế 1 — Chat SSE concurrent send & unmount race (`resetStreamExecutionRefs` + `requestChatStream`)**:
  - _Trục Đồng thời_: `T1: coreSend #1 đang stream (abortControllerRef = AC1)` | `T2: coreSend #2 gọi resetStreamExecutionRefs` | `T3: AC1.abort() chạy trước khi gắn AC2, mọi ref tích lũy reset sạch; coreSend #1 nhận AbortError và thoát im lặng (không finalize error)` → **Kết cục**: Không đè stream, không ghi sai message → **An toàn**.
  - _Trục Thất bại giữa chừng / Unmount_: `T1: requestChatStream đang await fetch` | `T2: Component unmount (src/app/features/chat/components/hooks/useChatStreamController.ts:127-129 đặt isUnmountedRef.current = true, abort AC)` | `T3: Nếu fetch reject AbortError → catch bỏ qua; nếu fetch kịp resolve trước khi abort kịp cắt (cả ok hoặc !ok) → dòng if (isUnmountedRef.current) return ngay sau await requestChatStream chặn toàn bộ setStreamError/toast.error/finalizeAssistantMessage/processStreamResponse; finally chỉ gán abortControllerRef.current = null mà không gọi setIsStreaming` → **Kết cục**: 0 cập nhật state sau unmount, khớp `CT-6C-01 (#10)` → **An toàn**.
  - _Trục TOCTOU_: `T1: ensureConversationExists trả convId` | `T2: Unmount xảy ra trong lúc await createConversation` | `T3: if (isUnmountedRef.current) return chặn gọi requestChatStream` → **An toàn**.
  - _Trục Serverless_: **N/A** — cả 4 module đều là client-side browser hooks/helpers (`"use client"`), không giữ server state.
- **Cơ chế 2 — Image Studio batch settlement & timer cleanup (`resolveBatchFailureReason` + `useImageStudioActions`)**:
  - _Trục Đồng thời / Partial failure_: `T1: Promise.allSettled chạy N ảnh song song` | `T2: Ảnh 1 thành công (successCount = 1), ảnh 2 reject Error("429")` | `T3: resolveBatchFailureReason(results, 1, ...) trả null → không ném lỗi che ảnh đã tạo, gọi loadConversation + refreshConversations + addToPromptHistory; finally luôn dọn genTimerRef & gọi fetchBatchQuota` → **Kết cục**: Bảo toàn kết quả thành công bán phần, 0 rò rỉ interval → **An toàn**.
  - _Trục Thất bại toàn phần với reason falsy_: `T1: Mọi promise batch đều reject (ví dụ reject(undefined))` | `T2: successCount = 0` | `T3: resolveBatchFailureReason trả Error(t("studioGenerateFailed")) (không null) → throw → catch ghi logger.error và gọi setShowError(classifyStudioError(...))` → **Kết cục**: Người dùng luôn thấy thông báo lỗi rõ ràng → **An toàn**.

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [ ] **Bước 1**: Cập nhật `src/lib/features/chat/streamProtocol.ts` — thêm `MutableRefBox<T>`, `StreamExecutionRefs`, `ChatStreamRequestParams`, `ChatStreamFetchResult`, `resetStreamExecutionRefs`, `requestChatStream` (giữ nguyên 100% export cũ, 0 `any`, 0 React import).
- [ ] **Bước 2**: Cập nhật `src/app/features/chat/components/hooks/useChatStreamExecution.ts` — kế thừa `StreamExecutionRefs`, trích xuất `clearStreamBuffers`, chuyển sang gọi `resetStreamExecutionRefs` và `requestChatStream`, bảo toàn 100% public signature và hành vi runtime.
- [ ] **Bước 3**: Cập nhật `src/lib/features/chat/streamProtocol.test.ts` — bổ sung unit test co-located `TC-HF-01`..`TC-HF-04` (bao gồm NP-1, NP-2).
- [ ] **Bước 4**: Cập nhật `src/lib/features/image-gen/studioHelpers.ts` — thêm `convertReferenceImagesToBase64`, `resolveBatchFailureReason`, `requestImageVariation`, `fetchStudioBatchQuota` (dùng `import type { BatchQuotaInfo }`, strict `unknown` narrowing, 0 `any`).
- [ ] **Bước 5**: Cập nhật `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` — sử dụng 4 helper mới, hợp nhất nhánh `if (successCount > 0)` và lược bỏ fallback dư thừa với `classifyStudioError`, bảo toàn 100% public signature và hành vi runtime.
- [ ] **Bước 6**: Cập nhật `src/lib/features/image-gen/studioHelpers.test.ts` — bổ sung unit test co-located `TC-HF-05`..`TC-HF-08` (bao gồm NP-3, NP-5).
- [ ] **Bước 7**: Chạy `npx prettier --write` trên 6 file mã nguồn/test vừa sửa, sau đó chạy `npx prettier --check` và xác nhận số dòng thực tế:
  - `src/app/features/chat/components/hooks/useChatStreamExecution.ts` **`<= 305` dòng**
  - `src/app/features/image-gen/components/hooks/useImageStudioActions.ts` **`<= 320` dòng**
  - `src/lib/features/chat/streamProtocol.ts` **`<= 400` dòng** và `src/lib/features/image-gen/studioHelpers.ts` **`<= 400` dòng**
- [ ] **Bước 8**: Chạy bộ test mục tiêu (`streamProtocol.test.ts`, `studioHelpers.test.ts`, `useChatStreamController.test.ts`, `theme-config.test.ts`), rồi chạy toàn bộ `npm run type-check; npm run lint; npm run test:run` (0 lỗi, 0 warning).
- [ ] **Bước 9**: Thực hiện `/post-fix`: bổ sung bài học mới vào `docs/lessons-learned.md` (theo chuẩn `Symptom`, `Root Cause`, `Fix`, `Prevention Rule`, ghi chú lần lặp thứ 4 của nhóm Prettier/`lint-staged`) và ghi mục hotfix vào đầu `docs/CHANGELOG.md`; chạy `npx prettier --check docs/lessons-learned.md docs/CHANGELOG.md` rồi chạy lại `npm run type-check; npm run lint; npm run test:run` xác nhận xanh hoàn toàn.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Test ID    | Hàm / Mục tiêu                                                             | Input & Điều kiện biên                                                                                                                                                                                                                                                                                                                      | Output / Hành vi mong đợi (Pass Criteria)                                                                                                                                                                                                                                                                                                                                                          | Failure Mode bị chặn (Fail Criteria)                                                                               |
| :--------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `TC-HF-01` | `resetStreamExecutionRefs` (happy path + NP-2)                             | `refs` có `abortControllerRef.current = prevAc` (chưa abort), các ref khác mang giá trị bẩn (`hasStreamErrorRef = true`, `accumulatedAssistantRef = "old"`, `localSourcesRef = [{ a: 1 }]`, `emptyAnswerReasonRef = "length"`), `truncateClientMessageId = "trunc-1"`                                                                       | `prevAc.signal.aborted === true`; `refs.abortControllerRef.current` là `AbortController` mới khác `prevAc` và `signal === refs.abortControllerRef.current.signal` (`signal.aborted === false`); `currentClientMessageIdRef.current` là chuỗi non-empty mới; `currentTruncateClientMessageIdRef.current === "trunc-1"`; mọi mảng về `[]`, chuỗi về `""`, cờ lỗi về `false`, error/reason về `null`. | Quên abort controller cũ, tái sử dụng `signal` đã abort, hoặc sót ref chưa reset.                                  |
| `TC-HF-02` | `resetStreamExecutionRefs` (boundary)                                      | `abortControllerRef.current = null`, `truncateClientMessageId` là `undefined` và `""`                                                                                                                                                                                                                                                       | Không ném lỗi khi `prevAc === null`; `currentTruncateClientMessageIdRef.current` luôn chuẩn hóa về `null` cho cả `undefined` và `""`.                                                                                                                                                                                                                                                              | Lưu `""` hoặc `undefined` thay vì `null`, hoặc crash `Cannot read properties of null (reading 'abort')`.           |
| `TC-HF-03` | `requestChatStream` (happy path)                                           | `fetch` trả `ok: true` + `body.getReader()` hợp lệ; truyền đủ `conversationId`, `content`, `clientMessageId`, `regenerate: false`, `thinkingLevel: "high"`, `strataSampling: { mode: "creative" }`, `fileIds: ["f1"]`, `signal`                                                                                                             | Gọi `fetch("/api/chat-stream", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body, signal })`; JSON `body` KHÔNG chứa khóa `"signal"`, chứa đúng `fileIds`/`strataSampling`; trả `{ ok: true, reader }` với đúng `reader`.                                                                                                                        | Rò rỉ `signal` vào JSON body, sai `credentials`, hoặc bỏ qua `buildChatStreamPayload`.                             |
| `TC-HF-04` | `requestChatStream` (NP-1: HTTP error, missing body, network/abort reject) | (a) HTTP `429` JSON `{ error: { message: "Rate limited", code: "RATE_LIMIT" } }`; (b) HTTP `200` nhưng `body: null`; (c) `fetch` reject `DOMException("Aborted", "AbortError")`                                                                                                                                                             | (a) trả `{ ok: false, error: { message: "Rate limited", code: "RATE_LIMIT", status: 429 } }`; (b) trả `{ ok: false, error: { message: "Stream failed", code: undefined, status: 200 } }`; (c) Promise reject với đúng lỗi `AbortError` để caller bỏ qua im lặng.                                                                                                                                   | Nuốt `AbortError`, crash khi `res.body === null`, hoặc không truyền mã lỗi cấu trúc từ `extractStreamHttpError`.   |
| `TC-HF-05` | `convertReferenceImagesToBase64` (happy path + empty + NP-3)               | (a) `[]`; (b) 2 `Blob` hợp lệ (`"abc"`, `"def"`); (c) `FileReader` stub thành công ảnh 1 rồi kích hoạt `onerror` trên ảnh 2                                                                                                                                                                                                                 | (a) trả `[]`, không gọi `onError`; (b) trả mảng 2 chuỗi `data:...;base64,...` đúng thứ tự; (c) gọi `onError` đúng 1 lần với lỗi từ `FileReader` và trả mảng 1 phần tử đã chuyển đổi trước đó (không throw).                                                                                                                                                                                        | Ném exception làm hủy toàn bộ lượt tạo ảnh khi ảnh tham chiếu lỗi, hoặc đổi thứ tự mảng.                           |
| `TC-HF-06` | `resolveBatchFailureReason` (happy path + partial + NP-3 falsy rejection)  | (a) 1 fulfilled + 1 rejected với `successCount = 1`; (b) 2 fulfilled với `successCount = 0`; (c) 2 rejected (`Error("Safety blocked")`, `Error("Other")`) với `successCount = 0`; (d) rejected với string `"Quota 429"` (`successCount = 0`); (e) rejected với `undefined` / `null` (`successCount = 0`, `fallbackMessage = "Custom fail"`) | (a) trả `null`; (b) trả `null`; (c) trả đúng instance `Error("Safety blocked")`; (d) trả `Error` có `message === "Quota 429"`; (e) trả `Error` có `message === "Custom fail"` (luôn khác `null`).                                                                                                                                                                                                  | Trả `null` khi rejection là `undefined`/`null` khiến lỗi batch bị nuốt im lặng, hoặc throw khi `successCount > 0`. |
| `TC-HF-07` | `requestImageVariation` (happy path + model fallback + NP-5 HTTP 404)      | (a) `model: "gemini-3-pro-image"`, `localStorage` có `vikini-gemini-key = "gk-1"`, `fetch(imageUrl)` ok → `Blob`, `fetch("/api/generate-image")` trả `{ success: true }`; (b) `model: "flux-dev"` → fallback `"gemini-3.1-flash-image"`; (c) `fetch(imageUrl)` trả `Response(null, { status: 404 })`                                        | (a) gửi `x-api-key: "gk-1"`, `options.model: "gemini-3-pro-image"`, `options.referenceImage` bắt đầu bằng `"data:"`, prompt chứa `buildVariationPrompt` và trả `{ success: true }`; (b) gửi `options.model: "gemini-3.1-flash-image"`; (c) reject `Error("Failed to fetch source image")` trước khi gọi `/api/generate-image`.                                                                     | Gửi HTML 404 làm base64 lên `/api/generate-image` hoặc chọn sai model variation.                                   |
| `TC-HF-08` | `fetchStudioBatchQuota` (happy path + envelope + NP-5 error/malformed)     | (a) `{ success: true, data: { rank: "pro", maxBatchSize: 4, quotas: {} } }`; (b) `{ rank: "basic", maxBatchSize: 2, quotas: {} }`; (c) `{ maxBatchSize: 0 }` hoặc `null`; (d) HTTP `500`; (e) `fetch` reject `Error("Network down")`                                                                                                        | (a) trả object `maxBatchSize: 4`; (b) trả object `maxBatchSize: 2`; (c)/(d) trả `null`, không gọi `onError`; (e) gọi `onError` đúng 1 lần và trả `null` (không throw).                                                                                                                                                                                                                             | Trả payload thiếu `maxBatchSize`, crash trên `null` JSON, hoặc ném lỗi ra UI khi fetch quota nền thất bại.         |
| `TC-HF-09` | Integration regression (`useChatStreamController.test.ts`)                 | Toàn bộ 9 ca hiện có tại `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (gồm `cancelStream(true)`, `cancelStream(false)`, `done/flush`, `error`, `think` tags, `thinking` + `ragSources`, `TC-W4-05`, `CT-6C-01 (#10)` unmount abort)                                                                             | 9/9 test xanh, 0 sửa đổi vào test file hiện có.                                                                                                                                                                                                                                                                                                                                                    | Bất kỳ hồi quy nào về abort, partial persistence, stream error toast/banner, hay unmount cleanup.                  |
| `TC-HF-10` | Prettier stability & `TC-13` line-budget gate (NP-4)                       | `npx prettier --check` trên toàn bộ 8 file đã sửa + `TC-13` (`src/lib/config/theme-config.test.ts:437-480`)                                                                                                                                                                                                                                 | `prettier --check` thoát mã `0` (0 file cần format lại); `useChatStreamExecution.ts <= 305` dòng; `useImageStudioActions.ts <= 320` dòng; `streamProtocol.ts <= 400` dòng; `studioHelpers.ts <= 400` dòng; `TC-13` thoát mã `0` (`oversizedHooks === []`).                                                                                                                                         | `lint-staged` bung thêm dòng khi commit làm tái phát vượt ngưỡng `350`.                                            |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### File test co-located

- `src/lib/features/chat/streamProtocol.test.ts` — cập nhật tại chỗ cạnh `streamProtocol.ts` (`TC-HF-01`..`TC-HF-04`).
- `src/lib/features/image-gen/studioHelpers.test.ts` — cập nhật tại chỗ cạnh `studioHelpers.ts` (`TC-HF-05`..`TC-HF-08`).
- Hồi quy nguyên trạng: `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (`TC-HF-09`) và `src/lib/config/theme-config.test.ts` (`TC-HF-10`).

#### Lệnh kiểm chứng chuẩn PowerShell 5.1 (dùng `;`, CẤM `&&`)

```powershell
# 1. Wiring & Formatting Gate (đảm bảo lint-staged là no-op khi commit)
npx prettier --check src/lib/features/chat/streamProtocol.ts src/lib/features/chat/streamProtocol.test.ts src/app/features/chat/components/hooks/useChatStreamExecution.ts src/lib/features/image-gen/studioHelpers.ts src/lib/features/image-gen/studioHelpers.test.ts src/app/features/image-gen/components/hooks/useImageStudioActions.ts docs/lessons-learned.md docs/CHANGELOG.md

# 2. Xác minh số dòng thực tế sau Prettier (khớp công thức countFileLines tại src/lib/config/theme-config.test.ts:521-524)
node -e "const fs=require('fs'); for (const [f,max] of [['src/app/features/chat/components/hooks/useChatStreamExecution.ts',305],['src/app/features/image-gen/components/hooks/useImageStudioActions.ts',320],['src/lib/features/chat/streamProtocol.ts',400],['src/lib/features/image-gen/studioHelpers.ts',400]]) { const s=fs.readFileSync(f,'utf8'); const n=(s.endsWith('\n')?s.slice(0,-1):s).split('\n').length; console.log(f, n+'/'+max, n<=max?'OK':'OVER'); if(n>max) process.exit(1); }"

# 3. Wiring Probe ESLint rules đang bật trên hook mục tiêu
npx eslint --print-config src/app/features/chat/components/hooks/useChatStreamExecution.ts | Select-String -Pattern "exhaustive-deps|no-explicit-any"

# 4. Targeted Vitest (co-located + integration + TC-13 guard)
npx vitest run src/lib/features/chat/streamProtocol.test.ts src/lib/features/image-gen/studioHelpers.test.ts src/app/features/chat/components/hooks/useChatStreamController.test.ts src/lib/config/theme-config.test.ts --reporter=dot

# 5. Full Tier 2 Verification Gate
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes & Negative Probes (`.agents/agents/reviewer/evidence-bar.md` §4.5.3)

- **WP-1 (ESLint wiring)**: `npx eslint --print-config src/app/features/chat/components/hooks/useChatStreamExecution.ts` chứng minh `react-hooks/exhaustive-deps` và `@typescript-eslint/no-explicit-any` có hiệu lực ở mức `error` trên đường dẫn hook mục tiêu (`eslint.config.mjs:33,71`).
- **WP-2 (Prettier/`lint-staged` wiring)**: `npx prettier --check` thoát mã `0` trên tất cả 8 file đã sửa chứng minh `.husky/pre-commit` → `lint-staged` (`package.json:131-138`) sẽ là no-op tuyệt đối khi commit.
- **WP-3 (`TC-13` scanner wiring)**: `npx vitest run src/lib/config/theme-config.test.ts -t "TC-13" --reporter=dot` chứng minh scanner đọc tất cả hook `src/app/**/use[A-Z]*.ts(x)` và so sánh với `MAX_HOOK_LINES = 350` (`src/lib/config/theme-config.test.ts:453-460,518`).
- **NP-1 (`requestChatStream` error & null body)**: Kiểm chứng trong `src/lib/features/chat/streamProtocol.test.ts` (`TC-HF-04`) — response `429`, response `200` với `body: null`, và `AbortError` đều đi đúng nhánh lỗi.
- **NP-2 (`resetStreamExecutionRefs` dirty state & active abort)**: Kiểm chứng trong `src/lib/features/chat/streamProtocol.test.ts` (`TC-HF-01`, `TC-HF-02`) — chứng minh `prevAc.signal.aborted === true` và mọi ref bẩn bị xóa sạch.
- **NP-3 (`convertReferenceImagesToBase64` failing `FileReader` & `resolveBatchFailureReason` falsy rejection)**: Kiểm chứng trong `src/lib/features/image-gen/studioHelpers.test.ts` (`TC-HF-05`, `TC-HF-06`) — `FileReader` lỗi kích hoạt `onError` mà không crash; `reject(undefined)`/`reject(null)` vẫn sinh `Error(fallbackMessage)`.
- **NP-4 (`TC-13` & Prettier negative baseline)**: Baseline commit `adcb4b6` đã chứng minh thực chứng rằng `TC-13` bắt đúng lỗi trên `useChatStreamExecution.ts` (`355 > 350` dòng); sau khi sửa, cả `npx prettier --check` và `TC-13` phải xanh đồng thời.
- **NP-5 (`requestImageVariation` HTTP 404 & `fetchStudioBatchQuota` lỗi mạng/500)**: Kiểm chứng trong `src/lib/features/image-gen/studioHelpers.test.ts` (`TC-HF-07`, `TC-HF-08`).

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                |     Mức độ     | Technical Control cụ thể (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :-------------------------------------------------------------------------------------------------------------------- | :------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1 — Prettier bung dòng lại vượt mục tiêu (`> 305` / `> 320` hoặc `> 350`) khi commit**                             |    **Cao**     | Định dạng bằng `npx prettier --write` theo `.prettierrc` TRƯỚC khi chốt số dòng; xác minh bằng cổng `npx prettier --check` (WP-2) + script đếm dòng chuẩn `countFileLines` (`src/lib/config/theme-config.test.ts:521-524`) + `TC-13` (NP-4). Giữ biên dự phòng lớn (`~287/305` và `~314/320`, cách trần `350` từ `36–63` dòng).                                                                                                                                                       |
| **R2 — Gãy ổn định tham chiếu `useCallback` hoặc vi phạm `react-hooks/exhaustive-deps`**                              | **Trung bình** | Không truyền nguyên object `params` vào dependency array của `useCallback`; tiếp tục destructure từng ref/callback ổn định và kiểm chứng bằng ESLint `"react-hooks/exhaustive-deps": "error"` (`eslint.config.mjs:33`, WP-1).                                                                                                                                                                                                                                                         |
| **R3 — Hồi quy hành vi abort/unmount hoặc mock `Response` trong `useChatStreamController.test.ts`**                   | **Trung bình** | `requestChatStream` giữ nguyên gọi `fetch("/api/chat-stream", ...)` + `res.body.getReader()` (không gọi `reader.cancel()` bắt buộc để tương thích mock tại `src/app/features/chat/components/hooks/useChatStreamController.test.ts:74-93`); đặt `if (isUnmountedRef.current) return;` ngay sau `await requestChatStream(...)`; kiểm chứng bằng 9/9 test tích hợp gồm `CT-6C-01 (#10)` (`src/app/features/chat/components/hooks/useChatStreamController.test.ts:446-511`, `TC-HF-09`). |
| **R4 — Nuốt lỗi batch khi promise reject với giá trị falsy (`undefined`/`null`) hoặc gửi HTML 404 làm ảnh variation** | **Trung bình** | `resolveBatchFailureReason` chuẩn hóa mọi rejection khi `successCount === 0` về `Error` non-null (`TC-HF-06`, NP-3); `requestImageVariation` kiểm tra `response.ok === false` trước `response.blob()` (`TC-HF-07`, NP-5).                                                                                                                                                                                                                                                             |
| **R5 — Sử dụng `FileReader` mock sai kiểu constructor (arrow function) trong Vitest `happy-dom`**                     |    **Thấp**    | Dùng `class` stub cho `FileReader` trong `studioHelpers.test.ts` (tuân thủ bài học Wave 2A tại `docs/lessons-learned.md:858,865`) và dọn qua `vi.unstubAllGlobals()` trong `afterEach` (`src/lib/features/image-gen/studioHelpers.test.ts:111-114`).                                                                                                                                                                                                                                  |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 — chưa có lỗi từ lượt trước.
- Kết quả chạy `node scripts/verify-plan.mjs docs/plans/2026-11-21-ci-hotfix-prettier-hook-line-budget-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - 73/73 `[PASS] LINE_REF` hợp lệ trên codebase thật (0 lỗi, 0 cảnh báo `SELF_CITATION`).
  - `[INFO] CRITIC_REQUIRED no` — đã đối chiếu độc lập toàn bộ 8 tệp `[MODIFY]` với `scripts/verify-plan.mjs:205-233`: không có `*.server.ts`, không có `src/app/api/**`, không có tệp governance/auth/DB.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                     | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------- | ------- | ------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/chat/components/hooks/useChatStreamController.test.ts:32-511` | [CMD], [SRC] | Kế hoạch ghi `9 test` / `9/9 test xanh` trong khi thực tế tệp có **10 ca kiểm thử** (`npx vitest run src/app/features/chat/components/hooks/useChatStreamController.test.ts --reporter=dot` trả `10 passed (10)`, gồm ca #10 `CT-6C-01`). Không chặn thực thi vì tệp test giữ nguyên vẹn và chạy toàn bộ bộ test.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | DEFECT         | [MINOR] | `src/app/features/chat/components/hooks/useChatStreamExecution.ts:317-320`      | [SRC], [ADV] | Timeline đồng thời ở Mục 6.3 kết luận `coreSend #1` + `coreSend #2` chồng nhau là an toàn, nhưng khối `finally` hiện hữu tại dòng `317-320` đặt `setIsStreaming(false)` và `abortControllerRef.current = null` vô điều kiện (không kiểm tra `abortControllerRef.current?.signal === signal`), có thể xóa `AC2` nếu `#1` kết thúc sau `#2`. Đây là hành vi tồn đọng từ trước `adcb4b6` và ngoài phạm vi thay đổi runtime của hotfix (các action `handleRegenerate`/`handleEdit`/`handleContinue` tại `src/app/features/chat/components/hooks/useChatMessageActions.ts:139,187,211` đã chặn `if (isStreaming) return`); khuyến nghị ghi nhận để gia cố ở wave tiếp theo hoặc thêm guard `abortControllerRef.current?.signal === signal` nếu thích hợp. |
| 3   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/ControlPanel.tsx:280-289`                | [SRC]        | `fetchStudioBatchQuota` chỉ kiểm tra `typeof payload.maxBatchSize === "number" && payload.maxBatchSize > 0`, trong khi `ControlPanel.tsx:286` truy cập trực tiếp `batchQuota.quotas[num]` khi `maxBatchSize > 1`. Route `src/app/api/batch-gen-quota/route.ts:53-57` luôn trả đủ `{ rank, maxBatchSize, quotas }`, nhưng nên kiểm tra thêm `typeof payload.rank === "string" && typeof payload.quotas === "object" && payload.quotas !== null` để thu hẹp kiểu `BatchQuotaInfo` chặt chẽ hơn và tránh cast chưa kiểm chứng.                                                                                                                                                                                                                          |
| 4   | RISK_DISMISSED | [MINOR] | `node_modules/@types/react/index.d.ts:153-158,1661-1663`                        | [SRC]        | Rủi ro lệch kiểu giữa `MutableRefBox<T>` trong `StreamExecutionRefs` và `MutableRefObject<T>`/`RefObject<T>` từ `useRef()` tại `src/app/features/chat/components/hooks/useChatStreamController.ts:79-91,186-225` bị bác bỏ: cả `RefObject<T>` (`153-158`) và `MutableRefObject<T>` (`1661-1663`) trong React 19 đều là `{ current: T }`, tương thích cấu trúc hai chiều dưới `strict: true`.                                                                                                                                                                                                                                                                                                                                                         |
| 5   | RISK_DISMISSED | [MINOR] | `src/app/features/chat/components/hooks/useChatStreamExecution.ts:1-355`        | [SRC], [CMD] | Rủi ro Prettier (`printWidth: 100` tại `.prettierrc:1-10`) bung dependency array của `coreSend` (khi gộp `prepareStreamRequest` và giữ đầy đủ deps theo `eslint.config.mjs:33`) làm vượt mục tiêu `<= 305` dòng bị bác bỏ: tái cấu trúc từng dòng theo chuẩn Prettier cho kết quả `~292` dòng cho `useChatStreamExecution.ts` (`<= 305`, cách trần `350` tại `src/lib/config/theme-config.test.ts:518` là `58` dòng), `~312` dòng cho `src/app/features/image-gen/components/hooks/useImageStudioActions.ts:1-345` (`<= 320`, cách trần `350` là `38` dòng), `~306` dòng cho `src/lib/features/chat/streamProtocol.ts:164-215` (`<= 400`), và `~239` dòng cho `src/lib/features/image-gen/studioHelpers.ts:10-34,127-164` (`<= 400`).                |
| 6   | RISK_DISMISSED | [MINOR] | `src/lib/features/image-gen/studioHelpers.ts:1`                                 | [SRC]        | Rủi ro vi phạm ranh giới lớp hoặc vòng lặp ES module TDZ khi thêm `import type { BatchQuotaInfo }` từ `src/app/features/image-gen/components/ControlPanel.tsx:23-27` bị bác bỏ: `studioHelpers.ts:1` đã dùng `import type` cho `GeneratedImage`, `ControlPanel.tsx:1-27` không import `studioHelpers.ts`, và `import type` bị xóa hoàn toàn ở thời điểm biên dịch.                                                                                                                                                                                                                                                                                                                                                                                   |
| 7   | RISK_DISMISSED | [MINOR] | `src/app/features/chat/components/hooks/useChatStreamController.test.ts:74-93`  | [SRC], [CMD] | Rủi ro `requestChatStream` làm gãy mock `Response` tối giản (thiếu `headers`/`status`/`reader.cancel`) trong `useChatStreamController.test.ts` bị bác bỏ: nhánh `res.ok && res.body` chỉ gọi `res.body.getReader()`, còn nhánh lỗi đi qua `extractStreamHttpError` (`src/lib/features/chat/streamProtocol.ts:190-215`) vốn đã bọc `try/catch` quanh `res.json()`.                                                                                                                                                                                                                                                                                                                                                                                    |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                             | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7/7)    | PASS    | [CMD]        | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`, 73/73 `LINE_REF` `[PASS]`, `CRITIC_REQUIRED no`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Skills Loaded & Applied         | PASS    | [SRC]        | Ánh xạ đủ skill bắt buộc theo miền chạm tới: `streaming-patterns`, `vikini-debug`, `vikini-investigate`, `vikini-audit`, `01-coding.md`, `02-quality.md`, `docs/contracts.md`, `docs/features.md`, `docs/lessons-learned.md`.                                                                                                                                                                                                                                                                                                                                                 |
| S1: Cold-start & Build          | PASS    | [CMD], [SRC] | `npm run type-check` exit `0`; `package.json:64-138` & `tsconfig.json:6-7` khớp phiên bản và `strict: true`; `npx eslint --print-config` trên cả 2 hook xác nhận `react-hooks/rules-of-hooks: [2]`, `react-hooks/exhaustive-deps: [2]`, `@typescript-eslint/no-explicit-any: [2]`, `no-duplicate-imports: [2]`; không thêm biến `.env` hay module ảo.                                                                                                                                                                                                                         |
| S2: Runner Lifecycle & Teardown | PASS    | [SRC], [CMD] | Giữ nguyên `AbortController` teardown & `isUnmountedRef` (`src/app/features/chat/components/hooks/useChatStreamController.ts:124-133`), kiểm tra `isUnmountedRef` sau `await requestChatStream(...)`, dọn `genTimerRef` trong unmount `useEffect` và `finally` (`src/app/features/image-gen/components/hooks/useImageStudioActions.ts:88-95,222-226`), dọn global stub/storage trong `afterEach` (`src/lib/features/image-gen/studioHelpers.test.ts:111-114`, `src/lib/features/chat/streamProtocol.test.ts:15-21`); baseline `useChatStreamController.test.ts` `10/10` pass. |
| S3: Database & Temporal Logic   | N/A     | [SRC]        | Hotfix chỉ sửa 2 client hooks (`"use client"`), 2 pure client helper modules, 2 test co-located và 2 file docs; không chạm Supabase schema, migration, RLS hay truy vấn DB.                                                                                                                                                                                                                                                                                                                                                                                                   |
| S4: Cross-Task State Flow       | PASS    | [SRC]        | Đã đối chiếu trực tiếp toàn bộ caller: `src/app/features/chat/components/hooks/useChatStreamController.ts:6-10,16,186-225`, `useChatPartialPersistence.ts:8-12`, `useChatStreamReader.ts:5-10`, `useChatMessageActions.ts:11-16`, `src/app/features/image-gen/components/hooks/useImageGenStudio.ts:12-17,92-125`; chữ ký đầu vào và return shape bảo toàn nguyên trạng.                                                                                                                                                                                                      |
| S5: Security Boundary & Auth    | PASS    | [SRC]        | Không đụng `*.server.ts`, `service_role` hay API route; `requestChatStream` giữ `credentials: "same-origin"` (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:281`), `requestImageVariation` bổ sung chặn `response.ok === false` trước `response.blob()`, và `/api/batch-gen-quota/route.ts:13-24` giữ nguyên auth + kiểm tra chặn phía server.                                                                                                                                                                                                            |
| S6: External Resilience & Cap   | PASS    | [SRC]        | Không sửa `maxDuration` của route serverless; toàn bộ nhánh hiển thị lỗi (`toast.error(resolveStreamErrorMessage(...))`, `setShowError(classifyStudioError(...))`, `logger.error`/`logger.warn`) được giữ nguyên và `resolveBatchFailureReason` chặn lỗi nuốt rejection falsy.                                                                                                                                                                                                                                                                                                |
| Domain: Open Inquiry (Vikini)   | PASS    | [CMD], [SRC] | Tái hiện đúng lỗi CI baseline bằng `npx vitest run src/lib/config/theme-config.test.ts --reporter=dot` (`TC-13` báo `useChatStreamExecution.ts: 355 > 350`) và `git show --stat adcb4b6` xác nhận `useChatStreamExecution.ts` (`355L`) & `useImageStudioActions.ts` (`345L`); không chạm Model Registry, giới hạn token hay chuỗi dịch song ngữ `vi.ts`/`en.ts`.                                                                                                                                                                                                              |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. _Đồng thời_: `Cơ chế: useChatStreamExecution coreSend + resetStreamExecutionRefs` — `T1: coreSend #1 đang chạy với AC1` | `T2: coreSend #2 gọi resetStreamExecutionRefs (AC1.abort(), gắn AC2)` | `T3: #1 nhận AbortError, bỏ qua catch nhưng vào finally (src/app/features/chat/components/hooks/useChatStreamExecution.ts:317-320) đặt setIsStreaming(false) và abortControllerRef.current = null` → **Kết cục**: Hành vi tồn đọng trước hotfix (không phải hồi quy mới; các entry `handleRegenerate`/`handleEdit`/`handleContinue` chặn bằng `if (isStreaming) return`) → **Lỗi tồn đọng ([MINOR] ghi chú ở Critic Finding #2)**.
  2. _Khoảng trống check→use (TOCTOU)_: `Cơ chế: ensureConversationExists → requestChatStream & requestImageVariation` — `T1: ensureConversationExists hoặc fetch(imageUrl) đang await` | `T2: Component unmount hoặc nguồn ảnh trả HTTP 404` | `T3: if (isUnmountedRef.current) return sau await requestChatStream chặn mọi setState/toast sau unmount; response.ok === false chặn đọc HTML 404 làm base64` → **Kết cục**: Không cập nhật state sau unmount, không gửi payload lỗi lên `/api/generate-image` → **An toàn**.
  3. _Thất bại giữa chừng & dọn dẹp_: `Cơ chế: Image Studio batch Promise.allSettled + genTimerRef` — `T1: Batch N ảnh đang chạy với setInterval` | `T2: Tất cả reject (gồm rejection undefined/null) hoặc 1 phần thành công` | `T3: resolveBatchFailureReason trả Error(fallbackMessage) khi successCount === 0 và null khi successCount > 0; finally & unmount effect luôn clearInterval(genTimerRef.current)` → **Kết cục**: Không nuốt lỗi batch, không rò rỉ timer → **An toàn**.
  4. _Môi trường serverless_: **N/A** — phạm vi hotfix thuần client-side (`"use client"` hooks & pure browser helpers), không chạy trong serverless route và không giữ server state.
- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-21-ci-hotfix-prettier-hook-line-budget-plan.md` (exit `0`, `VERIFY_PLAN: PASS`)
  - `npm run type-check` (exit `0`)
  - `npx vitest run src/lib/config/theme-config.test.ts --reporter=dot` (exit `1`, tái hiện `TC-13`: `useChatStreamExecution.ts: 355 > 350`)
  - `npx vitest run src/app/features/chat/components/hooks/useChatStreamController.test.ts --reporter=dot` (exit `0`, `10 passed`)
  - `npx vitest run src/lib/features/chat/streamProtocol.test.ts --reporter=dot` (exit `0`, `8 passed`)
  - `npx vitest run src/lib/features/image-gen/studioHelpers.test.ts --reporter=dot` (exit `0`, `4 passed`)
  - `npx eslint --print-config src/app/features/chat/components/hooks/useChatStreamExecution.ts` (exit `0`, `exhaustive-deps: [2]`, `no-explicit-any: [2]`)
  - `npx eslint --print-config src/app/features/image-gen/components/hooks/useImageStudioActions.ts` (exit `0`, `exhaustive-deps: [2]`, `no-explicit-any: [2]`)
  - `npx vitest list --filesOnly` (exit `0`)
  - `git status` (exit `0`)
  - `git log -n 5 --oneline` (exit `0`)
  - `git show --stat adcb4b6 -- src/app/features/chat/components/hooks/useChatStreamExecution.ts src/app/features/image-gen/components/hooks/useImageStudioActions.ts` (exit `0`)

#### 4. Kết Luận

- Không phát hiện lỗi `[BLOCKER]` hoặc `[MAJOR]`; 3 ghi chú `[MINOR]` (đếm số ca `useChatStreamController.test.ts` là `10/10`, ghi chú `finally` tồn đọng khi `coreSend` chồng nhau, và khuyến nghị kiểm tra thêm `rank`/`quotas` trong `fetchStudioBatchQuota`) không chặn phê duyệt. `CRITIC_REQUIRED` xác nhận `no`.

[PLAN_APPROVED]

# Implementation Plan: Fix Delete Confirmation Modal Overflow/Copy & Gallery PGRST201 Infinite Loading Loop (Revision 2)

- **Date**: 2026-10-14
- **Author**: `@planner` (Technical Planner)
- **Status**: Approved (Revision 2)

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Khắc phục triệt để 2 lỗi nghiêm trọng do người dùng báo cáo (kèm ảnh chụp màn hình thực tế):

1. **Bug 1 — Delete Confirmation Modal bị lệch khung (double border), xuất hiện thanh cuộn ngang/dọc trắng xám và sai tiêu đề khi xóa dự án Image Studio**:
   - **Nguyên nhân gốc rễ 1A (CSS Scrollport Overflow & Unstyled Horizontal Scrollbar)**:
     - Trong commit `11420b6`, `DialogContent` (`src/components/ui/dialog.tsx:41`) được thêm `max-h-[calc(100dvh-2rem)] overflow-y-auto`. Theo đặc tả CSS Overflow Module Level 3, khi `overflow-y: auto` được đặt mà không chỉ định `overflow-x`, trình duyệt tự động ép `overflow-x: auto`, biến `DialogContent` thành scroll container hai chiều.
     - Bên trong `ConfirmDialogHost` (`src/components/ui/confirm-dialog.tsx:54`, khi `isDanger === true`) và `ChatModalsSection` (`src/app/features/chat/components/ChatModalsSection.tsx:116`), modal render một phần tử con `<div aria-hidden="true" className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl" />`.
     - Vì `-inset-px` đặt `top: -1px; right: -1px; bottom: -1px; left: -1px`, phần tử tuyệt đối này tràn ra ngoài 1px ở cạnh phải và cạnh dưới của `DialogContent`, làm `scrollWidth > clientWidth` (+1px) và `scrollHeight > clientHeight` (+1px).
     - Kết quả: Trình duyệt kích hoạt **cả hai thanh cuộn dọc và ngang** ngay bên trong đường viền `border border-(--border) rounded-(--radius)` của `DialogContent`. Hơn nữa, `src/app/styles/themes/_shared/base.css:184` chỉ định nghĩa `::-webkit-scrollbar { width: 6px; }` mà thiếu `height: 6px;` và `::-webkit-scrollbar-corner { background: transparent; }`, khiến Chromium vẽ thanh cuộn ngang dày ~15px và ô vuông góc dưới bên phải màu trắng/xám sáng, đẩy phần hộp nội dung màu đỏ sẫm (`bg-(--danger)/15 rounded-(--radius)`) lệch hẳn về góc trên-trái của khung viền ngoài.
   - **Nguyên nhân gốc rễ 1B (Sai Translation Key trong Image Studio)**:
     - Trong `src/app/features/image-gen/components/hooks/useImageGenStudio.ts:563`, hàm `handleDeleteProject` gọi `confirm({ title: t("deleteConfirm") || "Delete this project?", description: t("studioDeleteProjectDesc") || ... })`.
     - Khóa `deleteConfirm` trong `src/lib/utils/translations/en.ts:69` có giá trị `"Delete this conversation?"` (`vi.ts:68`: `"Xóa cuộc hội thoại này?"`). Vì chuỗi này truthy nên fallback `"Delete this project?"` không bao giờ chạy, dẫn đến tiêu đề modal báo `"Delete this conversation?"` trong khi phần mô tả bên dưới lại báo `"All generated images in this project will be permanently deleted."`.

2. **Bug 2 — Trang `/gallery` không tải được ảnh đã tạo ("0 images / No images found.") kèm vòng lặp vô tận (Infinite Loading Spinner & nhấp nháy "Scroll to load more...")**:
   - **Nguyên nhân gốc rễ 2A (PostgREST `PGRST201` Ambiguous Relationship Error gây lỗi HTTP 500 trên `GET /api/gallery`)**:
     - Bản migration `supabase/migrations/20260916_add_conversation_branching.sql` đã thêm cột `forked_from_message_id UUID REFERENCES messages(id)` vào bảng `conversations`.
     - Như được xác nhận trong `src/types/database.types.ts` (dòng 13, 95, 479; `PostgrestVersion: "14.5"`), hiện tồn tại **hai** khóa ngoại nối giữa `messages` và `conversations`:
       1. `messages_conversation_id_fkey` (`messages.conversation_id -> conversations.id`)
       2. `conversations_forked_from_message_id_fkey` (`conversations.forked_from_message_id -> messages.id`)
     - Trong commit `9ccde5274f40871e0b30da312595d3f2c98b9e8c`, `src/app/api/gallery/route.ts:88-100` được refactor sang truy vấn `.from("messages").select("id, content, created_at, meta, conversations!inner(user_id, model)")`.
     - Khi có 2 mối quan hệ giữa `messages` và `conversations`, PostgREST 14.5 từ chối cú pháp `conversations!inner` với lỗi `PGRST201: Could not embed because more than one relationship was found for 'messages' and 'conversations'`, khiến `GET /api/gallery` luôn trả về **HTTP 500**!
     - Tương tự, các truy vấn dùng `conversations!inner` không chỉ định rõ tên FK tại `src/app/api/gallery/[id]/route.ts:48`, `src/lib/features/chat/messages.ts:395,505`, và `src/app/api/admin/stats/route.ts:33` (`.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true })`) cũng bị ảnh hưởng bởi `PGRST201`.
     - Ngoài ra, tại `src/app/api/gallery/route.ts:132`, biểu thức `prompt: meta?.prompt || msg.content || ""` bỏ sót `meta?.editPrompt` (được lưu trong cột JSONB `meta` bởi `src/app/api/edit-image/route.ts:229` và `src/app/api/edit-image-multi/route.ts:349`) và chưa giải mã an toàn `msg.content` khi `msg.content` là bản mã AES-256-GCM/CBC (`iv:authTag:encrypted` hoặc `iv:encrypted` do `saveMessage` tạo).
   - **Nguyên nhân gốc rễ 2B (Infinite `IntersectionObserver` Re-trigger Loop khi API lỗi hoặc danh sách rỗng)**:
     - Trong `src/app/features/gallery/components/hooks/useGalleryController.ts:78`, `hasMore` được khởi tạo là `useState(true)`.
     - Trong `fetchImages` (`useGalleryController.ts:96-120`), khi `!res.ok` (như HTTP 500) hoặc rơi vào `catch (error)`, `setHasMore(false)` **không được gọi** (và cũng không thông báo lỗi cho người dùng). Do đó `hasMore` vẫn giữ giá trị `true` trong khi `images` là `[]` và `loading` chuyển về `false`.
     - Trong `src/app/features/gallery/components/GalleryView.tsx:256`, phần tử sentinel `<div ref={g.loadMoreRef}>` được render mỗi khi `!g.loading && g.hasMore` (ngay cả khi `g.filteredImages.length === 0`, nằm ngay dưới dòng `"No images found."` trong vùng nhìn thấy của màn hình).
     - Vì `loadingMore` nằm trong dependency array của `useEffect` khởi tạo `IntersectionObserver` (`[hasMore, loadingMore, loading, fetchImages]`), mỗi lần `fetchImages(true)` thất bại sẽ bật/tắt `loadingMore` (`false -> true -> false`), làm `useEffect` hủy và tạo mới `IntersectionObserver`. Ngay khi `observer.observe(loadMoreRef.current)` chạy, trình duyệt lập tức bắn callback `isIntersecting === true` vì sentinel đang hiển thị ngay trước mắt, kích hoạt lại `fetchImages(true)` tạo thành vòng lặp vô tận (~10–20 request/giây) và làm giao diện nhấp nháy liên tục giữa icon `<Loader2 className="animate-spin" />` và chữ `"Scroll to load more..."`!

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng Pre-Work Protocol trong `.agents/rules/02-quality.md`:

| Tham chiếu         | Đường dẫn                         | Mục đích áp dụng                                                                                                                                        |
| :----------------- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coding Standards   | `.agents/rules/01-coding.md`      | Ranh giới kiến trúc `app/` vs `lib/features/` vs `components/ui/`, giới hạn 150–400 dòng/file, cấm `any`, dùng `unknown` narrowing.                     |
| Quality & Pre-Work | `.agents/rules/02-quality.md`     | Quy trình kiểm tra liên kết tài liệu, co-located tests (`*.test.ts`), cập nhật `docs/CHANGELOG.md` và `docs/lessons-learned.md`, lệnh `npm run verify`. |
| UI & Styling       | `.agents/rules/03-ui.md`          | Quy tắc semantic CSS tokens (`--danger`, `--border`, `--radius`), glassmorphism và scrollbar.                                                           |
| Bilingual Rule     | `.agents/rules/04-bilingual.md`   | Đồng bộ 100% khóa dịch thuật giữa `src/lib/utils/translations/en.ts` và `vi.ts`, không hardcode chuỗi tiếng Anh trên UI.                                |
| Plan Review Loop   | `.agents/rules/05-plan-review.md` | Cấu trúc 2 phần (`## Technical Plan` & `## Audit History`), tuân thủ Code Freeze.                                                                       |
| API Patterns       | `.agents/skills/api-patterns.md`  | Chuẩn hóa thin route orchestration (Validate -> Execute -> Respond) và xử lý lỗi API.                                                                   |
| Database Schema    | `docs/database-schema.md`         | Đối chiếu cột thực tế của bảng `messages` (`id, conversation_id, role, content, meta, created_at`) và 2 khóa ngoại giữa `conversations` và `messages`.  |
| Lessons Learned    | `docs/lessons-learned.md`         | Ghi nhận bài học về PostgREST `PGRST201` khi bảng có nhiều hơn 1 FK và CSS scrollport overflow với `-inset-px`.                                         |

---

### 3. Assumptions & Cross-Task Dependencies

- **Assumptions**:
  - Database Supabase hiện tại đang chạy PostgREST `14.5` (khớp với `src/types/database.types.ts:13`) và có cả 2 FK: `messages_conversation_id_fkey` (`messages.conversation_id -> conversations.id`) và `conversations_forked_from_message_id_fkey` (`conversations.forked_from_message_id -> messages.id`).
  - Bảng `messages` (`src/types/database.types.ts:452-460`, `docs/database-schema.md:60-67`) có các cột `id`, `conversation_id`, `role`, `content`, `meta` (JSONB), `created_at`.
  - Mọi hình ảnh hiển thị trên `/gallery` (tạo từ `/api/generate-image`, `/api/edit-image`, `/api/edit-image-multi`, hoặc đính kèm trong cuộc trò chuyện bao gồm cả project `vikini-image-studio` trừ `user_templates_store`) đều được lưu trong cột JSONB `meta` của bảng `messages` với cấu trúc:
    ```ts
    meta: {
      type?: "image_gen" | "image_edit" | string;
      imageUrl?: string;
      prompt?: string;
      editPrompt?: string;
      attachment?: { url?: string; storagePath?: string; mimeType?: string; filename?: string };
      originalOptions?: {
        aspectRatio?: string;
        resolution?: string;
        style?: string;
        model?: string;
      };
    } | null
    ```
- **Cross-Task Dependencies**:
  - Việc sửa cú pháp PostgREST disambiguation (`conversations!messages_conversation_id_fkey!inner`) được áp dụng đồng bộ cho cả `/api/gallery`, `/api/gallery/[id]`, `src/lib/features/chat/messages.ts`, và `/api/admin/stats` để ngăn chặn toàn bộ lỗi `PGRST201` phát sinh từ migration branching `20260916_add_conversation_branching.sql`.
  - Không yêu cầu chạy thêm migration SQL mới trên Supabase vì tên constraint `messages_conversation_id_fkey` đã tồn tại sẵn trong schema chuẩn và `src/types/database.types.ts`.

---

### 4. Bảng Verified Versions (Online Grounding 2026)

Đã đối chiếu trực tuyến tài liệu PostgREST / Supabase JS và xác minh thực tế trong `package.json` + `src/types/database.types.ts`:

| Thư viện / Công nghệ           | Phiên bản trong `package.json` | Trạng thái xác minh (2026)     | Ghi chú kỹ thuật & Tương thích                                                                                                         |
| :----------------------------- | :----------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                         | `^16.4.0`                      | Stable (Next.js 16 App Router) | Route handlers dùng Web `Request`/`NextResponse`.                                                                                      |
| `react` / `react-dom`          | `^19.2.3`                      | Stable (React 19)              | Dùng `useEffect`, `useCallback`, `useRef` chuẩn.                                                                                       |
| `@supabase/supabase-js`        | `^2.89.0` (PostgREST `14.5`)   | Stable                         | Khi 2 bảng có >1 FK, bắt buộc chỉ định rõ FK constraint: `conversations!messages_conversation_id_fkey!inner(...)` để tránh `PGRST201`. |
| `@radix-ui/react-dialog`       | `^1.1.15`                      | Stable                         | `DialogContent` dùng `max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden`.                                                    |
| `@radix-ui/react-alert-dialog` | `^1.1.15`                      | Stable                         | `AlertDialogContent` cần thêm `overflow-x-hidden` đồng bộ với `DialogContent`.                                                         |
| `tailwindcss`                  | `^4.1.18`                      | Stable (Tailwind CSS v4)       | Hỗ trợ CSS variables `rounded-(--radius)`, `border-(--danger)/30`, `color-mix()`.                                                      |
| `vitest`                       | `^4.1.11`                      | Stable                         | Chạy unit tests co-located qua `npm run verify` (`environment: "happy-dom"`).                                                          |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` Files tạo mới

1. `[NEW]` `src/lib/features/gallery/galleryMapper.ts`
   - Tách pure business logic xử lý dữ liệu Gallery ra khỏi route handler (`src/app/api/gallery/route.ts`) đúng chuẩn `.agents/rules/01-coding.md`, khớp 100% với cấu trúc `MessageRow` và `GalleryImage` thực tế của `src/app/api/gallery/route.ts:16-42, 121-140`:
     - Định nghĩa kiểu `GalleryMessageRow`:

       ```ts
       export interface GalleryMessageRow {
         id: string;
         content: string | null;
         role?: string;
         created_at: string;
         meta: {
           type?: string;
           imageUrl?: string;
           prompt?: string;
           editPrompt?: string;
           attachment?: { url?: string };
           originalOptions?: {
             aspectRatio?: string;
             resolution?: string;
             style?: string;
             model?: string;
           };
         } | null;
       }

       export interface GalleryImageItem {
         id: string;
         url: string;
         prompt: string;
         createdAt: string;
         aspectRatio?: string;
         style?: string;
         model?: string;
       }
       ```

     - Hàm `isCiphertextHex(value: string): boolean`: kiểm tra định dạng bản mã thực tế của `src/lib/core/encryption.ts` (khớp với `src/lib/features/chat/messages.ts:81-84`):
       ```ts
       const GCM_CIPHERTEXT_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
       const CBC_CIPHERTEXT_RE = /^[0-9a-f]{32}:[0-9a-f]+$/i;
       export function isCiphertextHex(value: string): boolean {
         return GCM_CIPHERTEXT_RE.test(value) || CBC_CIPHERTEXT_RE.test(value);
       }
       ```
     - Hàm `resolveMessageContent(content: string | null | undefined, decryptFn?: (cipher: string) => string): string`:
       - Nếu `!content` -> trả về `""`.
       - Nếu `isCiphertextHex(content)`:
         - Nếu không có `decryptFn` -> trả về `""` (tuyệt đối không để lộ chuỗi hex ciphertext ra UI).
         - Trong `try { const plain = decryptFn(content); return plain || ""; } catch { return ""; }` (nếu giải mã thất bại hoặc đang ở môi trường client/happy-dom trả về `""`, luôn trả về `""` chứ không bao giờ trả lại chuỗi hex `content`).
       - Nếu `!isCiphertextHex(content)` (tức `content` là plaintext như `"Attachment image"` hoặc `"Edited Image: ..."`): trả về trực tiếp `content` mà không gọi `decryptText` (nhằm tránh việc `decryptText` trả về `""` khi `typeof window !== "undefined"` trong Vitest `happy-dom` hoặc ném lỗi `"Invalid encryption format"` khi plaintext có chứa dấu `:`).
     - Hàm `paginateAndMapGalleryRows(rawRows: GalleryMessageRow[], limit: number, decryptFn?: (cipher: string) => string): { images: GalleryImageItem[]; hasMore: boolean }`:
       - Tính `const hasMore = rawRows.length > limit;` (khớp với `query.range(offset, offset + limit)` lấy `limit + 1` bản ghi tại `src/app/api/gallery/route.ts:114, 122`).
       - Cắt trang `const items = hasMore ? rawRows.slice(0, limit) : rawRows;`.
       - Map từng `msg` trong `items`:
         - `const meta = msg.meta;`
         - `const url = meta?.imageUrl || meta?.attachment?.url || "";`
         - `const prompt = meta?.prompt || meta?.editPrompt || resolveMessageContent(msg.content, decryptFn) || "";`
         - Trả về `{ id: msg.id, url, prompt, createdAt: msg.created_at, aspectRatio: meta?.originalOptions?.aspectRatio, style: meta?.originalOptions?.style, model: meta?.originalOptions?.model }` và `.filter((img) => Boolean(img.url))`.

2. `[NEW]` `src/lib/features/gallery/galleryMapper.test.ts`
   - Unit test co-located kiểm thử đầy đủ `isCiphertextHex`, `resolveMessageContent`, và `paginateAndMapGalleryRows` (bao gồm `meta.imageUrl`, `meta.attachment.url`, thứ tự ưu tiên `meta.prompt -> meta.editPrompt -> resolveMessageContent(msg.content)`, bảo vệ plaintext có dấu `:` dưới `happy-dom`, ẩn chuỗi hex khi giải mã lỗi, lọc bỏ dòng không có `url`, và tính `hasMore = rawRows.length > limit` kèm `slice(0, limit)`).

#### `[MODIFY]` Files chỉnh sửa

3. `[MODIFY]` `src/components/ui/dialog.tsx`
   - Thêm `overflow-x-hidden` vào `DialogContent` (`max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden`) để ngăn trình duyệt tự động bật thanh cuộn ngang khi có phần tử con hoặc hiệu ứng bóng.
4. `[MODIFY]` `src/components/ui/alert-dialog.tsx`
   - Thêm `overflow-x-hidden` vào `AlertDialogContent` (`max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden`) để đồng bộ hành vi ngăn tràn ngang.
5. `[MODIFY]` `src/components/ui/confirm-dialog.tsx`
   - Loại bỏ phần tử con `{isDanger && (<div aria-hidden="true" className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl" />)}` tại dòng 51–56 (thủ phạm gây tràn scrollport 1px và tạo hộp màu đỏ lệch góc trên-trái).
   - Thay thế bằng hiệu ứng viền và đổ bóng trực tiếp trên `DialogContent` (dòng 46) khi `isDanger` là `true`:
     `className={isDanger ? "max-w-md border-(--danger)/30 ring-(--danger)/20 shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--danger)_25%,transparent)]" : "max-w-md"}`
6. `[MODIFY]` `src/app/features/chat/components/ChatModalsSection.tsx`
   - Tại modal xóa cuộc trò chuyện (dòng 109–117), loại bỏ phần tử con `<div className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl" />` và áp dụng class `shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--danger)_25%,transparent)]` trực tiếp lên `DialogContent` để đồng bộ giao diện với `ConfirmDialogHost`.
7. `[MODIFY]` `src/app/styles/themes/_shared/base.css`
   - Tại dòng 184–190: bổ sung `height: 6px;` cho `::-webkit-scrollbar` và thêm rule `::-webkit-scrollbar-corner { background: transparent; }` để không bao giờ xuất hiện thanh cuộn ngang dày 15px hay ô vuông trắng ở góc cuộn trên toàn ứng dụng.
8. `[MODIFY]` `src/lib/utils/translations/en.ts`
   - Bổ sung các khóa dịch thuật còn thiếu:
     - `studioDeleteProjectTitle: "Delete this project?"`
     - `galleryLoadFailed: "Failed to load gallery images"`
     - `galleryDeleteFailed: "Failed to delete image"`
     - `galleryScrollForMore: "Scroll to load more..."`
     - `galleryImagesCount: "images"`
9. `[MODIFY]` `src/lib/utils/translations/vi.ts`
   - Bổ sung đầy đủ các khóa dịch thuật tiếng Việt tương ứng:
     - `studioDeleteProjectTitle: "Xóa dự án này?"`
     - `galleryLoadFailed: "Không thể tải thư viện ảnh"`
     - `galleryDeleteFailed: "Không thể xóa ảnh"`
     - `galleryScrollForMore: "Cuộn để tải thêm..."`
     - `galleryImagesCount: "ảnh"`
10. `[MODIFY]` `src/app/features/image-gen/components/hooks/useImageGenStudio.ts`
    - Tại hàm `handleDeleteProject` (dòng 563): đổi `title: t("deleteConfirm") || "Delete this project?"` thành `title: t("studioDeleteProjectTitle") || "Delete this project?"`.
11. `[MODIFY]` `src/app/api/gallery/route.ts`
    - Sửa truy vấn Supabase tại dòng 95 từ `conversations!inner(user_id, model)` thành `conversations!messages_conversation_id_fkey!inner(user_id, model)` để khắc phục triệt để lỗi PostgREST `PGRST201`.
    - Sử dụng `paginateAndMapGalleryRows(rawRows, limit, decryptText)` từ `@/lib/features/gallery/galleryMapper` và `decryptText` từ `@/lib/core/encryption`.
12. `[MODIFY]` `src/app/api/gallery/route.test.ts`
    - Bổ sung assertion kiểm tra `chain.select` được gọi với chuỗi chứa `"conversations!messages_conversation_id_fkey!inner"`.
    - Bổ sung test case kiểm tra `meta.editPrompt` được map chính xác vào `prompt` khi `meta.prompt` không có.
13. `[MODIFY]` `src/app/api/gallery/[id]/route.ts`
    - Sửa truy vấn Supabase tại dòng 48 từ `conversations!inner(user_id)` thành `conversations!messages_conversation_id_fkey!inner(user_id)` để chức năng xóa ảnh trong Gallery không bị lỗi `PGRST201` (HTTP 404/500).
14. `[MODIFY]` `src/lib/features/chat/messages.ts`
    - Sửa truy vấn tại dòng 395 và 505 từ `conversations!inner(user_id)` thành `conversations!messages_conversation_id_fkey!inner(user_id)` để bảo vệ các thao tác cập nhật/xóa message khỏi lỗi `PGRST201`.
15. `[MODIFY]` `src/app/api/admin/stats/route.ts`
    - Sửa truy vấn tại dòng 31–34 từ `.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true })` thành `.from("messages").select("id, conversations!messages_conversation_id_fkey!inner(user_id)", { count: "exact", head: true })` để tránh lỗi `PGRST201`.
16. `[MODIFY]` `src/app/features/gallery/components/hooks/useGalleryController.ts`
    - Khởi tạo `const [hasMore, setHasMore] = useState(false)` thay vì `true` để sentinel không xuất hiện trước khi trang đầu tiên tải xong.
    - Thêm `const isFetchingMoreRef = useRef(false)` (chỉ dùng để chặn gọi trùng khi `isLoadMore === true`) và `const requestIdRef = useRef(0)` (dùng để nhận diện request mới nhất, tránh race condition khi người dùng bật/tắt bộ lọc `showFavoritesOnly` trong lúc request trước chưa hoàn tất):
      - Ở đầu `fetchImages(isLoadMore = false)`:
        - Nếu `isLoadMore`: nếu `isFetchingMoreRef.current` đang là `true` thì `return;` ngay; ngược lại đặt `isFetchingMoreRef.current = true` và `setLoadingMore(true)`.
        - Nếu `!isLoadMore`: tăng `requestIdRef.current += 1`, đặt `isFetchingMoreRef.current = false`, `setLoadingMore(false)`, `setLoading(true)`, `setOffset(0)`.
        - Lưu `const currentRequestId = requestIdRef.current;`.
      - Khi nhận phản hồi từ `fetch`:
        - Nếu `currentRequestId !== requestIdRef.current` (request đã bị thay thế bởi lần đổi bộ lọc mới hơn) thì `return;` ngay, không ghi đè state.
        - Nếu `!res.ok`: gọi `setHasMore(false)` và hiển thị `toast.error(t("galleryLoadFailed"))`.
        - Nếu `res.ok`: tính `const nextHasMore = Boolean(data.hasMore) && newImages.length > 0; setHasMore(nextHasMore);`.
      - Trong `catch (error)`: nếu `currentRequestId === requestIdRef.current`, gọi `setHasMore(false)` và `toast.error(t("galleryLoadFailed"))`.
      - Trong `finally`: nếu `isLoadMore`, đặt `isFetchingMoreRef.current = false` và `setLoadingMore(false)`; nếu `currentRequestId === requestIdRef.current && !isLoadMore`, đặt `setLoading(false)`.
      - Cập nhật dependency array của `fetchImages` thành `[offset, showFavoritesOnly, t]`.
    - Trong `handleDelete` (dòng 272, tại dòng 291 và 295): thay chuỗi hardcode `"Failed to delete image"` bằng `t("galleryDeleteFailed")`.
17. `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx`
    - Chỉ render phần tử sentinel `<div ref={g.loadMoreRef}>` khi `!g.loading && g.hasMore && g.filteredImages.length > 0` (dòng 256).
    - Thay các chuỗi hardcode `"images"` (dòng 136) và `"Scroll to load more..."` (dòng 261) bằng `t("galleryImagesCount")` và `t("galleryScrollForMore")`.
18. `[MODIFY]` `docs/lessons-learned.md`
    - Ghi nhận bài học kỹ thuật về PostgREST `PGRST201` khi bảng có nhiều khóa ngoại song song và lỗi CSS scrollport overflow khi dùng `absolute -inset-px` bên trong container có `overflow-y: auto`.
19. `[MODIFY]` `docs/CHANGELOG.md`
    - Ghi nhận bản sửa lỗi Gallery `PGRST201` + Infinite Scroll Loop và Delete Confirmation Modal overflow/translation theo đúng quy định tại `.agents/rules/02-quality.md`.

---

### 6. Các Bước Thực Hiện Tuần Tự (Implementation Checklist)

- [ ] **Bước 1 — Bổ sung khóa dịch thuật song ngữ (`en.ts` & `vi.ts`)**:
  - Thêm `studioDeleteProjectTitle`, `galleryLoadFailed`, `galleryDeleteFailed`, `galleryScrollForMore`, `galleryImagesCount` vào cả `src/lib/utils/translations/en.ts` và `src/lib/utils/translations/vi.ts`.
- [ ] **Bước 2 — Khắc phục lỗi giao diện Delete Confirmation Modal & Scrollbar (`dialog.tsx`, `alert-dialog.tsx`, `confirm-dialog.tsx`, `ChatModalsSection.tsx`, `base.css`, `useImageGenStudio.ts`)**:
  - Thêm `overflow-x-hidden` vào `DialogContent` (`src/components/ui/dialog.tsx`) và `AlertDialogContent` (`src/components/ui/alert-dialog.tsx`).
  - Xóa thẻ `<div ... className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl" />` trong `src/components/ui/confirm-dialog.tsx` (khi `isDanger` là `true`) và `src/app/features/chat/components/ChatModalsSection.tsx`; thay bằng shadow glow trực tiếp trên `DialogContent`.
  - Cập nhật `src/app/styles/themes/_shared/base.css` thêm `height: 6px;` cho `::-webkit-scrollbar` và `background: transparent;` cho `::-webkit-scrollbar-corner`.
  - Cập nhật `handleDeleteProject` trong `src/app/features/image-gen/components/hooks/useImageGenStudio.ts` dùng `t("studioDeleteProjectTitle")`.
- [ ] **Bước 3 — Tạo module `galleryMapper.ts` và unit test `galleryMapper.test.ts`**:
  - Viết `src/lib/features/gallery/galleryMapper.ts` chứa `isCiphertextHex`, `resolveMessageContent`, và `paginateAndMapGalleryRows` bám sát 100% cấu trúc `meta` JSONB của `src/app/api/gallery/route.ts`.
  - Viết `src/lib/features/gallery/galleryMapper.test.ts` kiểm thử toàn diện các trường hợp dữ liệu.
- [ ] **Bước 4 — Sửa lỗi PostgREST `PGRST201` tại các API Routes và Chat Feature (`gallery/route.ts`, `gallery/route.test.ts`, `gallery/[id]/route.ts`, `messages.ts`, `admin/stats/route.ts`)**:
  - Cập nhật `conversations!inner` thành `conversations!messages_conversation_id_fkey!inner` tại `src/app/api/gallery/route.ts`, `src/app/api/gallery/[id]/route.ts`, `src/lib/features/chat/messages.ts`, và `src/app/api/admin/stats/route.ts` (`.select("id, conversations!messages_conversation_id_fkey!inner(user_id)", { count: "exact", head: true })`).
  - Tích hợp `paginateAndMapGalleryRows` vào `src/app/api/gallery/route.ts` và bổ sung test assertions vào `src/app/api/gallery/route.test.ts`.
- [ ] **Bước 5 — Khắc phục lỗi Infinite Scroll Loop & Race Condition trên Gallery UI (`useGalleryController.ts` & `GalleryView.tsx`)**:
  - Cập nhật `useGalleryController.ts`: khởi tạo `hasMore = false`, dùng `isFetchingMoreRef` + `requestIdRef`, đặt `setHasMore(false)` kèm `toast.error(t("galleryLoadFailed"))` khi request lỗi, dùng `t("galleryDeleteFailed")` trong `handleDelete`.
  - Cập nhật `GalleryView.tsx`: chỉ hiển thị sentinel `loadMoreRef` khi `!g.loading && g.hasMore && g.filteredImages.length > 0`, dùng `t("galleryImagesCount")` và `t("galleryScrollForMore")`.
- [ ] **Bước 6 — Cập nhật Living Documentation & Chạy Verification**:
  - Cập nhật `docs/lessons-learned.md` và `docs/CHANGELOG.md`.
  - Chạy `npm run verify` (`type-check && lint && test:run`) đảm bảo pass 100%.

---

### 7. Adversarial Mental Simulation & Timelines

#### Timeline 1: Mở Modal Xóa Dự Án trong Image Studio (`ConfirmDialogHost`)

- `t=0ms`: Người dùng nhấn nút xóa project trên sidebar của Image Studio (`handleDeleteProject` trong `useImageGenStudio.ts`).
- `t=1ms`: `confirm()` được gọi với `title: t("studioDeleteProjectTitle")` (`"Delete this project?"` / `"Xóa dự án này?"`), `description: t("studioDeleteProjectDesc")`, `variant: "danger"`.
- `t=5ms`: `ConfirmDialogHost` tính `isDanger = true`, render `DialogContent` với `max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden` và shadow ngoài `shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--danger)_25%,transparent)]`. Không còn phần tử con `absolute -inset-px`.
- `t=10ms`: Trình duyệt tính toán kích thước: `scrollWidth === clientWidth` và `scrollHeight === clientHeight`. Không có thanh cuộn dọc hay ngang nào được kích hoạt, không còn hộp đỏ lệch góc trên-trái, tiêu đề và mô tả khớp hoàn toàn với ngữ cảnh dự án.

#### Timeline 2: Truy cập `/gallery`, đổi bộ lọc Favorites khi đang tải, hoặc khi mạng/API gặp sự cố

- **Trường hợp 2A (Happy Path — Có dữ liệu ảnh)**:
  - `t=0ms`: `useGalleryController` khởi tạo với `loading = true`, `hasMore = false`, `images = []`. Sentinel `loadMoreRef` không render.
  - `t=5ms`: `fetchImages(false)` tăng `requestIdRef.current = 1`, gửi `GET /api/gallery?limit=20&offset=0`.
  - `t=30ms`: `/api/gallery` thực thi truy vấn Supabase với `conversations!messages_conversation_id_fkey!inner(user_id, model)` và `.range(0, 20)` (lấy tối đa 21 dòng). PostgREST 14.5 xác định đúng khóa ngoại `messages_conversation_id_fkey`.
  - `t=35ms`: `paginateAndMapGalleryRows` tính `hasMore = rawRows.length > limit`, cắt `items = rawRows.slice(0, limit)`, trích xuất `url` (`meta.imageUrl || meta.attachment?.url`) cùng `prompt` (`meta.prompt || meta.editPrompt || resolveMessageContent(msg.content, decryptText)`). Route trả về HTTP 200 `{ images, hasMore }`.
  - `t=40ms`: `useGalleryController` kiểm tra `currentRequestId === requestIdRef.current` (`1 === 1`), cập nhật `images`, `hasMore = Boolean(data.hasMore) && newImages.length > 0`, `loading = false`. Ảnh hiển thị đầy đủ trên lưới Masonry.
- **Trường hợp 2B (Concurrency Path — Người dùng bật bộ lọc Favorites ở `t=15ms` khi request đầu chưa xong)**:
  - `t=0ms`: Mount gọi `fetchImages(false)` (`showFavoritesOnly = false`) -> `requestIdRef.current = 1`.
  - `t=15ms`: Người dùng bấm nút Favorites (`showFavoritesOnly = true`) -> `useEffect` gọi `fetchImages(false)`. Vì `isLoadMore === false`, hàm không bị chặn bởi `isFetchingMoreRef`, tăng `requestIdRef.current = 2` và gửi `GET /api/gallery?limit=20&offset=0&favorites=true`.
  - `t=30ms`: Request 1 (`favorites=false`) trả về kết quả muộn. Do `currentRequestId (1) !== requestIdRef.current (2)`, kết quả cũ bị loại bỏ an toàn.
  - `t=45ms`: Request 2 (`favorites=true`) hoàn tất. Do `currentRequestId (2) === requestIdRef.current (2)`, state `images` được cập nhật đúng với danh sách ảnh yêu thích.
- **Trường hợp 2C (Failure Path — API trả về HTTP 500 hoặc mất mạng)**:
  - `t=0ms`: `fetchImages(false)` gửi `GET /api/gallery?limit=20&offset=0`.
  - `t=20ms`: API trả về HTTP 500 (`!res.ok`).
  - `t=21ms`: `fetchImages` gọi `setHasMore(false)` và `toast.error(t("galleryLoadFailed"))`, sau đó đặt `loading = false`.
  - `t=25ms`: `GalleryView` hiển thị trạng thái `"No images found."`. Vì `g.hasMore === false` và `g.filteredImages.length === 0`, phần tử sentinel `loadMoreRef` **không được render**, `IntersectionObserver` không được gắn, chấm dứt hoàn toàn vòng lặp vô tận và hiện tượng nhấp nháy.

---

### 8. Test Contract & Co-Located Verification Plan

#### 8.1. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc cho `@qa`)

| ID        | Mục tiêu kiểm thử                                                                                                                                                 | Input                                                                                                                                                                                                                                                                                                                  | Expected Output                                                                                                                                                                                                                                | Failure Mode / Boundary Condition                                                                                                                                                                 | Tiêu chí Pass / Fail                                                                              |
| :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------ |
| **TC-01** | `paginateAndMapGalleryRows` trích xuất đúng ảnh từ `meta.imageUrl` và `meta.attachment.url`                                                                       | Mảng `GalleryMessageRow` gồm: Row 1 có `meta: { type: "image_gen", imageUrl: "https://cdn/1.png", prompt: "Cyberpunk city", originalOptions: { aspectRatio: "16:9", style: "vivid", model: "gemini-3.1-flash-image" } }`; Row 2 có `meta: { attachment: { url: "https://cdn/2.png" } }`, `content: "Attachment image"` | `images` gồm 2 phần tử: Phần tử 1 có `url: "https://cdn/1.png"`, `prompt: "Cyberpunk city"`, `aspectRatio: "16:9"`, `style: "vivid"`, `model: "gemini-3.1-flash-image"`; Phần tử 2 có `url: "https://cdn/2.png"`, `prompt: "Attachment image"` | Dòng có `meta: { type: "text" }` (không có `imageUrl` hay `attachment.url`) phải bị loại bỏ khỏi `images`                                                                                         | Pass nếu mọi trường khớp chính xác 100% và dòng thiếu URL bị lọc bỏ.                              |
| **TC-02** | `paginateAndMapGalleryRows` & `resolveMessageContent` xử lý đúng thứ tự ưu tiên `meta.prompt -> meta.editPrompt -> msg.content` (cả plaintext lẫn ciphertext hex) | Row 1 có `meta: { imageUrl: "https://cdn/1.png", editPrompt: "Make it sunset" }`, `content: "Edited Image: Make it sunset"`; Row 2 có `meta: { imageUrl: "https://cdn/2.png" }`, `content: "0123456789abcdef01234567:0123456789abcdef0123456789abcdef:deadbeef"` (ciphertext GCM hex)                                  | Row 1 có `prompt === "Make it sunset"`; Row 2 gọi `decryptFn` trả về `"Decrypted prompt"` (hoặc nếu `decryptFn` ném lỗi / trả về `""` thì `prompt === ""`, tuyệt đối không trả về chuỗi hex ciphertext)                                        | Nếu `msg.content` là plaintext có chứa dấu `:` (như `"Edited Image: Sunset"`), `isCiphertextHex` trả về `false` và giữ nguyên plaintext mà không gọi `decryptFn` (bảo toàn 100% dưới `happy-dom`) | Pass nếu không lộ chuỗi hex khi lỗi giải mã và không mất plaintext dưới `happy-dom`.              |
| **TC-03** | `paginateAndMapGalleryRows` tính đúng `hasMore` và cắt `slice(0, limit)` theo cơ chế `range(offset, offset + limit)` (`limit + 1` dòng)                           | Case A: `rawRows` có 21 dòng hợp lệ, `limit = 20`; Case B: `rawRows` có 20 dòng hợp lệ, `limit = 20`; Case C: `rawRows` có 0 dòng, `limit = 20`                                                                                                                                                                        | Case A: `hasMore === true` và `images.length === 20`; Case B: `hasMore === false` và `images.length === 20`; Case C: `hasMore === false` và `images.length === 0`                                                                              | Khi `rawRows.length === limit + 1`, phần tử thứ `limit + 1` chỉ dùng để xác định `hasMore = true` và không được lọt vào `images` của trang hiện tại                                               | Pass nếu `hasMore` và độ dài mảng `images` khớp tuyệt đối ở cả 3 cases.                           |
| **TC-04** | `GET /api/gallery` sử dụng FK disambiguation `conversations!messages_conversation_id_fkey!inner`                                                                  | Gọi `GET /api/gallery?limit=20&offset=0` trong `src/app/api/gallery/route.test.ts`                                                                                                                                                                                                                                     | `chain.select` được gọi với chuỗi chứa `"conversations!messages_conversation_id_fkey!inner"` và trả về HTTP 200                                                                                                                                | Không còn bất kỳ truy vấn `.select` nào giữa `messages` và `conversations` dùng `conversations!inner` không tường minh                                                                            | Pass khi toàn bộ suite `src/app/api/gallery/route.test.ts` pass.                                  |
| **TC-05** | Song ngữ `en.ts` và `vi.ts` đồng bộ khóa mới                                                                                                                      | Kiểm tra các khóa `studioDeleteProjectTitle`, `galleryLoadFailed`, `galleryDeleteFailed`, `galleryScrollForMore`, `galleryImagesCount`                                                                                                                                                                                 | Tồn tại và là chuỗi khác rỗng trong cả `en` và `vi`                                                                                                                                                                                            | Thiếu khóa ở 1 trong 2 ngôn ngữ sẽ làm gãy type `_AssertTranslationsParity` trong `src/lib/utils/translations/index.ts`                                                                           | Pass khi `npm run type-check` và `src/lib/utils/translations/index.test.ts` trả về exit code `0`. |

#### 8.2. Kế Hoạch Kiểm Thử Co-Located & Lệnh Xác Minh

- **Co-located Unit Test Files**:
  - `src/lib/features/gallery/galleryMapper.test.ts` (đặt cạnh `src/lib/features/gallery/galleryMapper.ts`).
  - `src/app/api/gallery/route.test.ts` (cập nhật bổ sung assertion cho FK disambiguation và `meta.editPrompt`).
- **Lệnh kiểm thử bắt buộc**:
  ```bash
  npm run verify
  ```
  _(Thực thi tuần tự `npm run type-check && npm run lint && npm run test:run`, tất cả phải đạt exit code `0`)._

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risk Mitigation)

| Rủi ro                                                                                                                                                                                                                                                                                                                                                      | Mức độ     | Phương án phòng ngừa (Ánh xạ tới Technical Control trong Code)                                                                                                                                                                                                                                                                                                                                                                                                        |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**: `msg.content` trong bảng `messages` có thể là bản mã AES-256-GCM (`24-hex:32-hex:hex`), AES-256-CBC cũ (`32-hex:hex`), hoặc plaintext (có thể chứa dấu `:` như `"Edited Image: ..."`). Ngoài ra, trong môi trường Vitest (`happy-dom`), `typeof window !== "undefined"` khiến `decryptText` trong `src/lib/core/encryption.ts:78` luôn trả về `""`. | Trung bình | Trong `src/lib/features/gallery/galleryMapper.ts`, hàm `resolveMessageContent` kiểm tra `isCiphertextHex(content)` (`/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i` hoặc `/^[0-9a-f]{32}:[0-9a-f]+$/i`) trước khi gọi `decryptFn`. Nếu là plaintext thì trả về nguyên bản (không gọi `decryptText`, bảo toàn 100% trên cả server lẫn `happy-dom`). Nếu là ciphertext hex mà giải mã ném lỗi hoặc trả về rỗng thì fallback về `""` (không bao giờ trả chuỗi hex rác ra UI). |
| **R2**: Một trang `messages` (`limit` dòng) trả về từ DB đều bị hỏng URL (`meta.imageUrl` và `meta.attachment.url` đều rỗng), dẫn đến `newImages.length === 0` dù `rawRows.length > limit`, gây lặp phân trang ở phía client.                                                                                                                               | Trung bình | Phía server (`galleryMapper.ts`) tính `hasMore = rawRows.length > limit` và cắt `rawRows.slice(0, limit)`. Phía client (`useGalleryController.ts`) áp dụng thêm chốt chặn `const nextHasMore = Boolean(data.hasMore) && newImages.length > 0; setHasMore(nextHasMore);` để dừng phân trang ngay khi batch trả về 0 ảnh hợp lệ.                                                                                                                                        |
| **R3**: Người dùng bấm chuyển đổi bộ lọc `showFavoritesOnly` liên tục khi request trước đang bay (in-flight), gây race condition hoặc bị chặn nếu dùng cờ khóa cứng.                                                                                                                                                                                        | Trung bình | Trong `useGalleryController.ts`, tách riêng `isFetchingMoreRef` (chỉ chặn trùng cho `isLoadMore === true`) và `requestIdRef` (tăng mỗi khi `isLoadMore === false`, kiểm tra `currentRequestId === requestIdRef.current` trước khi setState) để request đổi bộ lọc mới luôn được thực thi và vô hiệu hóa kết quả trả về muộn của request cũ.                                                                                                                           |
| **R4**: Các modal khác sử dụng `DialogContent` hoặc `AlertDialogContent` trên màn hình nhỏ cần cuộn dọc khi nội dung quá dài.                                                                                                                                                                                                                               | Thấp       | Giữ nguyên `max-h-[calc(100dvh-2rem)] overflow-y-auto` để đảm bảo khả năng cuộn dọc trên màn hình nhỏ, chỉ thêm `overflow-x-hidden` và loại bỏ phần tử con `-inset-px` tràn khung.                                                                                                                                                                                                                                                                                    |

---

## Audit History

### Audit Run 1 — 2026-10-14 (`@reviewer` Fallback)

`[REVIEWER_MODEL: gemini-4-argon]`

#### 1. Kiểm Chứng Lỗi Cũ

Đây là lượt thẩm định đầu tiên (Audit Run 1) đối với Revision 1 của kế hoạch, chưa có danh sách lỗi cũ từ các lượt trước.

#### 2. Phát Hiện Mới

| Mã     | Mức độ      | Vị trí trong Plan                                                                                       | Phân tích & Bằng chứng trên mã nguồn thật (`[SRC]` / `[CMD]` / `[ADV]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Yêu cầu chỉnh sửa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :----- | :---------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | `[BLOCKER]` | Mục 1 (dòng 31), Mục 3 (dòng 65–66), Mục 5.1–5.2 (dòng 92–97), Mục 8.1 (`TC-01`..`TC-04`, dòng 207–210) | **Sai lệch Schema DB và hợp đồng dữ liệu của `galleryMapper.ts` / `GET /api/gallery`**:<br>1. Plan giả định bảng `messages` có cột `file_attachments` (chứa `{ type: "generated-image", url, storagePath, mimeType }`), cột `metadata`, và bảng `image_gen_items`. Thực tế khảo sát `[SRC]` `src/types/database.types.ts:452-460` và `docs/database-schema.md:60-67` cho thấy bảng `messages` chỉ có các cột `id`, `conversation_id`, `role`, `content`, `meta`, `created_at` (không có cột `file_attachments`, không có cột `metadata`, không có bảng `image_gen_items`).<br>2. Khảo sát `[SRC]` `src/app/api/gallery/route.ts:16-42, 88-140`, `src/app/api/generate-image/route.ts:332-357`, `src/app/api/edit-image/route.ts:226-241`, `src/app/api/edit-image-multi/route.ts:347-364` và `src/app/api/gallery/route.test.ts:120-159`: dữ liệu ảnh được lưu trong cột JSONB `meta` với cấu trúc `{ type?: "image_gen" \| "image_edit", imageUrl?: string, prompt?: string, editPrompt?: string, attachment?: { url?: string, storagePath?: string, mimeType?: string, filename?: string }, originalOptions?: { aspectRatio?: string, resolution?: string, style?: string, model?: string } }`. Nếu cài đặt `extractGeneratedImageRows` lọc theo `file_attachments` kiểu `"generated-image"` như mô tả tại Mục 5.1 và `TC-01`/`TC-03`, hàm sẽ loại bỏ toàn bộ bản ghi thật trong DB và làm hỏng test suite `src/app/api/gallery/route.test.ts`.<br>3. Về phân trang: `[SRC]` `src/app/api/gallery/route.ts:114, 121-123` dùng `query.range(offset, offset + limit)` (lấy `limit + 1` dòng) và tính `hasMore = rawRows.length > limit` kèm `items = hasMore ? rawRows.slice(0, limit) : rawRows`. Nếu `computeGalleryHasMore` tính `rawRowCount === limit` như Mục 5.1 (dòng 95) và `TC-04` (dòng 210), khi DB trả về `limit + 1` dòng (ví dụ 21 dòng cho `limit=20` tại `src/app/api/gallery/route.test.ts:502-506` hoặc 3 dòng cho `limit=2` tại `route.test.ts:525-530`), `hasMore` sẽ trả về `false` sai lệch. | Sửa lại Mục 1, Mục 3, Mục 5.1–5.2 (`galleryMapper.ts`, `galleryMapper.test.ts`), Mục 8.1 (`TC-01`..`TC-04`) và Mục 9 (`R2`) bám đúng cấu trúc `MessageRow` thật của `src/app/api/gallery/route.ts`:<br>- URL lấy từ `meta?.imageUrl \|\| meta?.attachment?.url \|\| ""`, lọc các dòng có `url` khác rỗng.<br>- Prompt lấy theo thứ tự ưu tiên: `meta?.prompt \|\| meta?.editPrompt \|\| decryptContent(msg.content) \|\| ""`.<br>- Metadata lấy từ `meta?.originalOptions?.aspectRatio`, `meta?.originalOptions?.style`, `meta?.originalOptions?.model` (fallback sang `conversations.model` nếu cần).<br>- `computeGalleryHasMore(rawRowCount, limit)` phải kiểm tra `rawRowCount > limit` (tương ứng với `query.range(offset, offset + limit)` lấy `limit + 1` dòng, và chỉ map trên `rawRows.slice(0, limit)`). |
| **F2** | `[MAJOR]`   | Mục 5.14 (dòng 135–136), Mục 6 Bước 4 (dòng 167)                                                        | **Sai nội dung truy vấn tại `src/app/api/admin/stats/route.ts:33`**:<br>Plan ghi sửa từ `messages!inner(count)` thành `messages!messages_conversation_id_fkey!inner(count)`. Tuy nhiên, khảo sát `[SRC]` `src/app/api/admin/stats/route.ts:31-35` cho thấy truy vấn thực tế là `.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true }).eq("conversations.user_id", canonicalEmail)`. Truy vấn xuất phát từ bảng `messages` và join sang `conversations`, không phải `messages!inner(count)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Sửa Mục 5.14 và Mục 6 Bước 4: tại `src/app/api/admin/stats/route.ts:33`, đổi `.select("id, conversations!inner(user_id)", { count: "exact", head: true })` thành `.select("id, conversations!messages_conversation_id_fkey!inner(user_id)", { count: "exact", head: true })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **F3** | `[MAJOR]`   | Mục 5.11 (dòng 130), Mục 9 Rủi ro R1 (dòng 227)                                                         | **Sai giả định về `decryptText` trong `src/lib/core/encryption.ts` gây lỗi dưới `happy-dom` và nguy cơ lộ chuỗi hex khi bản mã lỗi**:<br>1. Plan (R1, dòng 227) khẳng định `decryptText` kiểm tra prefix `enc:v1:`. Khảo sát `[SRC]` `src/lib/core/encryption.ts:48-126` cho thấy `encryptText`/`decryptText` không dùng prefix `enc:v1:`; định dạng thật là `24-hex:32-hex:hex` (GCM) hoặc `32-hex:hex` (CBC cũ) (xem `[SRC]` `src/lib/features/chat/messages.ts:81-84`).<br>2. Tại `[SRC]` `src/lib/core/encryption.ts:78-81`: `if (typeof window !== "undefined") return "";`. Do `[SRC]` `vitest.config.ts:8` đặt `environment: "happy-dom"`, `typeof window !== "undefined"` là `true` khi chạy Vitest. Trong `src/app/api/gallery/route.test.ts` (nơi không mock `@/lib/core/encryption`), nếu gọi `decryptText(msg.content)` trực tiếp cho plaintext (như `SAMPLE_MESSAGES[2].content = "Attachment image"` khi không có `meta.prompt`), `decryptText` sẽ trả về `""` làm mất prompt.<br>3. Trên môi trường server, nếu `msg.content` là ciphertext hex bị hỏng (corrupted ciphertext), logic `try { return decryptText(cipher); } catch { return cipher; }` trong R1 sẽ trả nguyên chuỗi hex rác ra UI. Ngược lại, nếu `msg.content` là plaintext có dấu `:` (như `"Generated Image: ..."` hoặc `"Edited Image: ..."`), `decryptText` sẽ ném lỗi tại `encryption.ts:114-115` và ghi log `encryptionLogger.error` không cần thiết.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Thiết kế hàm giải mã an toàn kiểm tra định dạng ciphertext trước khi gọi `decryptText` (tương tự `decryptMetaReasoning` tại `src/lib/features/chat/messages.ts:81-90`):<br>- Kiểm tra regex ciphertext hex (`/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i` hoặc `/^[0-9a-f]{32}:[0-9a-f]+$/i`).<br>- Nếu khớp regex ciphertext: gọi `decryptText`, nếu lỗi hoặc trả về rỗng (ví dụ trong môi trường không có key/client) thì fallback về `""` (không trả về chuỗi hex).<br>- Nếu không khớp regex ciphertext (tức là plaintext): trả về trực tiếp chuỗi plaintext mà không gọi `decryptText`.                                                                                                                                                                                                                          |
| **F4** | `[MAJOR]`   | Mục 5.15 (dòng 139–144), Mục 6 Bước 5 (dòng 170)                                                        | **Race condition khi đổi bộ lọc `showFavoritesOnly` do `isFetchingRef` chặn cứng và sai tên hàm xóa ảnh trong `useGalleryController.ts`**:<br>1. Khảo sát `[SRC]` `src/app/features/gallery/components/hooks/useGalleryController.ts:85-128`: `fetchImages(false)` được gọi khi mount và khi `showFavoritesOnly` đổi giá trị (`useEffect` dòng 126–128). Nếu `isFetchingRef.current` chặn mọi lời gọi `fetchImages` khi đang `true`, trường hợp người dùng bấm nút lọc Favorites (`GalleryView.tsx:116`) ngay khi request tải trang đầu chưa xong sẽ khiến lời gọi `fetchImages(false)` mới bị bỏ qua, làm lệch trạng thái giữa bộ lọc UI và dữ liệu hiển thị.<br>2. Mục 5.15 (dòng 144) ghi sửa trong hàm `confirmDelete`, nhưng khảo sát `[SRC]` `src/app/features/gallery/components/hooks/useGalleryController.ts:272-301` cho thấy hàm thực tế tên là `handleDelete` (có 2 chỗ gọi `toast.error("Failed to delete image")` tại dòng 291 và 295, và `t` đã có trong dependency array `[t]` tại dòng 300).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1. Trong `useGalleryController.ts`: chỉ chặn re-entrant bằng `isFetchingRef.current` đối với nhánh cuộn tải thêm (`if (isLoadMore && isFetchingRef.current) return;`), còn với `isLoadMore === false` (tải lại từ đầu/đổi bộ lọc) thì dùng `requestIdRef` (tăng bộ đếm request) hoặc `AbortController` để vô hiệu hóa kết quả của request cũ khi request mới được phát đi.<br>2. Sửa tên hàm trong Mục 5.15 từ `confirmDelete` thành `handleDelete` (dòng 272, 291, 295) và thêm `t` vào dependency array của `fetchImages` khi dùng `toast.error(t("galleryLoadFailed"))`.                                                                                                                                                                                                                                        |
| **F5** | `[MAJOR]`   | Mục 5 (dòng 89–150), Mục 6 Bước 6 (dòng 172–175)                                                        | **Thiếu cập nhật `docs/CHANGELOG.md` và thiếu cập nhật unit test route cho disambiguation FK**:<br>1. Theo `.agents/rules/02-quality.md` và `docs/CHANGELOG.md:3`, mọi task thay đổi code phải cập nhật `docs/CHANGELOG.md`. Danh sách `[MODIFY]` của plan mới có `docs/lessons-learned.md`, thiếu `docs/CHANGELOG.md`.<br>2. Các file test hiện hữu (`src/app/api/gallery/route.test.ts`, `src/app/api/gallery/[id]/route.test.ts`, `src/lib/features/chat/messages.test.ts`, `src/app/api/admin/stats/route.test.ts`) chưa có assertion kiểm tra chuỗi `.select(...)` dùng `conversations!messages_conversation_id_fkey!inner`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 1. Bổ sung `[MODIFY] docs/CHANGELOG.md` vào Mục 5 và Mục 6 Bước 6.<br>2. Bổ sung `[MODIFY] src/app/api/gallery/route.test.ts` (và/hoặc các test liên quan) để assert `.select` gọi đúng `conversations!messages_conversation_id_fkey!inner` và kiểm thử tích hợp `editPrompt` tại route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **F6** | `[MINOR]`   | Mục 5.5 (dòng 106)                                                                                      | **Tên biến trong `src/components/ui/confirm-dialog.tsx`**:<br>Mục 5.5 ghi `khi state.variant === "danger"`, trong khi `[SRC]` `src/components/ui/confirm-dialog.tsx:29-30, 46` đặt tên biến là `isDanger` (`const variant = options?.variant ?? "default"; const isDanger = variant === "danger";`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Đồng bộ mô tả tại Mục 5.5 theo đúng biến `isDanger` trong `src/components/ui/confirm-dialog.tsx:30, 46`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

#### 3. Mental Simulation Verification Matrix

| Kịch bản                                     | Trạng thái | Loại bằng chứng   | Chi tiết kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :------------------------------------------- | :--------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | `PASS`     | `[CMD]` + `[SRC]` | Đã chạy `npm run verify` (`tsc --noEmit`, `eslint .`, `vitest run`) đạt exit code `0` (116 test files, 1266 tests pass). Kiểm tra `package.json:38-118` xác nhận đúng hệ sinh thái thư viện hiện hành, không dùng công cụ ngoại lai, không phát sinh biến môi trường mới.                                                                                                                                                                                          |
| **S2: Runner Lifecycle & Teardown**          | `FAIL`     | `[SRC]` + `[ADV]` | Phần sửa `IntersectionObserver` trong `useGalleryController.ts` đã ngắt vòng lặp khi lỗi (`setHasMore(false)`), nhưng cơ chế `isFetchingRef` chặn cứng toàn bộ `fetchImages` gây race condition khi người dùng bật/tắt `showFavoritesOnly` lúc request đầu đang chạy (**F4**).                                                                                                                                                                                     |
| **S3: Database & Temporal Logic**            | `FAIL`     | `[SRC]` + `[URL]` | Cú pháp disambiguation `conversations!messages_conversation_id_fkey!inner` là hợp lệ cho PostgREST 14.5 (`src/types/database.types.ts:13, 95, 479`), nhưng plan mô tả sai cột bảng `messages` (`file_attachments`, `metadata`), sai logic `computeGalleryHasMore` so với `query.range(offset, offset + limit)` (**F1**), và sai câu truy vấn trong `src/app/api/admin/stats/route.ts:33` (**F2**).                                                                 |
| **S4: Cross-Task State Flow**                | `FAIL`     | `[SRC]`           | Đối chiếu `src/app/api/generate-image/route.ts:332-357`, `src/app/api/edit-image/route.ts:226-241`, `src/app/api/edit-image-multi/route.ts:347-364` với `src/app/api/gallery/route.ts:16-42, 125-140` phát hiện lệch cấu trúc JSONB (`meta` vs `file_attachments`/`metadata`) (**F1**) và lệch cơ chế `decryptText` dưới môi trường `happy-dom` (**F3**).                                                                                                          |
| **S5: Security Boundary & 3-Tier Auth**      | `FAIL`     | `[SRC]` + `[ADV]` | Các route `/api/gallery`, `/api/gallery/[id]`, `/api/admin/stats` đều xác thực qua `auth()` và kiểm tra `conversations.user_id`. Tuy nhiên, phương án `safeDecrypt` trong R1 (`catch { return cipher; }`) có nguy cơ trả thẳng chuỗi hex ciphertext hỏng ra client thay vì lọc bỏ như `decryptMetaReasoning` trong `src/lib/features/chat/messages.ts:81-88` (**F3**).                                                                                             |
| **S6: External Resilience & Serverless Cap** | `PASS`     | `[SRC]`           | Khi `/api/gallery` trả lỗi 500 hoặc đứt kết nối mạng, `useGalleryController.ts` đặt `setHasMore(false)`, hiển thị `toast.error(t("galleryLoadFailed"))` và ẩn sentinel `loadMoreRef` khi `filteredImages.length === 0`, ngăn chặn spam request lên serverless function.                                                                                                                                                                                            |
| **Domain: Open Inquiry (Vikini)**            | `PASS`     | `[SRC]` + `[CMD]` | Kiểm tra song ngữ tại `src/lib/utils/translations/index.ts:24-34` xác nhận cơ chế kiểm tra đối xứng khóa compile-time (`MissingInVi`, `MissingInEn`). Kiểm tra CSS tại `src/components/ui/dialog.tsx:41`, `src/components/ui/confirm-dialog.tsx:52-55`, `src/app/features/chat/components/ChatModalsSection.tsx:114-117` và `src/app/styles/themes/_shared/base.css:184-190` xác nhận đúng nguyên nhân phần tử `absolute -inset-px` tràn 1px kích hoạt thanh cuộn. |

#### 4. Claim Verification

- **4.5.1 Library Claim Verification**:
  - **PostgREST `PGRST201` Disambiguation (`@supabase/supabase-js` `^2.89.0` / PostgREST `14.5`)**: Xác minh qua tài liệu PostgREST `[URL]` (https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) và `[SRC]` `src/types/database.types.ts:13, 95, 479`. Giữa `conversations` và `messages` có 2 FK: `messages_conversation_id_fkey` và `conversations_forked_from_message_id_fkey` (tạo bởi `supabase/migrations/20260916_add_conversation_branching.sql:6`). Cú pháp `conversations!messages_conversation_id_fkey!inner(...)` chỉ định tường minh FK `messages.conversation_id -> conversations.id`.
  - **CSS Overflow Module Level 3 (`overflow-y: auto`)**: Xác minh qua đặc tả W3C CSS Overflow Module Level 3 `[URL]` (https://www.w3.org/TR/css-overflow-3/#overflow-properties). Khi `overflow-y: auto` và `overflow-x` không khai báo (`visible`), computed value của `overflow-x` tự động chuyển thành `auto`. Kết hợp với phần tử con `absolute -inset-px` (`top/right/bottom/left: -1px`) tại `src/components/ui/confirm-dialog.tsx:54` và `src/app/features/chat/components/ChatModalsSection.tsx:116`, kích thước cuộn vượt 1px làm xuất hiện thanh cuộn ngang/dọc.
- **4.5.3 Enforcement Claim Verification**:
  - **Compile-time Translation Parity (`TC-05`)**: Xác minh tại `[SRC]` `src/lib/utils/translations/index.ts:24-34` (`_AssertTranslationsParity`) và unit test `[SRC]` `src/lib/utils/translations/index.test.ts:6-30`. Nếu thêm khóa vào `en.ts` mà thiếu ở `vi.ts` (hoặc ngược lại), `npm run type-check` và `index.test.ts` sẽ báo lỗi ngay lập tức.
- **4.5.4 Risk Table Audit**:
  - **R1 (Trung bình)**: Chưa đạt yêu cầu kỹ thuật — giả định sai về prefix `enc:v1:` trong `src/lib/core/encryption.ts` và fallback `return cipher` làm lộ ciphertext hex khi lỗi hoặc trả về `""` cho plaintext dưới `happy-dom` (xem **F3**).
  - **R2 (Trung bình)**: Chốt chặn `Boolean(data.hasMore) && newImages.length > 0` tại `useGalleryController.ts` là hợp lý ở phía client, nhưng logic `computeGalleryHasMore` ở phía server đang bị lệch với `query.range(offset, offset + limit)` (xem **F1**).

#### 5. Adversarial Timelines

```text
Cơ chế 1 (Trục Đồng thời / Race Condition bộ lọc): Bật/tắt bộ lọc Favorites trên GalleryView (S2, S4)
T1: GalleryView mount -> useEffect gọi fetchImages(false) với showFavoritesOnly=false; isFetchingRef.current = true.
T2: Ở t=15ms (khi request T1 chưa trả về), người dùng nhấn nút "Favorites" -> showFavoritesOnly chuyển sang true -> useEffect gọi fetchImages(false).
T3: Do isFetchingRef.current đang là true (theo thiết kế chặn toàn cục ở Mục 5.15), lời gọi fetchImages(false) ở T2 bị return sớm và bỏ qua. Ở t=50ms, request T1 hoàn tất và ghi đè images bằng danh sách không lọc.
Kết cục: Nút "Favorites" trên UI hiển thị trạng thái đang bật (màu hồng) nhưng lưới ảnh hiển thị toàn bộ ảnh không lọc → LỖI ([MAJOR] - F4).
```

```text
Cơ chế 2 (Trục TOCTOU & Ownership): Xóa ảnh qua DELETE /api/gallery/[id] (S3, S5)
T1: User A gửi DELETE /api/gallery/msg-123. Route xác thực session.user.email -> userId.
T2: Route truy vấn messages với conversations!messages_conversation_id_fkey!inner(user_id) theo id = msg-123.
T3: Nếu msg-123 thuộc conversation của User B, conversation.user_id !== userId -> ném ForbiddenError (HTTP 403) trước khi chạm tới removeOwnedStoragePaths hoặc delete().
Kết cục: Ngăn chặn xóa trái phép bản ghi và file storage của người dùng khác → AN TOÀN.
```

```text
Cơ chế 3 (Trục Thất bại giữa chừng & Dọn dẹp): Lỗi HTTP 500 hoặc đứt mạng khi tải /api/gallery (S2, S6)
T1: useGalleryController khởi tạo với loading=true, hasMore=false. Sentinel loadMoreRef không render.
T2: fetchImages(false) gọi GET /api/gallery, nhận HTTP 500 (!res.ok) hoặc network exception.
T3: Nhánh xử lý lỗi đặt setHasMore(false), gọi toast.error(t("galleryLoadFailed")), khối finally đặt loading=false, loadingMore=false.
Kết cục: GalleryView hiển thị trạng thái rỗng, điều kiện (!g.loading && g.hasMore && g.filteredImages.length > 0) là false nên sentinel không được gắn vào DOM, không kích hoạt lại IntersectionObserver → AN TOÀN.
```

```text
Cơ chế 4 (Trục Serverless / Môi trường thực thi): Giải mã msg.content trong GET /api/gallery (S4, S5)
T1: GET /api/gallery đọc các dòng messages có meta.imageUrl hoặc meta.attachment.url nhưng không có meta.prompt / meta.editPrompt.
T2: Nếu msg.content là ciphertext hỏng (24-hex:32-hex:hex) trên server hoặc là plaintext "Attachment image" khi chạy Vitest (happy-dom có typeof window !== "undefined").
T3: Với thiết kế R1 hiện tại (try { return decryptText(cipher); } catch { return cipher; }), server trả về chuỗi hex hỏng lên UI, còn Vitest trả về "" cho plaintext (do encryption.ts:78 trả về "" khi window !== "undefined").
Kết cục: Lộ chuỗi hex rác trên UI hoặc làm gãy test tại môi trường happy-dom → LỖI ([MAJOR] - F3).
```

#### 6. Commands Executed

1. `git show --stat 9ccde5274f40871e0b30da312595d3f2c98b9e8c` -> Exit code `0` (kiểm tra lịch sử refactor `/api/gallery`, `/api/admin/stats`, `messages.ts`).
2. `npm run verify` -> Exit code `0` (`tsc --noEmit` 0 errors, `eslint .` 0 errors, `vitest run` 116 test files / 1266 tests passed).
3. `git show 9ccde5274f40871e0b30da312595d3f2c98b9e8c -- src/app/api/gallery/route.ts src/app/api/admin/stats/route.ts src/app/api/gallery/[id]/route.ts src/lib/features/chat/messages.ts` -> Exit code `0` (xác minh chi tiết diff của commit `9ccde52`).
4. `node -e "...walk('src')..."` -> Exit code `0` (quét toàn bộ vị trí dùng `!inner`, `-inset-px`, `deleteConfirm`, `conversations`, `messages` trong `src/`).
5. `node -e "...walk('src')..."` -> Exit code `0` (lọc chính xác 5 vị trí dùng `!inner` và 2 vị trí dùng `absolute -inset-px`).
6. `node -e "...walk('src')..."` -> Exit code `0` (kiểm tra mọi lời gọi `.select(...)` có chứa `conversations` hoặc `messages` trên toàn codebase).
7. `npx vitest list --filesOnly` -> Exit code `0` (liệt kê toàn bộ 116 file test hiện có).
8. `node -e "...walk('src')..."` -> Exit code `0` (kiểm tra toàn bộ các component dùng `DialogContent` và `AlertDialogContent`).

#### 7. Kết Luận

Bản kế hoạch đã xác định đúng nguyên nhân gốc rễ của cả 2 lỗi (CSS scrollport overflow do `overflow-y-auto` kết hợp phần tử con `absolute -inset-px`, sai khóa dịch `deleteConfirm`, lỗi PostgREST `PGRST201` do 2 khóa ngoại giữa `messages` và `conversations`, và vòng lặp `IntersectionObserver` khi API lỗi). Tuy nhiên, phần thiết kế chi tiết cho `galleryMapper.ts`, `admin/stats/route.ts`, `safeDecrypt`, `useGalleryController.ts` và danh sách tài liệu cập nhật đang có 1 lỗi `[BLOCKER]`, 4 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` lệch với mã nguồn thật. Đề nghị `@planner` cập nhật Revision 2 theo bảng **Phát Hiện Mới** ở trên.

[CHANGES_REQUESTED]

---

### Audit Run 2 — 2026-10-14 (`@reviewer` Fallback)

`[REVIEWER_MODEL: gemini-4-argon]`

#### 1. Kiểm Chứng Lỗi Cũ

| Mã lỗi (từ Run 1) | Mức độ cũ   | Trạng thái | Bằng chứng đối chiếu trên mã nguồn thật (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :---------------- | :---------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1**            | `[BLOCKER]` | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `src/types/database.types.ts:452-460`, `src/app/api/gallery/route.ts:16-42, 114-140`, `src/app/api/generate-image/route.ts:332-357`, `src/app/api/edit-image/route.ts:226-241`, `src/app/api/edit-image-multi/route.ts:347-364` và `src/app/api/gallery/route.test.ts:120-159, 502-566`: Revision 2 (Mục 1 dòng 31–34, Mục 3 dòng 64–80, Mục 5.1–5.2 dòng 106–163, Mục 8.1 `TC-01`..`TC-03` dòng 289–291) đã định nghĩa `GalleryMessageRow` khớp với cột JSONB `meta` thực tế (`meta.imageUrl \|\| meta.attachment?.url`, `meta.prompt \|\| meta.editPrompt \|\| resolveMessageContent(msg.content)`, `meta.originalOptions.{aspectRatio, style, model}`) và tính `hasMore = rawRows.length > limit` kèm `rawRows.slice(0, limit)` khớp với `query.range(offset, offset + limit)`. |
| **F2**            | `[MAJOR]`   | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `src/app/api/admin/stats/route.ts:31-35`: Revision 2 (Mục 1 dòng 33, Mục 5.15 dòng 204–205, Mục 6 Bước 4 dòng 244) đã cập nhật đúng chuỗi truy vấn từ `.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true })` sang `.from("messages").select("id, conversations!messages_conversation_id_fkey!inner(user_id)", { count: "exact", head: true })`.                                                                                                                                                                                                                                                                                                                                                                                            |
| **F3**            | `[MAJOR]`   | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `src/lib/core/encryption.ts:48-126`, `src/lib/features/chat/messages.ts:81-90` và `vitest.config.ts:8`: Revision 2 (Mục 5.1 dòng 140–153, `TC-02` dòng 290, R1 dòng 311) đã bổ sung `isCiphertextHex` (`/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i` và `/^[0-9a-f]{32}:[0-9a-f]+$/i`) và `resolveMessageContent`: khi `content` là plaintext (kể cả có dấu `:`), hàm trả về trực tiếp plaintext mà không gọi `decryptText` (bảo toàn dữ liệu dưới môi trường `happy-dom` trong `src/app/api/gallery/route.test.ts:145`); khi `content` là ciphertext hex thì gọi `decryptFn` trong khối `try/catch` và fallback về `""` nếu lỗi hoặc rỗng, ngăn lộ chuỗi hex ra giao diện.                                                                                                           |
| **F4**            | `[MAJOR]`   | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `src/app/features/gallery/components/hooks/useGalleryController.ts:85-146, 272-301`: Revision 2 (Mục 5.16 dòng 206–220, Mục 7 Timeline 2B dòng 270–274, R3 dòng 313) đã tách riêng `isFetchingMoreRef` (chỉ chặn gọi trùng khi `isLoadMore === true`) và `requestIdRef` (tăng bộ đếm khi `isLoadMore === false`, kiểm tra `currentRequestId === requestIdRef.current` trước khi cập nhật state và trong `finally`), đồng thời sửa đúng tên hàm `handleDelete` (dòng 272, 291, 295) và dependency array `[offset, showFavoritesOnly, t]`.                                                                                                                                                                                                                                           |
| **F5**            | `[MAJOR]`   | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `docs/CHANGELOG.md:1-10` và `src/app/api/gallery/route.test.ts:309-351`: Revision 2 đã bổ sung `[MODIFY] src/app/api/gallery/route.test.ts` (Mục 5.12 dòng 197–199, `TC-04` dòng 292, Mục 8.2 dòng 298) và `[MODIFY] docs/CHANGELOG.md` (Mục 5.19 dòng 226–227, Mục 6 Bước 6 dòng 250).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **F6**            | `[MINOR]`   | `ĐÃ SỬA`   | Đối chiếu `[SRC]` `src/components/ui/confirm-dialog.tsx:29-30, 46`: Revision 2 (Mục 1 dòng 18, Mục 5.5 dòng 171–173, Mục 6 Bước 2 dòng 237) đã sử dụng đúng tên biến `isDanger`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

#### 2. Phát Hiện Mới

Không phát hiện lỗi `[BLOCKER]`, `[MAJOR]` hoặc `[MINOR]` mới trong bản kế hoạch Revision 2.

#### 3. Các Tấn Công Đã Thử

Để kiểm chứng độ vững chắc của Revision 2 trước khi cấp thẻ phê duyệt, 4 kịch bản tấn công thực nghiệm đã được thực thi trên mã nguồn thật (`[SRC]`) và qua runtime probes (`[CMD]`):

1. **Tấn công 1 — Kiểm tra xung đột `tailwind-merge` (`cn`) khi thêm `overflow-x-hidden` vào `DialogContent` (`src/components/ui/dialog.tsx:41`) và khi thêm class danger glow vào `ConfirmDialogHost` (`src/components/ui/confirm-dialog.tsx:46`)**:
   - **Giả thuyết rủi ro**: Các modal hiện hữu truyền `overflow-hidden` (`src/app/features/gallery/components/GalleryView.tsx:270`) hoặc `overflow-visible` (`src/app/components/EditImagePromptModal.tsx:31`, `src/app/components/UpgradeModal.tsx:17`) vào `DialogContent`. Nếu `tailwind-merge` không ghi đè được cặp `overflow-y-auto overflow-x-hidden` bằng shorthand `overflow-hidden` / `overflow-visible`, hoặc giữ lại cả `border-(--border)` lẫn `border-(--danger)/30`, giao diện của các modal khác sẽ bị ảnh hưởng.
   - **Bằng chứng `[SRC]` & `[CMD]`**: Đọc `src/lib/utils/cn.ts:1-7` và chạy probe `npx tsx -e` import trực tiếp hàm `cn` của dự án:
     - Với `ConfirmDialogHost` (`isDanger = true`): `cn` trả về `... overflow-y-auto overflow-x-hidden border bg-(--surface-elevated) p-6 shadow-black/40 ring-1 max-w-md border-(--danger)/30 ring-(--danger)/20 shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--danger)_25%,transparent)]` (các lớp `max-w-lg`, `border-(--border)`, `ring-(--accent)/10`, `shadow-2xl` đều được thay thế sạch).
     - Với `GalleryView.tsx:270`: `overflow-hidden` loại bỏ cả `overflow-y-auto` và `overflow-x-hidden`.
     - Với `UpgradeModal.tsx:17`: `overflow-visible` loại bỏ cả `overflow-y-auto` và `overflow-x-hidden`.
   - **Kết quả**: Không gây hồi quy lên các modal hiện hữu.

2. **Tấn công 2 — Quét toàn bộ quan hệ khóa ngoại trong `src/types/database.types.ts` để tìm các cặp bảng tiềm ẩn lỗi `PGRST201` ngoài `conversations <-> messages`**:
   - **Giả thuyết rủi ro**: Có thể còn cặp bảng khác trong schema `public` có từ 2 khóa ngoại trở lên nối với nhau mà kế hoạch chưa liệt kê.
   - **Bằng chứng `[SRC]` & `[CMD]`**: Chạy probe `node -e` phân tích toàn bộ các khối `Relationships` trong `src/types/database.types.ts:16-800` (tổng cộng 14 FK):
     - `conversations -> messages` (`conversations_forked_from_message_id_fkey`) và `messages -> conversations` (`messages_conversation_id_fkey`) là cặp bảng duy nhất có 2 mối quan hệ qua lại.
     - Kết hợp với kết quả quét toàn bộ lời gọi `.select(...)` trong `src/`, chỉ có đúng 5 vị trí join giữa `messages` và `conversations` (`src/app/api/gallery/route.ts:95`, `src/app/api/gallery/[id]/route.ts:48`, `src/lib/features/chat/messages.ts:395, 505`, `src/app/api/admin/stats/route.ts:33`), tất cả đều đã nằm trong danh sách `[MODIFY]` của Revision 2.
   - **Kết quả**: Không bỏ sót truy vấn nào có nguy cơ gặp `PGRST201`.

3. **Tấn công 3 — Kiểm tra `isCiphertextHex` và `resolveMessageContent` trước các chuỗi prompt có dấu `:` và hành vi module-load của `src/lib/core/encryption.ts`**:
   - **Giả thuyết rủi ro**:
     1. Trong `src/app/api/edit-image/route.ts:225` và `src/app/api/generate-image/route.ts:314`, `messageContent` có dạng `"Edited Image: <prompt>"` hoặc `"Generated Image: <prompt>"` (chứa dấu `:`). Nếu `isCiphertextHex` nhận diện nhầm chuỗi có dấu `:` là ciphertext, hoặc nếu `galleryMapper.ts` import cứng `encryption.ts` ở cấp module khiến unit test không có biến môi trường `DATA_ENCRYPTION_KEY` bị crash tại `src/lib/core/encryption.ts:28`.
   - **Bằng chứng `[SRC]` & `[CMD]`**:
     - Chạy `npx tsx -e` import `src/lib/core/encryption.ts` khi không nạp `.env` xác nhận `encryption.ts:28` ném `Error: DATA_ENCRYPTION_KEY must be a 64-character hex string` ở thời điểm import trên Node.js.
     - Trong Revision 2 (Mục 5.1 dòng 148–161), `galleryMapper.ts` nhận `decryptFn?: (cipher: string) => string` qua tham số hàm (dependency injection) thay vì tự import `encryption.ts`, giúp `galleryMapper.test.ts` chạy độc lập với biến môi trường, đồng thời tại `src/app/api/gallery/route.ts` mới truyền `decryptText`.
     - Regex `GCM_CIPHERTEXT_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i` và `CBC_CIPHERTEXT_RE = /^[0-9a-f]{32}:[0-9a-f]+$/i` yêu cầu chính xác 24 hoặc 32 ký tự hex ở phần đầu, nên các chuỗi plaintext có dấu `:` như `"Edited Image: Sunset 16:9"` luôn trả về `false` và được giữ nguyên.
   - **Kết quả**: Thiết kế dependency injection `decryptFn` và regex `isCiphertextHex` an toàn trên cả Node.js lẫn `happy-dom`.

4. **Tấn công 4 — Tương tranh giữa `fetchImages(true)` (cuộn trang) và `fetchImages(false)` (đổi bộ lọc `showFavoritesOnly`) trong `useGalleryController.ts`**:
   - **Giả thuyết rủi ro**: Khi đang cuộn trang (`isLoadMore = true`, `loadingMore = true`, `currentRequestId = 1`), người dùng bấm đổi bộ lọc `showFavoritesOnly` (`isLoadMore = false`, `requestIdRef.current` tăng lên `2`, `loading = true`). Nếu request `isLoadMore = true` cũ hoàn tất trước request `isLoadMore = false` mới, liệu nó có nối (`[...prev, ...newImages]`) dữ liệu trang cũ vào danh sách mới hoặc tắt nhầm `loading` của request mới không?
   - **Bằng chứng `[SRC]` & `[ADV]`**: Đối chiếu `src/app/features/gallery/components/hooks/useGalleryController.ts:85-123` với thiết kế tại Mục 5.16 (dòng 208–219) của Revision 2:
     - Khi request `isLoadMore = true` (có `currentRequestId = 1`) nhận phản hồi, điều kiện `if (currentRequestId !== requestIdRef.current) return;` (`1 !== 2`) chặn đứng việc gọi `setImages` và `setHasMore`.
     - Trong khối `finally`, nhánh `if (currentRequestId === requestIdRef.current && !isLoadMore) setLoading(false)` không chạy cho request cũ (`isLoadMore` là `true` và `1 !== 2`), nên `loading` của request `currentRequestId = 2` vẫn giữ nguyên `true` cho đến khi request 2 hoàn tất.
   - **Kết quả**: Không xảy ra ghi đè state hay tắt sớm trạng thái `loading`.

#### 4. Mental Simulation Verification Matrix

| Kịch bản                                     | Trạng thái | Loại bằng chứng             | Chi tiết kiểm chứng                                                                                                                                                                                                                                                                                                  |
| :------------------------------------------- | :--------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | `PASS`     | `[CMD]` + `[SRC]`           | Chạy `npx vitest run src/lib/features/chat/messages.test.ts src/app/api/gallery/route.test.ts src/app/api/gallery/[id]/route.test.ts src/app/api/admin/stats/route.test.ts` đạt exit code `0` (4 test files, 54 tests pass) cùng baseline `npm run verify` exit code `0`.                                            |
| **S2: Runner Lifecycle & Teardown**          | `PASS`     | `[SRC]` + `[ADV]`           | `useGalleryController.ts` ngắt `IntersectionObserver` khi unmount (`observer.disconnect()`), đặt `setHasMore(false)` khi lỗi, ẩn sentinel khi danh sách rỗng, và tách `isFetchingMoreRef` + `requestIdRef` xử lý đồng thời giữa phân trang và đổi bộ lọc.                                                            |
| **S3: Database & Temporal Logic**            | `PASS`     | `[SRC]` + `[CMD]` + `[URL]` | Toàn bộ 5 vị trí truy vấn giữa `messages` và `conversations` được chỉ định tường minh FK `conversations!messages_conversation_id_fkey!inner`. Logic phân trang `hasMore = rawRows.length > limit` kèm `rawRows.slice(0, limit)` khớp với `query.range(offset, offset + limit)` (`src/app/api/gallery/route.ts:114`). |
| **S4: Cross-Task State Flow**                | `PASS`     | `[SRC]`                     | `GalleryMessageRow` và `paginateAndMapGalleryRows` khớp với cấu trúc `meta` được ghi bởi `generate-image/route.ts:332-357`, `edit-image/route.ts:226-241`, `edit-image-multi/route.ts:347-364` và được đọc bởi `useGalleryController.ts:12-20`.                                                                      |
| **S5: Security Boundary & 3-Tier Auth**      | `PASS`     | `[SRC]` + `[ADV]`           | Các route giữ nguyên kiểm tra `auth()` và ownership `conversations.user_id`. Hàm `resolveMessageContent` chặn rò rỉ chuỗi hex khi giải mã thất bại.                                                                                                                                                                  |
| **S6: External Resilience & Serverless Cap** | `PASS`     | `[SRC]`                     | Khi `/api/gallery` trả lỗi 500 hoặc lỗi mạng, client dừng phân trang (`setHasMore(false)`) và báo lỗi qua `toast.error(t("galleryLoadFailed"))`, chấm dứt vòng lặp gọi API liên tục.                                                                                                                                 |
| **Domain: Open Inquiry (Vikini)**            | `PASS`     | `[SRC]` + `[CMD]`           | Khóa dịch mới đồng bộ giữa `en.ts` và `vi.ts` (được kiểm soát bởi `_AssertTranslationsParity` tại `src/lib/utils/translations/index.ts:26-34`). Phần sửa CSS modal và scrollbar tuân thủ token trong `src/app/styles/themes/_shared/base.css:184-190`.                                                               |

#### 5. Claim Verification

- **4.5.1 Library Claim Verification**:
  - **`tailwind-merge` (`src/lib/utils/cn.ts`)**: Xác minh bằng `[CMD]` probe `npx tsx -e` với `cn` thực tế của dự án; các lớp `overflow-y-auto overflow-x-hidden` và `border-(--danger)/30 ring-(--danger)/20 shadow-[...]` hợp nhất đúng kỳ vọng.
  - **PostgREST 14.5 FK Disambiguation**: Xác minh bằng `[URL]` tài liệu PostgREST v14 và `[CMD]` + `[SRC]` quét toàn bộ 14 FK trong `src/types/database.types.ts`.
- **4.5.3 Enforcement Claim Verification**:
  - **Compile-time Translation Parity (`TC-05`)**: Được cưỡng chế bởi kiểu `_AssertTranslationsParity` trong `[SRC]` `src/lib/utils/translations/index.ts:26-34` và kiểm thử bởi `[SRC]` `src/lib/utils/translations/index.test.ts:6-30`.
- **4.5.4 Risk Table Audit**:
  - Các rủi ro Trung bình (`R1`, `R2`, `R3`) và Thấp (`R4`) trong Mục 9 (dòng 309–314) đều đã ánh xạ tới technical control cụ thể trong `src/lib/features/gallery/galleryMapper.ts` và `src/app/features/gallery/components/hooks/useGalleryController.ts`, đi kèm unit test trong `TC-01`..`TC-05`.

#### 6. Adversarial Timelines

```text
Cơ chế 1 (Trục Đồng thời): Đổi bộ lọc Favorites khi đang tải trang đầu hoặc đang tải trang tiếp theo (S2, S4)
T1: fetchImages(false) (request 1, showFavoritesOnly=false) hoặc fetchImages(true) (currentRequestId=1) đang chạy.
T2: Người dùng nhấn nút Favorites -> showFavoritesOnly=true -> fetchImages(false) tăng requestIdRef.current lên 2, đặt isFetchingMoreRef.current=false, loading=true.
T3: Request 1 hoàn tất muộn -> kiểm tra currentRequestId (1) !== requestIdRef.current (2) -> return sớm, không ghi đè images và không tắt loading của request 2. Khi request 2 hoàn tất -> currentRequestId (2) === requestIdRef.current (2) -> cập nhật images và tắt loading.
Kết cục: Dữ liệu hiển thị khớp với trạng thái bộ lọc hiện tại trên UI → AN TOÀN.
```

```text
Cơ chế 2 (Trục TOCTOU & Ownership): Xóa ảnh qua DELETE /api/gallery/[id] (S3, S5)
T1: User A gửi DELETE /api/gallery/msg-123. Route xác thực session.user.email -> userId.
T2: Route truy vấn messages kèm conversations!messages_conversation_id_fkey!inner(user_id) theo id = msg-123.
T3: Nếu conversation.user_id !== userId -> ném ForbiddenError (HTTP 403) trước khi xóa storage hoặc DB.
Kết cục: Đảm bảo cách ly quyền sở hữu giữa các người dùng → AN TOÀN.
```

```text
Cơ chế 3 (Trục Thất bại giữa chừng & Dọn dẹp): Lỗi HTTP 500 hoặc mất mạng khi gọi GET /api/gallery (S2, S6)
T1: useGalleryController khởi tạo loading=true, hasMore=false.
T2: fetchImages(false) nhận HTTP 500 (!res.ok) hoặc network error.
T3: Hàm gọi setHasMore(false), toast.error(t("galleryLoadFailed")), và đặt loading=false trong finally. Sentinel loadMoreRef không render do hasMore===false và filteredImages.length===0.
Kết cục: Không kích hoạt lại IntersectionObserver, dừng vòng lặp gọi API → AN TOÀN.
```

```text
Cơ chế 4 (Trục Serverless / Môi trường thực thi): Xử lý msg.content mã hóa và plaintext trong galleryMapper.ts (S4, S5)
T1: paginateAndMapGalleryRows xử lý bản ghi thiếu meta.prompt và meta.editPrompt.
T2: Nếu msg.content là plaintext (ví dụ "Edited Image: Sunset" hoặc "Attachment image" dưới happy-dom), isCiphertextHex trả về false -> giữ nguyên plaintext. Nếu msg.content là ciphertext hex (24-hex:32-hex:hex), isCiphertextHex trả về true -> gọi decryptFn.
T3: Nếu decryptFn giải mã thành công thì trả về plaintext; nếu decryptFn ném lỗi hoặc trả về rỗng thì fallback về "".
Kết cục: Không làm mất plaintext dưới happy-dom và không lộ chuỗi hex ciphertext lên UI khi lỗi → AN TOÀN.
```

#### 7. Commands Executed (Audit Run 2)

1. `npx tsx -e "import { cn } from './src/lib/utils/cn'; ..."` -> Exit code `0` (kiểm chứng kết quả merge class của `DialogContent` với `overflow-x-hidden`, danger glow, `overflow-hidden`, `overflow-visible`).
2. `npx tsx -e "import { isValidHexKey } from './src/lib/core/encryption'; ..."` -> Exit code `1` (xác nhận `encryption.ts:28` kiểm tra `DATA_ENCRYPTION_KEY` ngay khi import trên Node.js).
3. `node -e "const fs = require('fs'); const src = fs.readFileSync('src/types/database.types.ts', 'utf8'); ..."` -> Exit code `0` (liệt kê toàn bộ 14 FK trong `database.types.ts`, xác nhận chỉ có cặp `conversations <-> messages` có 2 FK).
4. `npx vitest run src/lib/features/chat/messages.test.ts src/app/api/gallery/route.test.ts src/app/api/gallery/[id]/route.test.ts src/app/api/admin/stats/route.test.ts` -> Exit code `0` (4 test files, 54 tests passed).

#### 8. Kết Luận

Toàn bộ 6 phát hiện (`F1`–`F6`) từ Audit Run 1 đã được giải quyết trong Revision 2 và đối chiếu khớp với mã nguồn thực tế. Kế hoạch đáp ứng đủ các tiêu chuẩn kỹ thuật để chuyển sang giai đoạn triển khai.

[PLAN_APPROVED]

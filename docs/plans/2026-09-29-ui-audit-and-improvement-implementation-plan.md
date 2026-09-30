# Kế Hoạch Kiểm Thử Toàn Diện Giao Diện (UI Audit) & Cải Tiến - Nâng Cấp Tính Năng Toàn Hệ Thống Vikini

> **Trạng thái**: Ready for Review  
> **Revision**: 4 (Khắc phục toàn diện Audit Run 4: 3 [MAJOR], 6 [MINOR]; 0 Blocker)  
> **Tác giả**: @planner (Technical Planner)  
> **Ngày lập**: 2026-09-30  
> **Phạm vi tác động**: Toàn bộ hệ thống UI của Vikini (`src/app/features/`, `src/components/`, `src/lib/features/chat/`, `src/app/styles/themes/`, `src/lib/utils/translations/`, `src/lib/store/`). Không làm thay đổi cơ chế backend DB schema hay AI provider contracts.

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Thực hiện kiểm toán toàn diện (comprehensive UI/UX audit) trên toàn bộ 10 phân hệ giao diện của Vikini nhằm phát hiện, phân loại và giải quyết triệt để các tồn tại kỹ thuật; đồng thời xây dựng lộ trình nâng cấp hiện đại hóa trải nghiệm người dùng theo 4 cấp độ ưu tiên (P0 -> P3):

1. **Khắc phục triệt để các lỗi logic (Logic Bugs) & vi phạm ranh giới hệ thống (P0)**:
   - **Thay thế hoàn toàn `window.confirm()`** trong `GemModal.tsx` và `PersonaModal.tsx` bằng imperative `confirm()` từ `confirmStore` chuẩn hóa theo `.agents/rules/03-ui.md`. Sử dụng `variant: "danger"` (khớp đúng type `confirmStore.ts`), bổ sung cờ `isConfirmingRef` chống re-entrancy khi nhấn ESC/overlay liên tục, đọc `hasDirtyEditor` mới nhất qua `useGemStore.getState().hasDirtyEditor` (trong `GemModal`) và `usePersonaStore.getState().hasDirtyEditor` (trong `PersonaModal`, [TIẾP THU MINOR m-R2-3]) sau khi `await`, và áp dụng khóa song ngữ `t("discardChangesTitle")`, `t("discardChangesDesc")`.
   - **Sửa lỗi logic xuất dữ liệu giả lập (dummy stub)** trong `ProjectNode.tsx`: Thay thế đoạn tạo file tĩnh 2 dòng bằng hàm `downloadConversationById(conv.id, conv.title)` bọc trong khối `try/catch` có trạng thái `isExporting` chống spam click, thông báo lỗi qua `toast.error(t("exportFailed"))` và ghi log `logger.error()`.
   - **Xử lý triệt để bùng nổ tác dụng phụ (side-effect explosion) và lỗi ghi đè ngôn ngữ** trong `useLanguage.ts` & `LanguageUpdater.tsx`:
     - Thiết kế `LanguageUpdater.tsx` theo cơ chế **"đọc trước - ghi sau"** (read-first, write-after) với state phản ứng `const [hasHydrated, setHasHydrated] = useState(false);` (dùng `useState` thay vì `useRef` để tránh race condition trong commit phase [TIẾP THU MINOR m-R4-6]). Khi mount, đọc `localStorage.getItem("vikini-language")` -> nếu có, cập nhật vào `useLanguageStore` rồi mới set `hasHydrated = true`. Chỉ sau khi `hasHydrated === true` thì effect ghi mới lắng nghe thay đổi của store để ghi vào `localStorage` và `document.documentElement.lang`. TC-07 kiểm chứng thêm assertion: `localStorage.setItem` **không bao giờ** bị gọi với `"en"` khi ban đầu storage đã lưu `"vi"`.
     - Xóa bỏ hoàn toàn effect khởi tạo ngôn ngữ dư thừa/xung đột tại `ChatApp.tsx:108-115` và dọn dẹp import `LANGS`/`SupportedLanguage` không còn sử dụng để tránh cảnh báo linter [TIẾP THU MINOR m-R2-4].
     - Xóa bỏ `window.dispatchEvent(new CustomEvent("vikini-language-change"))` khỏi `useLanguage.ts` vì grep xác nhận 0 listener nào trong codebase sử dụng sự kiện này.
     - Giữ `useLanguage.ts` thuần túy trả về state và hàm dịch `t` bằng atomic selector của Zustand.
   - **Bổ sung phản hồi bắt buộc** `toast.error()` và `logger.error()` tại các thao tác upload/delete tài liệu Knowledge Base trong `KnowledgePanel.tsx` theo `.agents/rules/01-coding.md`.
   - **Sửa lỗi điều hướng thô & điều hướng Deep Research đúng vị trí [SỬA MAJOR R2-M4]**: Thay thế `window.location.href = "/admin"` trong `Sidebar.tsx` bằng `router.push('/admin')`. Sửa lỗi tạo hội thoại trong `ChatApp.tsx:988` (callback `onCreateConversation`): gọi trực tiếp `setSelectedConversationIdAndUrl(currentTask.conversationId)` (đã có sẵn trong scope ChatApp tại dòng 192) để đồng bộ URL `?id=` và kích hoạt conversation thay vì gán hash `#conv=` vô nghĩa. Loại bỏ `ResearchReportPanel.tsx` khỏi bước sửa điều hướng (panel chỉ nhận prop callback).
   - **Sửa lỗi cứng mã ngôn ngữ giọng nói**: Truyền biến `language` động từ `useLanguage()` (chuyển đổi `"vi"` -> `"vi-VN"`, `"en"` -> `"en-US"`) vào `VoiceButton` của `InputForm.tsx`.
   - **Phòng ngừa de-opt SSR/SSG**: Bọc `<Suspense>` cho các component con có thể mở rộng sử dụng `useSearchParams` (`GemManager.tsx:19`, `PersonaManager.tsx:20`).

2. **Xóa bỏ các điểm nghẽn hiệu năng nghiêm trọng & Tái cấu trúc an toàn (Safe P1)**:
   - **Tách biệt Server Component và Client Lazy Modals Duy Nhất 1 Lần [SỬA BLOCKER B1 & MAJOR R2-M7]**: Tạo mới client component `src/app/features/layout/components/LazyModals.tsx` (có `"use client"`) chứa các lệnh `dynamic(() => import(...), { ssr: false })` cho `GemModal` và `PersonaModal`. **Chỉ render `<LazyModals />` duy nhất 1 lần trong `src/app/features/layout/components/MainLayout.tsx`**, giữ nguyên `src/app/layout.tsx` (không mount `LazyModals` tại đây). Tối ưu hóa lazy-load thật và bảo toàn animation đóng: Sử dụng latch `hasOpenedGem` và `hasOpenedPersona` (khi đã mở lần đầu thì giữ mount và chỉ ẩn qua prop `open={isOpen}`) để bảo toàn hoàn hảo CSS transition/animation đóng của Radix (`data-[state=closed]`) [TIẾP THU MINOR m-R4-5].
   - **Module Thuần, Size Cache, Handoff & Controls Cho Ảo Hóa Tin Nhắn [SỬA MAJOR R2-M1 & R4-M3]**:
     - Tạo module thuần `src/lib/features/chat/virtualization.ts` chứa các hàm toán học thuần kiểm thử được: `createSizeCache(estimatedHeight?: number)`, `computeVisibleRange(scrollTop, viewportHeight, totalCount, sizeCache, overscan?)`, `calculateVirtualPadding(startIndex, endIndex, totalCount, sizeCache)`, và `computeScrollCompensation(resizedIndex, startIndex, deltaHeight)`.
     - Co-located test: `src/lib/features/chat/virtualization.test.ts`.
     - **Thuật toán bù cuộn chống nhảy Viewport [SỬA MAJOR R4-M3]**: Hàm `computeScrollCompensation(resizedIndex, startIndex, deltaHeight): number` chỉ thực hiện bù cuộn khi item thay đổi chiều cao nằm **phía trên** viewport đang hiển thị (`resizedIndex < startIndex`): trả về `deltaHeight`. Khi item thay đổi chiều cao nằm trong hoặc phía dưới viewport (`resizedIndex >= startIndex`, bao gồm cả pinned streaming slot ở đáy khi user đang cuộn lên xem lịch sử): trả về `0` để không kéo giật màn hình của người dùng.
     - **Cơ chế Handoff từ Pinned Streaming Slot sang Virtual List**: Tin nhắn đang streaming được ghim cố định tại **Pinned Streaming Slot** ở đáy danh sách ngoài virtual window. Khi stream kết thúc (`done`): lấy ngay kích thước đo DOM thật hiện tại của pinned slot seed vào size cache (`sizeCache.set(index, domHeight)`) trước khi chuyển item vào virtual list, kết hợp bù offset có điều kiện qua `computeScrollCompensation`.
     - **Mở rộng Interface `useChatScroll` [SỬA MAJOR R4-M3]**: Đưa `useChatScroll.ts` vào danh sách `[MODIFY]` và tạo test `useChatScroll.test.ts`. Mở rộng giá trị trả về: `{ scrollRef, handleScroll, handleTouchStart, handleTouchEnd, isAtBottom, unreadCount, scrollToBottom }`. `isAtBottom` quản lý theo state để trigger re-render UI nút nổi; `unreadCount` đếm số tin/token mới khi `isAtBottom === false`, tự động reset về 0 khi gọi `scrollToBottom()` hoặc cuộn tới đáy.
     - **Feature Flag**: Bổ sung cờ `ENABLE_VIRTUALIZED_CHAT` trong `src/lib/utils/constants.ts` (mặc định `false`, toggle khi kích hoạt). Khi `false`, `ChatMessagesArea` render danh sách tin nhắn phẳng thông thường, bảo vệ an toàn branch isolation từ commit `a0fd5e8`.
     - Dọn dẹp tài nguyên bắt buộc: Gọi `ResizeObserver.disconnect()` và hủy bỏ mọi event listener khi unmount.
   - **Module Thuần & Co-located Test Cho Typewriter Buffer**:
     - Tạo module thuần `src/lib/features/chat/typewriter.ts` chứa hàm thuần `computeCharsToTake(bufferLen: number): number`.
     - Co-located test: `src/lib/features/chat/typewriter.test.ts` (kiểm chứng logic refactor bảo toàn thuật toán: 2 chars/tick khi <=30, 6 chars khi 31-80, 12 chars khi 81-200, và `bufferLen/3` khi >200).
     - Tạo hook consumer `src/app/features/chat/components/hooks/useTypewriterBuffer.ts` đảm nhiệm RAF loop và cleanup `cancelAnimationFrame`.
   - **Phạm vi phân rã an toàn (Safe P1) & Chuẩn hóa ranh giới kiến trúc [SỬA MAJOR R4-M2]**:
     - Tiếp thu khuyến nghị của Lead Reviewer: Trong đợt này, việc trích xuất `useTypewriterBuffer` và `ChatMessagesArea` phục vụ mục đích phân tách module an toàn (Safe P1).
     - **Dỡ bỏ mục tiêu số dòng gượng ép (<350 dòng cho `useChatStreamController` và <400 dòng cho `ChatApp`) trong đợt này**. Lên kế hoạch chính thức chuyển giao việc phân rã toàn diện 15 callbacks lớn còn lại của stream controller sang một kế hoạch tái cấu trúc chuyên biệt (`docs/plans/2026-10-xx-chat-architecture-decomposition.md`) tuân thủ nghiêm ngặt nguyên tắc Minimal Diffs của `00-core.md`.
     - Viết bổ sung **Characterization Tests** cho `useChatStreamController` (hiện có 3 tests, không phải 57) trước khi trích xuất typewriter, kiểm chứng: stream hoàn tất và typewriter flush, typewriter buffer nhả chữ đều, xử lý lỗi stream rollback, và stream abort bảo toàn partial-persistence (`syncPartialMessage` với cờ `isPartial: true`).
   - **Tối ưu hóa pipeline render Markdown & Syntax Highlighting**: Memoize AST khối Markdown đã hoàn thành; hoãn highlight cú pháp code blocks đến khi stream hoàn tất hoặc nhàn rỗi.
   - **Khóa Chống Double-Submit Mới Trong `InputForm` [SỬA MAJOR R2-M6]**:
     - Xóa bỏ bộ trễ debounce trailing 500ms trong `InputForm.tsx` để tin nhắn được gửi tức thì.
     - Bổ sung cơ chế khóa chống double-submit chủ động: `const isSubmittingRef = useRef(false);`.
     - Trên cả nhánh gửi tin nhắn văn bản và nhánh tạo ảnh (image mode): nếu `isSubmittingRef.current === true` thì chặn ngay lập tức; gán `true` ngay trước khi gọi `onSubmit()`.
     - Điều kiện giải phóng khóa (`isSubmittingRef.current = false`): khi `isStreaming` hoặc `disabled` chuyển trạng thái, hoặc được reset trong `requestAnimationFrame` kế tiếp.
     - Bảo toàn snapshot `pendingFileIdsRef` và `markAsSent` trước khi reset state input để không bị mất tệp đính kèm.
   - **Tối ưu hóa nạp icon**: Thay thế 4 `next/dynamic` icon đơn lẻ trong `HeaderBar.tsx` bằng static imports từ `lucide-react`.

3. **Chuẩn hóa Design Tokens, Z-Index & Khắc phục xung đột CSS Tailwind v4 (P0/P1)**:
   - **Khắc phục xung đột gradient tại 5 theme Glassmorphism (`nebula`, `aqua`, `holo`, `orchid`, `sunset`)**:
     - Tách rõ 2 token: `--surface` là mã màu solid hex/rgba hợp lệ (ví dụ `#0f172a`), và `--surface-gradient` là chuỗi `radial-gradient(...) linear-gradient(...)`.
     - Trong `tokens.css`: Quy định `.bg-surface` và utility `.theme-surface-canvas` sử dụng cú pháp an toàn `background: var(--surface-gradient, var(--surface));`.
     - Cập nhật `base.css:162` (`body { background: var(--surface-gradient, var(--surface)); }`) để đồng bộ nhất quán [TIẾP THU MINOR m-R2-2].
     - Bỏ qua bước chỉnh sửa `blueprint.css` vì `--surface-elevated` và `--accent-foreground` đã được kế thừa chuẩn từ `base.css` [TIẾP THU MINOR m-R2-1].
     - Giữ nguyên `bg-surface` trong `src/app/layout.tsx` và `src/app/page.tsx` (không đổi sang `bg-(--surface)` để không làm mất gradient nền của body).
     - Vì `--surface` là mã màu solid hợp lệ, các vị trí cần dùng màu bề mặt hoặc opacity như `bg-(--surface)/95` (trong `GemModal.tsx:29`) sẽ được trình duyệt render chính xác 100%.
   - **Xóa bỏ triệt để 100% các biến CSS token chết (Không dùng alias)**:
     - `--text-muted`: Thay thế toàn bộ bằng `--text-secondary` trên toàn bộ 9 file chứa token này. Tuyệt đối không tạo alias trong `base.css` để đạt chuẩn 0 occurrence theo TC-04 [TIẾP THU MINOR m-R2-5].
     - `--surface-base`: Thay thế toàn bộ bằng `--surface` trên 8 file thực tế theo grep (gồm `FilePreviewCard.tsx`, không có trong `IconPicker.tsx` [TIẾP THU MINOR m-R4-1]).
     - `--surface-hover`: Thay thế toàn bộ bằng `--control-bg-hover` trên 7 file thực tế theo grep.
     - `--border-hover`: Thay thế bằng `--control-border` hoặc `--accent` trên 2 file (`ResearchReportPanel.tsx` và `ProjectChatView.tsx` [TIẾP THU MINOR m-R4-1]).
     - `--text-tertiary`: Thay thế bằng `--text-secondary` trên `ResearchPlanCard.tsx`.
     - `--primary-hover`, `--primary-foreground`: Thay thế bằng `--accent`, `--accent-foreground` trên `ImageGenStudio.tsx`.
   - **Chuẩn Hóa Thang Z-Index Toàn Hệ Sinh Thái Vikini & Floating Primitives [SỬA MAJOR R4-M1]**:
     - Định nghĩa thang z-scale nhất quán trong `:root` của `src/app/styles/themes/_shared/base.css` (không đặt trong `@theme`):
       ```css
       :root {
         --z-drawer: 60; /* Mobile sidebar drawer & overlay */
         --z-modal: 70; /* Dialogs, Confirm modals (DialogOverlay, DialogContent) */
         --z-popover: 75; /* Popovers, Select, Tooltip, DropdownMenu, AlertDialog, IconPicker portal */
         --z-toast: 80; /* Toasts luôn nổi trên dialogs và popovers */
         --z-banner: 90; /* StreamErrorBanner luôn nổi trên cùng */
       }
       ```
     - Áp dụng `z-(--z-modal)` (`z-[70]`) cho cả overlay (`DialogOverlay`) và content (`DialogContent`) trong `src/components/ui/dialog.tsx:24,41`.
     - Áp dụng `z-(--z-popover)` (`z-[75]`) cho các floating primitives để luôn nổi trên Dialog (`z-70`):
       - `src/components/ui/popover.tsx:22` (PopoverContent)
       - `src/components/ui/select.tsx:71` (SelectContent)
       - `src/components/ui/tooltip.tsx:22` (TooltipContent)
       - `src/components/ui/dropdown-menu.tsx:49,66` (DropdownMenuContent, DropdownMenuSubContent)
       - `src/components/ui/alert-dialog.tsx:21,39` (AlertDialogOverlay, AlertDialogContent)
       - `src/components/ui/IconPicker.tsx:142` (PopoverContent của icon picker)
       - Radix Dropdown portals trong mobile drawer (`ProjectNode.tsx`, `SidebarItem.tsx`)
     - Áp dụng `z-(--z-drawer)` (`z-[60]`) cho overlay và drawer trong `src/app/features/sidebar/components/Sidebar.tsx:547,558`.
     - Cập nhật `ToastContainer.tsx` dùng `z-(--z-toast)` (`z-[80]`), bảo đảm toast luôn hiển thị trên Popover/Dialog.
     - Cập nhật `StreamErrorBanner.tsx:54` dùng `z-(--z-banner)` (`z-[90]`) [TIẾP THU MINOR m-R4-4].
     - Ghi nhận việc cập nhật `Sidebar.test.tsx` (thay đổi assert `z-[60]` thành token mới) theo quy trình Test Failure Triage Loại C (Approved Spec Change).

4. **Hiện đại hóa UI/UX & Đạt chuẩn Tiếp cận (Accessibility WCAG 2.2) (P2)**:
   - Bổ sung nút nổi **"Scroll to Bottom" (Jump to Latest)** (`ScrollToBottomButton.tsx`) kèm chỉ báo số tin nhắn mới khi người dùng cuộn lên trong lúc streaming (kết nối trực tiếp với `useChatScroll`).
   - Thêm đầy đủ `aria-expanded`, `aria-label` cho tất cả các nút đóng/mở collapsible, menu action trong `SidebarSection.tsx`, `ProjectNode.tsx`, `ProjectChatView.tsx`, `ResearchPlanCard.tsx`.
   - Thay thế thẻ cấm `<span role="button">` trong `IconPicker.tsx` bằng thẻ ngữ nghĩa chuẩn `<button>`.
   - Nâng cấp toàn bộ cỡ chữ dưới 12px vi phạm (`text-[9px]`, `text-[10px]`, `text-[11px]`) trên 31 file nguồn thực tế thành tối thiểu `text-xs` (12px) kèm font-semibold/tracking tương ứng để bảo toàn visual hierarchy [SỬA MAJOR R2-M3].
   - Thay thế toàn bộ inline SVG vẽ tay trong `SidebarItem.tsx` bằng Lucide Icons (`MoreVertical`, `Pencil`, `Trash2`, `Download`).
   - Thiết kế thanh điều hướng dưới đáy màn hình **Mobile Bottom Navigation Bar** (`MobileBottomNav.tsx`) tối ưu cho thao tác một tay trên điện thoại di động.

5. **Tuân thủ tuyệt đối quy tắc Song ngữ (Bilingual Rule - `04-bilingual.md`) (P0/P2)**:
   - Loại bỏ 100% văn bản hardcoded tiếng Anh/Việt trên các component: `SidebarItem`, `Sidebar`, `ChatBubble`, `BubbleMarkdown`, `GalleryView`, `IconPicker`, `FloatingMenuTrigger`, `ToastContainer`, `dialog.tsx`.
   - Xóa bỏ triệt để anti-pattern prop-drilling translation object `t` dạng dictionary; áp dụng chuẩn hóa hook `const { t } = useLanguage()` tại chỗ.
   - Bổ sung đầy đủ các khóa dịch song ngữ đối ứng cho cả `vi.ts` và `en.ts`, thỏa mãn hard gate compile-time check.

6. **Bổ sung các tính năng nâng cao có đặc tả đầy đủ (P3) [SỬA MAJOR R2-M8]**:
   - **Xác định rõ ranh giới triển khai**: Trọng tâm thực thi trực tiếp của đợt này là **Giai đoạn P0 & Safe P1**. Các hạng mục P2 và P3 được đặc tả đầy đủ cấu trúc kỹ thuật để triển khai ngay sau khi P0/P1 hoàn thành nghiệm thu.
   - **Command Palette (`Cmd+K` / `Ctrl+K`)**: Mount tại `MainLayout.tsx`. Sử dụng `usePathname()` để chặn không render trên các route `/auth/*` và `/admin` nhằm ngăn gọi SWR `useConversation` khi chưa đăng nhập (tránh lỗi 401). Khi authenticated, đọc dữ liệu hội thoại từ SWR key `"/api/conversations"`. Hành động chọn hội thoại kích hoạt qua `router.push('/?id=' + conv.id)`. Lắng nghe sự kiện `keydown`, tự động bỏ qua khi `e.target` là `input`, `textarea` hoặc phần tử có `isContentEditable`. Dọn dẹp đầy đủ listener trong hàm cleanup `removeEventListener("keydown", ...)`.
   - **Bảng Tra Cứu Phím Tắt (Keyboard Shortcuts Modal)**: Đặt tại `src/app/features/layout/components/KeyboardShortcutsModal.tsx` (theo khuyến nghị m4), kích hoạt khi bấm phím `?`, bỏ qua khi đang gõ phím trong ô nhập liệu, dọn dẹp listener khi unmount.
   - **Tìm Kiếm Hội Thoại Tức Thì Trên Sidebar**: Bộ lọc client-side tìm kiếm nhanh tiêu đề chat ngay trên Sidebar.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Căn cứ theo bảng Pre-Work Protocol tại `.agents/rules/02-quality.md`, nhà phát triển bắt buộc đọc và tuân thủ các tài liệu sau trước khi lập trình:

| STT | Tài liệu tham chiếu               | Trọng tâm & Nội dung bắt buộc tuân thủ                                                                                                                                                                                           |
| :-- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `.agents/rules/03-ui.md`          | Bộ chuẩn Tokens của Vikini (`bg-(--surface)`, `text-(--text-primary)`), quy định cấm class shadcn chết (`bg-primary`, `bg-card`), cấm font <12px, cấm inline SVG, chuẩn WCAG 2.2 focus-visible ring, chuẩn Dialog/Confirm store. |
| 2   | `.agents/rules/04-bilingual.md`   | Quy tắc cấm tuyệt đối hardcoded string, cấm prop-drilling `t`, bắt buộc dùng hook `useLanguage()`, đảm bảo tính toàn vẹn 100% khóa đối xứng giữa `vi.ts` và `en.ts`.                                                             |
| 3   | `.agents/rules/01-coding.md`      | Giới hạn độ dài tệp 150–400 dòng/component, 150–250 dòng/hook; cấm `any`; bắt buộc `toast.error()` cho mọi action thất bại; quy chuẩn co-located tests (`*.test.ts`).                                                            |
| 4   | `.agents/rules/02-quality.md`     | Quy trình kiểm thử 3 tầng, cú pháp chạy test Windows PowerShell 5.1 (dùng dấu `;`), giao thức xử lý test failure Loại A/B/C.                                                                                                     |
| 5   | `.agents/rules/05-plan-review.md` | Cơ chế bảo vệ Code Freeze Guard, Scoped Protection, cấu trúc tệp kế hoạch 2 phần.                                                                                                                                                |
| 6   | `docs/architecture.md` (§ 4 & 5)  | Kiến trúc UI state: Zustand (client), SWR (server), ranh giới mỏng `app/` vs logic `lib/`.                                                                                                                                       |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Bảo toàn giao diện và trải nghiệm gốc**: Mọi cải tiến hiệu năng, dọn dẹp tokens và tái cấu trúc tệp không được làm thay đổi tính nhận diện thương hiệu hay làm gãy layout hiện tại của người dùng.
2. **Không thay đổi Backend Schema & AI Providers**: Toàn bộ thay đổi tập trung vào lớp Presentation (`src/app/`, `src/components/`, `src/lib/features/chat/`, `src/lib/utils/translations/`, `src/lib/store/`). Không chạm vào database migrations, Supabase schema hay server-only handlers (`*.server.ts`).
3. **Môi trường thực thi lệnh kiểm thử**: Shell Windows PowerShell 5.1 yêu cầu sử dụng cú pháp dấu chấm phẩy `;` khi chạy chuỗi lệnh kiểm thử thủ công: `npm run type-check; npm run lint; npm run test:run; npm run build`. Lệnh `npm run verify` chạy an toàn qua `npm`.
4. **Phụ thuộc gói thư viện**: Toàn bộ giải pháp sử dụng các thư viện sẵn có trong `package.json` (Next.js 16, React 19, Tailwind CSS 4, Framer Motion 12, Radix UI primitives, Lucide React, Zustand 5, SWR 2). Không cài đặt thêm các thư viện cồng kềnh ngoài luồng.

---

### 4. Bảng Verified Versions (Xác Minh Trực Tuyến 2026)

Các phiên bản thư viện và đặc tả công nghệ thực tế đang vận hành trong dự án đã được tra cứu và xác thực tương thích trực tuyến:

| Thư Viện / Công Nghệ     | Phiên Bản Đang Dùng                   | Trạng Thái & Lưu Ý Kỹ Thuật 2026                                                                                                                                                                                      | Nguồn Dẫn Chứng                             |
| :----------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Next.js (App Router)** | `^16.1.1` (thực tế cài đặt: `16.1.4`) | Hỗ trợ đầy đủ React 19 Server Components & Actions. CẤM dùng `dynamic(..., { ssr: false })` trong Server Component (gây lỗi biên dịch SWC). Cần `<Suspense>` bọc ngoài các component client dùng `useSearchParams()`. | `node_modules/next/package.json` (`16.1.4`) |
| **React & React-DOM**    | `^19.2.3`                             | Hỗ trợ React Compiler, `useActionState`, `useOptimistic`, `useDeferredValue`. Tránh render cascade khi subscribe store.                                                                                               | `package.json`                              |
| **Tailwind CSS**         | `^4.1.18`                             | CSS-first configuration qua `@theme`. Cấm class màu tên v3 không khai báo. Biến arbitrary dùng cú pháp `bg-(--token)`. Thuộc tính `bg-*` map sang `background-color`, không nhận chuỗi gradient.                      | Tailwind v4 Docs / CSS Spec                 |
| **Zustand**              | `^5.0.9`                              | Cơ chế so sánh mặc định `Object.is`. Yêu cầu dùng atomic selector hoặc `useShallow` từ `zustand/react/shallow` khi bóc tách object state để tránh re-render thừa.                                                     | Zustand v5 Release Notes                    |
| **Framer Motion**        | `^12.23.26`                           | Dùng constants `DURATION`, `EASE` từ `lib/utils/motion.ts`. Dùng `height: "auto"` cho collapsible thay vì CSS height hack.                                                                                            | Framer Motion Docs                          |
| **Radix UI Primitives**  | `^1.1.x` - `^2.2.x`                   | Tương thích React 19, cung cấp đầy đủ focus-trap, ESC listener, ARIA roles cho Dialog, DropdownMenu, Tooltip, Popover.                                                                                                | Radix UI Docs                               |
| **Lucide React**         | `^0.562.0`                            | Thư viện icon chuẩn duy nhất của Vikini. Tree-shaking sẵn có, không cần bọc `next/dynamic` từng icon.                                                                                                                 | Lucide Icons Catalog                        |
| **SWR**                  | `^2.3.8`                              | Quản lý server state cache & mutate cho client. Tối ưu caching cho danh sách gems, personas, files, projects.                                                                                                         | SWR Docs                                    |

---

### 5. Danh Mục Toàn Diện Các Tệp Chứa Token Chết & Cỡ Chữ <12px (Kết Quả Grep Xác Minh)

#### 5.1. Danh Mục Tệp Chứa CSS Token Chết Bắt Buộc Thay Thế [SỬA MAJOR R2-M3 & MINOR m-R4-1]

1. **`--text-muted` (9 tệp thực tế theo grep)** -> Đổi sang `--text-secondary` (Tuyệt đối không dùng alias):
   - `src/app/features/chat/components/ChatBubble.tsx`
   - `src/app/features/gems/components/GemPreview.tsx`
   - `src/app/features/personas/components/PersonaEditor.tsx`
   - `src/app/features/personas/components/PersonaPreview.tsx`
   - `src/app/features/projects/components/ProjectChatView.tsx`
   - `src/app/features/sidebar/components/ProjectNode.tsx`
   - `src/app/features/sidebar/components/Sidebar.tsx`
   - `src/app/features/sidebar/components/SidebarSection.tsx`
   - `src/components/ui/IconPicker.tsx`
2. **`--surface-base` (8 tệp thực tế theo grep)** -> Đổi sang `--surface`:
   - `src/app/features/image-gen/components/ImageGenStudio.tsx`
   - `src/app/features/image-gen/components/Canvas.tsx`
   - `src/app/features/image-gen/components/ControlPanel.tsx`
   - `src/app/features/image-gen/components/DescribeImageView.tsx`
   - `src/app/features/image-gen/components/EditPanel.tsx`
   - `src/app/features/gallery/components/GalleryView.tsx`
   - `src/app/features/chat/components/FileLightbox.tsx`
   - `src/app/features/chat/components/FilePreviewCard.tsx` [TIẾP THU MINOR m-R4-1]
3. **`--surface-hover` (7 tệp thực tế theo grep)** -> Đổi sang `--control-bg-hover`:
   - `src/app/features/gallery/components/GalleryView.tsx`
   - `src/app/features/image-gen/components/ControlPanel.tsx`
   - `src/app/features/image-gen/components/DescribeImageView.tsx`
   - `src/app/features/image-gen/components/EditPanel.tsx`
   - `src/app/features/image-gen/components/PromptBuilder.tsx`
   - `src/app/features/research/components/EditPlanModal.tsx`
   - `src/app/features/research/components/ResearchPlanCard.tsx`
4. **`--border-hover` (2 tệp thực tế theo grep)** -> Đổi sang `--control-border` hoặc `--accent`:
   - `src/app/features/research/components/ResearchReportPanel.tsx`
   - `src/app/features/projects/components/ProjectChatView.tsx` [TIẾP THU MINOR m-R4-1]
5. **`--text-tertiary` (1 tệp)** -> Đổi sang `--text-secondary`:
   - `src/app/features/research/components/ResearchPlanCard.tsx`
6. **`--primary-hover`, `--primary-foreground` (1 tệp)** -> Đổi sang `--accent`, `--accent-foreground`:
   - `src/app/features/image-gen/components/ImageGenStudio.tsx`
7. **Áp Dụng Thang Z-Index Chuẩn Hóa & Floating Primitives [SỬA MAJOR R4-M1 & MINOR m-R4-4]**:
   - `src/app/features/sidebar/components/Sidebar.tsx:547,558` (overlay & mobile drawer) -> `z-(--z-drawer)` (`z-[60]`)
   - `src/components/ui/dialog.tsx:24,41` (DialogOverlay & DialogContent) -> `z-(--z-modal)` (`z-[70]`)
   - `src/components/ui/popover.tsx:22` (PopoverContent) -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/select.tsx:71` (SelectContent) -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/tooltip.tsx:22` (TooltipContent) -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/dropdown-menu.tsx:49,66` (DropdownContent, SubContent) -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/alert-dialog.tsx:21,39` (AlertDialogOverlay, Content) -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/IconPicker.tsx:142` (PopoverContent) -> `z-(--z-popover)` (`z-[75]`, luôn nổi trên Dialog `z-70`)
   - `src/app/features/sidebar/components/SidebarItem.tsx` -> `z-(--z-popover)` (`z-[75]`)
   - `src/app/features/sidebar/components/ProjectNode.tsx` -> `z-(--z-popover)` (`z-[75]`)
   - `src/app/features/projects/components/ProjectChatView.tsx` -> `z-(--z-popover)` (`z-[75]`)
   - `src/components/ui/ToastContainer.tsx` -> `z-(--z-toast)` (`z-[80]`, luôn nổi trên popover và modal)
   - `src/app/features/chat/components/StreamErrorBanner.tsx:54` -> `z-(--z-banner)` (`z-[90]`) [TIẾP THU MINOR m-R4-4]

#### 5.2. Danh Mục 31 Tệp Nguồn Chứa Cỡ Chữ <12px Bắt Buộc Nâng Lên `text-xs` (12px) [SỬA MAJOR R2-M3 & MINOR m-R4-2]

Dán chính xác 31 tệp nguồn chứa `text-[9px]`, `text-[10px]`, `text-[11px]` theo output grep thực tế:

1. `src/app/admin/components/PersonasManager.tsx`
2. `src/app/auth/error/page.tsx`
3. `src/app/auth/signin/page.tsx`
4. `src/app/features/chat/components/ChatApp.tsx` (dòng 596, 952)
5. `src/app/features/chat/components/FileManagerPanel.tsx`
6. `src/app/features/chat/components/FileInMessage.tsx`
7. `src/app/features/chat/components/FilePreviewCard.tsx`
8. `src/app/features/chat/components/ImageGenPreview.tsx`
9. `src/app/features/chat/components/ModelSelector.tsx`
10. `src/app/features/chat/components/SourceLinks.tsx`
11. `src/app/features/chat/components/ThinkingLevelSelector.tsx`
12. `src/app/features/gems/components/GemPreview.tsx`
13. `src/app/features/image-gen/components/Canvas.tsx`
14. `src/app/features/image-gen/components/ControlPanel.tsx`
15. `src/app/features/image-gen/components/DescribeImageView.tsx`
16. `src/app/features/image-gen/components/EditPanel.tsx`
17. `src/app/features/image-gen/components/ImageLightbox.tsx`
18. `src/app/features/image-gen/components/PromptBuilder.tsx`
19. `src/app/features/image-gen/components/StyleSelector.tsx`
20. `src/app/features/image-gen/components/TagInput.tsx`
21. `src/app/features/layout/components/HeaderBar.tsx` (dòng 71, 175, 225, 244, 249)
22. `src/app/features/image-gen/components/SettingsModal.tsx` [TIẾP THU MINOR m-R4-2: sửa từ layout/components sang image-gen/components]
23. `src/app/features/personas/components/PersonaEditor.tsx`
24. `src/app/features/personas/components/PersonaList.tsx`
25. `src/app/features/personas/components/PersonaPreview.tsx`
26. `src/app/features/research/components/EditPlanModal.tsx`
27. `src/app/features/research/components/ResearchAgentSelector.tsx`
28. `src/app/features/research/components/ResearchPlanCard.tsx` (dòng 94)
29. `src/app/features/research/components/ResearchReportPanel.tsx`
30. `src/app/features/sidebar/components/Sidebar.tsx` (dòng 393, 448)
31. `src/components/ui/IconPicker.tsx` (dòng 149, 177)

---

### 6. Phân Kỳ Phạm Vi Triển Khai (Scoping & Phasing) [SỬA MAJOR R4-M2]

Nhằm đảm bảo nguyên tắc Minimal Diffs và quản trị rủi ro tối đa của `00-core.md`:

- **Trọng Tâm Thực Thi Trực Tiếp (Direct Execution Scope)**: Toàn bộ **P0** (Lỗi logic, CSS token cleanup, Theme glassmorphism gradient fix, Song ngữ, Thang Z-index nhất quán & floating primitives) và **Safe P1** (Client LazyModals fix B1/R2-M7, Typewriter extraction & co-located test, Characterization tests cho stream controller, HeaderBar icons static import, Bỏ delay submit 500ms kết hợp khóa `isSubmittingRef`, Mở rộng `useChatScroll` có kiểm thử).
- **Chuẩn Hóa Ranh Giới Tái Cấu Trúc (Splitting Boundary) [SỬA MAJOR R4-M2]**:
  - Trong Giai đoạn P1, việc trích xuất `useTypewriterBuffer` và `ChatMessagesArea` phục vụ mục đích phân tách module an toàn (Safe P1).
  - **Dỡ bỏ mục tiêu số dòng gượng ép (<350 dòng cho `useChatStreamController` và <400 dòng cho `ChatApp`) trong đợt này**. Lên kế hoạch chính thức chuyển giao việc phân rã toàn diện 15 callbacks lớn còn lại của stream controller sang một kế hoạch tái cấu trúc chuyên biệt (`docs/plans/2026-10-xx-chat-architecture-decomposition.md`) tuân thủ nghiêm ngặt nguyên tắc Minimal Diffs của `00-core.md`.
- **Phân Kỳ Ảo Hóa Tin Nhắn (Virtualization)**: Triển khai module toán học độc lập `src/lib/features/chat/virtualization.ts` kèm unit tests co-located, Size Cache, thuật toán bù cuộn chống nhảy `computeScrollCompensation`, Pinned Streaming Slot; component tiêu thụ `ChatMessagesArea.tsx` được điều khiển qua feature flag `ENABLE_VIRTUALIZED_CHAT` (mặc định `false`, toggle khi kích hoạt) để đảm bảo 100% fallback an toàn và giữ vững branch isolation từ commit `a0fd5e8`.
- **Phân Kỳ P2 & P3**: Đã đặc tả kỹ thuật chi tiết (điểm mount, dữ liệu SWR, điều hướng URL, chống xung đột input, và test) sẵn sàng thực thi tuần tự ngay sau khi P0 và Safe P1 vượt qua toàn bộ Verification Gates.

---

### 7. Files Cần Chỉnh Sửa / Tạo Mới

#### 7.1. Files Tạo Mới [NEW]

| STT | Đường Dẫn File                                                   | Mục Đích & Trách Nhiệm                                                                                                                                                                                                                                                                                                             |
| :-- | :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/app/features/layout/components/LazyModals.tsx`              | **[SỬA BLOCKER B1, MAJOR R2-M7 & MINOR m-R4-5]** Client component (`"use client"`) bọc `dynamic(() => import(...), { ssr: false })` cho `GemModal` và `PersonaModal`. Dùng latch `hasOpenedGem` và `hasOpenedPersona` để lazy-load thật và bảo toàn animation đóng của Radix, bảo vệ `MainLayout.tsx` là Server Component sạch sẽ. |
| 2   | `src/lib/features/chat/typewriter.ts`                            | **[SỬA MAJOR M5]** Module thuần chứa logic điều tiết chunk size `computeCharsToTake(bufferLen: number)`.                                                                                                                                                                                                                           |
| 3   | `src/lib/features/chat/typewriter.test.ts`                       | **[SỬA MAJOR M5]** Co-located unit test kiểm thử thuật toán typewriter buffer chunking.                                                                                                                                                                                                                                            |
| 4   | `src/lib/features/chat/virtualization.ts`                        | **[SỬA BLOCKER B2, MAJOR R2-M1 & R4-M3]** Module thuần chứa các hàm toán học ảo hóa danh sách: `createSizeCache()`, `computeVisibleRange()`, `calculateVirtualPadding()`, `computeScrollCompensation()`.                                                                                                                           |
| 5   | `src/lib/features/chat/virtualization.test.ts`                   | **[SỬA BLOCKER B2, MAJOR R2-M1 & R4-M3]** Co-located unit test kiểm chứng logic tính toán windowing offset, dynamic padding, size cache prefix sum, và thuật toán bù cuộn có điều kiện `computeScrollCompensation`.                                                                                                                |
| 6   | `src/app/features/chat/components/ChatMessagesArea.tsx`          | Component hiển thị danh sách tin nhắn chat với hỗ trợ windowing/ảo hóa danh sách, fallback an toàn qua feature flag `ENABLE_VIRTUALIZED_CHAT`, và Pinned Streaming Slot.                                                                                                                                                           |
| 7   | `src/app/features/chat/components/ScrollToBottomButton.tsx`      | Nút cuộn xuống tin nhắn mới nhất hiển thị nổi ở góc phải kèm chỉ báo số tin/token mới nhận được từ `useChatScroll`.                                                                                                                                                                                                                |
| 8   | `src/app/features/chat/components/hooks/useTypewriterBuffer.ts`  | Hook quản lý vòng lặp RequestAnimationFrame và hàng đợi typewriter tiêu thụ `typewriter.ts`.                                                                                                                                                                                                                                       |
| 9   | `src/app/features/chat/components/hooks/useChatScroll.test.ts`   | **[SỬA MAJOR R4-M3]** Co-located test cho hook `useChatScroll` kiểm chứng state `isAtBottom`, logic tăng `unreadCount` khi có tin mới và reset khi cuộn đáy.                                                                                                                                                                       |
| 10  | `src/app/features/command-palette/components/CommandPalette.tsx` | Trình điều khiển Command Palette toàn cục (`Cmd+K` / `Ctrl+K`) mount tại `MainLayout`, chặn route `/auth/*` và `/admin`, tìm kiếm chat qua SWR `"/api/conversations"`.                                                                                                                                                             |
| 11  | `src/app/features/layout/components/MobileBottomNav.tsx`         | Thanh điều hướng đáy màn hình tối ưu cho ngón tay cái trên thiết bị di động.                                                                                                                                                                                                                                                       |
| 12  | `src/app/features/layout/components/KeyboardShortcutsModal.tsx`  | **[TIẾP THU MINOR m4]** Modal hiển thị danh sách phím tắt đặt tại `features/layout/components/` thay vì `components/ui/`.                                                                                                                                                                                                          |
| 13  | `src/app/features/gems/components/GemModal.test.tsx`             | **[SỬA MAJOR R2-M5]** File test cho TC-01 kiểm chứng `confirmStore` và `hasDirtyEditor` trong `GemModal`.                                                                                                                                                                                                                          |
| 14  | `src/app/features/personas/components/PersonaModal.test.tsx`     | **[SỬA MAJOR R2-M5]** File test cho TC-01 kiểm chứng `confirmStore` và `usePersonaStore` trong `PersonaModal`.                                                                                                                                                                                                                     |
| 15  | `src/app/features/sidebar/components/ProjectNode.test.tsx`       | **[SỬA MAJOR R2-M5]** File test cho TC-06 kiểm chứng gọi `downloadConversationById` và toast error trong `ProjectNode`.                                                                                                                                                                                                            |
| 16  | `src/app/features/layout/components/LanguageUpdater.test.tsx`    | **[SỬA MAJOR R2-M5 & MINOR m-R4-6]** File test cho TC-07 kiểm chứng hydration "đọc trước - ghi sau" của `LanguageUpdater` với state phản ứng.                                                                                                                                                                                      |
| 17  | `src/components/features/projects/KnowledgePanel.test.tsx`       | **[SỬA MAJOR R2-M5]** File test cho TC-08 kiểm chứng xử lý lỗi toast & logger trong `KnowledgePanel`.                                                                                                                                                                                                                              |

#### 7.2. Files Chỉnh Sửa [MODIFY]

| STT   | Đường Dẫn File                                                           | Thay Đổi Dự Kiến                                                                                                                                                                                                                                                                                                                             |
| :---- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `src/app/styles/themes/_shared/base.css`                                 | **[SỬA MAJOR R4-M1]** Khai báo thang z-scale ngữ nghĩa chuẩn trong `:root` (`--z-drawer: 60; --z-modal: 70; --z-popover: 75; --z-toast: 80; --z-banner: 90;`). Cập nhật dòng 162 `body { background: var(--surface-gradient, var(--surface)); }` [TIẾP THU MINOR m-R2-2]. Tuyệt đối không thêm alias `--text-muted`.                         |
| 2     | `src/app/styles/themes/_shared/tokens.css`                               | Cập nhật `.bg-surface` và `.theme-surface-canvas` sử dụng `background: var(--surface-gradient, var(--surface));`.                                                                                                                                                                                                                            |
| 3     | `src/app/styles/themes/glassmorphism/nebula.css`                         | Đổi `--surface: #0f172a`, chuyển gradient sang `--surface-gradient`.                                                                                                                                                                                                                                                                         |
| 4     | `src/app/styles/themes/glassmorphism/aqua.css`                           | Tương tự: tách màu solid fallback `--surface` và `--surface-gradient`.                                                                                                                                                                                                                                                                       |
| 5     | `src/app/styles/themes/glassmorphism/holo.css`                           | Tương tự: tách màu solid fallback `--surface` và `--surface-gradient`.                                                                                                                                                                                                                                                                       |
| 6     | `src/app/styles/themes/glassmorphism/orchid.css`                         | Tương tự: tách màu solid fallback `--surface` và `--surface-gradient`.                                                                                                                                                                                                                                                                       |
| 7     | `src/app/styles/themes/glassmorphism/sunset.css`                         | Tương tự: tách màu solid fallback `--surface` và `--surface-gradient`.                                                                                                                                                                                                                                                                       |
| 8     | `src/app/features/layout/components/MainLayout.tsx`                      | **[SỬA MAJOR R2-M7]** Giữ nguyên Server Component, render `<LazyModals />` duy nhất 1 lần tại đây (giữ `src/app/layout.tsx` nguyên vẹn).                                                                                                                                                                                                     |
| 9     | `src/app/features/layout/components/LanguageUpdater.tsx`                 | **[TIẾP THU MINOR m-R4-6]** Cơ chế "đọc trước - ghi sau" với state phản ứng `useState(false)` cho `hasHydrated`; đồng bộ duy nhất `localStorage` và `document.documentElement.lang`.                                                                                                                                                         |
| 10    | `src/app/features/chat/hooks/useLanguage.ts`                             | Xóa bỏ side-effect ghi `localStorage` và `dispatchEvent` khỏi hook; dùng atomic selector cho Zustand store.                                                                                                                                                                                                                                  |
| 11    | `src/app/features/chat/components/ChatApp.tsx`                           | Xóa bỏ effect init dư thừa (dòng 108-115) và dọn dẹp import `LANGS`/`SupportedLanguage` [TIẾP THU MINOR m-R2-4]; sửa `onCreateConversation` (dòng 988) gọi `setSelectedConversationIdAndUrl(currentTask.conversationId)` [SỬA MAJOR R2-M4]; tích hợp `ChatMessagesArea` (Safe P1) [SỬA MAJOR R4-M2], `ScrollToBottomButton`, sửa font <12px. |
| 12    | `src/app/features/gems/components/GemModal.tsx`                          | Thay `window.confirm` bằng `confirm()` từ `confirmStore` (`variant: "danger"`, có guard `isConfirmingRef`, check `useGemStore.getState().hasDirtyEditor`); sửa i18n title.                                                                                                                                                                   |
| 13    | `src/app/features/personas/components/PersonaModal.tsx`                  | Thay `window.confirm` bằng `confirm()` từ `confirmStore` (`variant: "danger"`, có guard `isConfirmingRef`, check `usePersonaStore.getState().hasDirtyEditor` [TIẾP THU MINOR m-R2-3]); sửa i18n title.                                                                                                                                       |
| 14    | `src/app/features/sidebar/components/ProjectNode.tsx`                    | Sửa `handleExport` gọi `downloadConversationById` kèm `try/catch` + `isExporting` + `toast.error(t("exportFailed"))`; thêm `aria-expanded` và `aria-label`; sửa dropdown portal sang `z-(--z-popover)` (`z-[75]`) [SỬA MAJOR R4-M1] và thay `--text-muted`.                                                                                  |
| 15    | `src/app/features/sidebar/components/Sidebar.tsx`                        | Áp dụng `z-(--z-drawer)` cho mobile drawer (`z-[60]`) và overlay (`z-[55]`) [SỬA MAJOR R2-M2]; thay `window.location.href` bằng `router.push('/admin')`; sửa hardcoded strings; loại bỏ prop-drilling `t`.                                                                                                                                   |
| 16    | `src/app/features/sidebar/components/SidebarItem.tsx`                    | Thay 4 icon SVG vẽ tay bằng Lucide icons; thay class portal dropdown sang `z-(--z-popover)` (`z-[75]`) [SỬA MAJOR R4-M1]; chuyển toàn bộ văn bản sang `useLanguage()`.                                                                                                                                                                       |
| 17    | `src/app/features/sidebar/components/SidebarSection.tsx`                 | Thêm `aria-expanded={isExpanded}`; sửa token `--text-muted` thành `--text-secondary`.                                                                                                                                                                                                                                                        |
| 18    | `src/app/features/sidebar/components/Sidebar.test.tsx`                   | **[SỬA MAJOR M4]** Cập nhật test case assert z-index của mobile drawer theo Test Failure Triage Loại C.                                                                                                                                                                                                                                      |
| 19    | `src/app/features/layout/components/HeaderBar.tsx`                       | Thay dynamic imports 4 icons bằng static imports; sửa font <12px; hỗ trợ dịch tên nhóm themes.                                                                                                                                                                                                                                               |
| 20    | `src/app/features/chat/components/InputForm.tsx`                         | Xóa bỏ độ trễ submit 500ms; thêm khóa chống double-submit `isSubmittingRef` cho cả nhánh text và image mode [SỬA MAJOR R2-M6]; truyền dynamic `language` vào `VoiceButton`; sửa hardcoded labels; thay `text-white` bằng semantic token.                                                                                                     |
| 21    | `src/app/features/chat/components/InputForm.test.tsx`                    | **[SỬA MAJOR R2-M5 & R2-M6]** Cập nhật test case kiểm chứng khóa `isSubmittingRef` chặn double-submit và kiểm chứng prop `language` truyền vào SpeechRecognition.                                                                                                                                                                            |
| 22    | `src/app/features/chat/components/hooks/useChatStreamController.ts`      | **[SỬA MAJOR R4-M2]** Viết bổ sung Characterization Tests trước khi trích xuất typewriter; bảo toàn an toàn các callbacks còn lại (Safe P1); bảo toàn 100% logic partial-persistence (`syncPartialMessage`) khi abort; tiêu thụ `useTypewriterBuffer`.                                                                                       |
| 23    | `src/app/features/chat/components/hooks/useChatStreamController.test.ts` | **[SỬA MAJOR R2-M5]** Cập nhật số liệu test hiện có (3 tests, không phải 57); bổ sung 4 characterization tests bao phủ done/flush/error/abort.                                                                                                                                                                                               |
| 24    | `src/app/features/chat/components/hooks/useChatScroll.ts`                | **[SỬA MAJOR R4-M3]** Mở rộng interface trả về: `{ scrollRef, handleScroll, handleTouchStart, handleTouchEnd, isAtBottom, unreadCount, scrollToBottom }`. State `isAtBottom` kích hoạt UI; logic `unreadCount` đếm tin mới khi user cuộn lên xem lịch sử và reset khi cuộn đáy.                                                              |
| 25    | `src/app/features/chat/components/BubbleMarkdown.tsx`                    | Memoize khối Markdown đã hoàn thành; hoãn highlight cú pháp code blocks; sửa "Loading Chart..." i18n.                                                                                                                                                                                                                                        |
| 26    | `src/app/features/chat/components/ChatBubble.tsx`                        | Sửa token `--text-muted` thành `--text-secondary`, thay string "AI is typing" bằng `t("aiIsTyping")`.                                                                                                                                                                                                                                        |
| 27    | `src/components/features/projects/KnowledgePanel.tsx`                    | Bổ sung `toast.error()` và `logger.error()` khi upload/delete thất bại; sửa i18n keys.                                                                                                                                                                                                                                                       |
| 28    | `src/components/ui/ToastContainer.tsx`                                   | Đổi class z-index sang `z-(--z-toast)` (`z-[80]`); sửa `aria-label` i18n.                                                                                                                                                                                                                                                                    |
| 29    | `src/components/ui/dialog.tsx`                                           | **[SỬA MAJOR R2-M2]** Đổi `z-50` thành `z-(--z-modal)` (`z-[70]`) cho cả DialogOverlay (dòng 24) và DialogContent (dòng 41); thay hardcoded text "Close" trong DialogClose bằng thẻ ngữ nghĩa hỗ trợ song ngữ.                                                                                                                               |
| 30    | `src/components/ui/popover.tsx`                                          | **[SỬA MAJOR R4-M1]** Đổi `z-50` sang `z-(--z-popover)` (`z-[75]`) để luôn nổi trên Dialog `z-70`.                                                                                                                                                                                                                                           |
| 31    | `src/components/ui/select.tsx`                                           | **[SỬA MAJOR R4-M1]** Đổi `z-50` sang `z-(--z-popover)` (`z-[75]`) để luôn nổi trên Dialog `z-70`.                                                                                                                                                                                                                                           |
| 32    | `src/components/ui/tooltip.tsx`                                          | **[SỬA MAJOR R4-M1]** Đổi `z-50` sang `z-(--z-popover)` (`z-[75]`) để luôn nổi trên Dialog `z-70`.                                                                                                                                                                                                                                           |
| 33    | `src/components/ui/dropdown-menu.tsx`                                    | **[SỬA MAJOR R4-M1]** Đổi `z-50` sang `z-(--z-popover)` (`z-[75]`) cho DropdownMenuContent và SubContent.                                                                                                                                                                                                                                    |
| 34    | `src/components/ui/alert-dialog.tsx`                                     | **[SỬA MAJOR R4-M1]** Đổi `z-50` sang `z-(--z-popover)` (`z-[75]`) cho content AlertDialog.                                                                                                                                                                                                                                                  |
| 35    | `src/components/ui/IconPicker.tsx`                                       | **[SỬA MAJOR R4-M1]** Thay `<span role="button">` bằng `<button>`; đổi PopoverContent (dòng 142) sang `z-(--z-popover)` (`z-[75]`); sửa `--text-muted`, cỡ chữ `text-[11px]`, i18n.                                                                                                                                                          |
| 36    | `src/app/features/chat/components/StreamErrorBanner.tsx`                 | **[TIẾP THU MINOR m-R4-4]** Đổi class z-index sang `z-(--z-banner)` (`z-[90]`).                                                                                                                                                                                                                                                              |
| 37    | `src/lib/utils/constants.ts`                                             | **[SỬA MAJOR R2-M1]** Khai báo feature flag `ENABLE_VIRTUALIZED_CHAT = false` quản lý kích hoạt virtualization.                                                                                                                                                                                                                              |
| 38-45 | 8 file chứa `--surface-base` theo grep                                   | Sửa toàn bộ `--surface-base` thành `--surface` (gồm `FilePreviewCard.tsx`, không có `IconPicker.tsx` [m-R4-1]).                                                                                                                                                                                                                              |
| 46-52 | 7 file chứa `--surface-hover` theo grep                                  | Sửa toàn bộ `--surface-hover` thành `--control-bg-hover`.                                                                                                                                                                                                                                                                                    |
| 53    | `src/app/features/research/components/ResearchReportPanel.tsx`           | Sửa token `--border-hover` thành `--control-border`; sửa font <12px.                                                                                                                                                                                                                                                                         |
| 54    | `src/app/features/projects/components/ProjectChatView.tsx`               | Sửa token `--border-hover` thành `--control-border` [m-R4-1]; sửa portal dropdown `z-(--z-popover)`.                                                                                                                                                                                                                                         |
| 55    | `src/app/features/image-gen/components/SettingsModal.tsx`                | Sửa font <12px [m-R4-2: đúng thư mục `image-gen/components/`].                                                                                                                                                                                                                                                                               |
| 56    | `src/lib/utils/translations/vi.ts`                                       | Bổ sung toàn bộ khóa dịch tiếng Việt cho các chuỗi đã chuẩn hóa.                                                                                                                                                                                                                                                                             |
| 57    | `src/lib/utils/translations/en.ts`                                       | Bổ sung toàn bộ khóa dịch tiếng Anh đối ứng với `vi.ts`.                                                                                                                                                                                                                                                                                     |

---

### 8. Các Bước Thực Hiện Tuần Tự (Sequential Action Steps)

#### Giai Đoạn 0: Chuẩn Bị & Khởi Tạo Môi Trường

- [ ] 0.1. Kiểm tra trạng thái git và baseline hiện tại: `npm run type-check; npm run lint; npm run test:run; npm run build`.

#### Giai Đoạn 1 (P0): Sửa Blocker B1/R2-M7, Khắc Phục Lỗi Logic, Z-Index & Làm Sạch Tokens

- [ ] 1.1. **Tạo `LazyModals.tsx` & Mount Duy Nhất Tại `MainLayout.tsx` [SỬA B1, R2-M7 & m-R4-5]**:
  - Tạo mới `src/app/features/layout/components/LazyModals.tsx` với chỉ thị `"use client"`.
  - Import dynamic `GemModal` và `PersonaModal` với `{ ssr: false }`, dùng latch `hasOpenedGem` và `hasOpenedPersona` (giữ mounted sau lần mở đầu tiên, ẩn qua `open={isOpen}`) để bảo toàn CSS transition của Radix.
  - Cập nhật `MainLayout.tsx` render `<LazyModals />`. Tuyệt đối không mount tại `src/app/layout.tsx`.
- [ ] 1.2. **Khắc phục xung đột CSS Tokens, Gradient Glassmorphism & Thang Z-Index Toàn Hệ Thống [SỬA M2, M4, R2-M2, R4-M1 & m-R4-4]**:
  - Cập nhật `base.css`: khai báo thang z-scale toàn diện trong `:root` (`--z-drawer: 60; --z-modal: 70; --z-popover: 75; --z-toast: 80; --z-banner: 90;`), cập nhật dòng 162 `body { background: var(--surface-gradient, var(--surface)); }` [m-R2-2]. Bỏ qua bước sửa `blueprint.css` [m-R2-1].
  - Cập nhật `src/components/ui/dialog.tsx:24,41`: đổi `z-50` sang `z-(--z-modal)` cho cả overlay và content [R2-M2].
  - Cập nhật các floating primitives sang `z-(--z-popover)` (`z-[75]`): `popover.tsx:22`, `select.tsx:71`, `tooltip.tsx:22`, `dropdown-menu.tsx:49,66`, `alert-dialog.tsx:21,39`, `IconPicker.tsx:142` [R4-M1].
  - Cập nhật `StreamErrorBanner.tsx:54` sang `z-(--z-banner)` (`z-[90]`) [m-R4-4].
  - Cập nhật `Sidebar.tsx:547,558`: đổi sang `z-(--z-drawer)` cho mobile drawer và overlay [R2-M2].
  - Cập nhật 5 theme glassmorphism (`nebula.css`, `aqua.css`, `holo.css`, `orchid.css`, `sunset.css`): tách `--surface` solid hex và `--surface-gradient`.
  - Cập nhật `tokens.css`: `.bg-surface` và `.theme-surface-canvas` dùng `background: var(--surface-gradient, var(--surface));`.
- [ ] 1.3. **Xóa triệt để token chết [SỬA M6, R2-M3 & m-R4-1]**:
  - Quét và thay thế 100% occurrences của `--text-muted` (9 files thực tế), `--surface-base` (8 files thực tế gồm `FilePreviewCard.tsx`), `--surface-hover` (7 files thực tế), `--border-hover` (2 files thực tế gồm `ResearchReportPanel.tsx` và `ProjectChatView.tsx`), `--text-tertiary` (1 file).
  - Cập nhật `ToastContainer.tsx` dùng `z-(--z-toast)` (`z-[80]`).
  - Cập nhật `SidebarItem.tsx` và `ProjectNode.tsx` dùng `z-(--z-popover)`.
  - Cập nhật `Sidebar.test.tsx` khớp z-scale mới theo Test Failure Triage Loại C.
- [ ] 1.4. **Sửa `confirmStore` trong GemModal & PersonaModal [SỬA M3 & m-R2-3]**:
  - Sử dụng `variant: "danger"`.
  - Bổ sung `isConfirmingRef` chống re-entrancy.
  - Đọc `hasDirtyEditor` mới nhất qua `useGemStore.getState().hasDirtyEditor` (trong `GemModal`) và `usePersonaStore.getState().hasDirtyEditor` (trong `PersonaModal`) sau khi `await`.
  - Dùng key i18n `t("discardChangesTitle")`, `t("discardChangesDesc")`.
  - Tạo file test `GemModal.test.tsx` và `PersonaModal.test.tsx` kiểm chứng TC-01 [R2-M5].
- [ ] 1.5. **Sửa lỗi Export tại `ProjectNode.tsx` [SỬA M10]**:
  - Tích hợp `downloadConversationById` bọc trong `try/catch` + cờ `isExporting`.
  - Toast error qua `toast.error(t("exportFailed"))` và log `logger.error()`.
  - Tạo file test `ProjectNode.test.tsx` kiểm chứng TC-06 [R2-M5].
- [ ] 1.6. **Sửa hydrate & persist ngôn ngữ [SỬA M1, m6, m-R2-4 & m-R4-6]**:
  - Cập nhật `LanguageUpdater.tsx` với cơ chế "đọc trước - ghi sau", sử dụng state phản ứng `const [hasHydrated, setHasHydrated] = useState(false);` thay vì `useRef`.
  - Xóa bỏ effect init tại `ChatApp.tsx:108-115` và dọn dẹp import `LANGS`/`SupportedLanguage`.
  - Xóa bỏ `window.dispatchEvent` khỏi `useLanguage.ts`.
  - Tạo file test `LanguageUpdater.test.tsx` kiểm chứng TC-07 (bao gồm assertion `localStorage.setItem` không bao giờ gọi `"en"` khi ban đầu lưu `"vi"`).
- [ ] 1.7. **Sửa các lỗi điều hướng và tương tác [SỬA R2-M4 & BUG-04/05/06]**:
  - `ChatApp.tsx:988` (callback `onCreateConversation`): gọi trực tiếp `setSelectedConversationIdAndUrl(currentTask.conversationId)` [R2-M4].
  - `KnowledgePanel.tsx`: thêm `toast.error()` và `logger.error()`; tạo file test `KnowledgePanel.test.tsx` kiểm chứng TC-08 [R2-M5].
  - `Sidebar.tsx`: chuyển nút Admin sang `router.push('/admin')`.
  - `InputForm.tsx`: truyền `language` động vào `VoiceButton`.
- [ ] 1.8. **Bổ sung khóa song ngữ đối xứng**: Cập nhật `vi.ts` và `en.ts`, xác nhận `_viCheck` và `_enCheck` không báo lỗi.

#### Giai Đoạn 2 (P1): Tối Ưu Hóa Hiệu Năng & Tái Cấu Trúc An Toàn (Safe P1)

- [ ] 2.1. **Tạo module Typewriter [SỬA M5 & m3]**:
  - Tạo `src/lib/features/chat/typewriter.ts` với hàm thuần `computeCharsToTake`.
  - Tạo co-located test `src/lib/features/chat/typewriter.test.ts` (TC-02).
  - Tạo hook `useTypewriterBuffer.ts` có cleanup RAF loop khi unmount.
- [ ] 2.2. **Tạo module Virtualization, Thuật Toán Bù Cuộn & Mở Rộng `useChatScroll` [SỬA B2, R2-M1 & R4-M3]**:
  - Thêm `ENABLE_VIRTUALIZED_CHAT = false` vào `src/lib/utils/constants.ts`.
  - Tạo `src/lib/features/chat/virtualization.ts` với các hàm thuần: `createSizeCache()`, `computeVisibleRange()`, `calculateVirtualPadding()`, và `computeScrollCompensation(resizedIndex, startIndex, deltaHeight)`.
  - Tạo co-located test `src/lib/features/chat/virtualization.test.ts` (TC-03a, TC-03b, TC-03c).
  - Cập nhật `src/app/features/chat/components/hooks/useChatScroll.ts`: mở rộng return `{ scrollRef, handleScroll, handleTouchStart, handleTouchEnd, isAtBottom, unreadCount, scrollToBottom }`.
  - Tạo co-located test `src/app/features/chat/components/hooks/useChatScroll.test.ts`.
  - Tạo component `ChatMessagesArea.tsx` tiêu thụ module thuần, kết nối `useChatScroll`, thực hiện handoff từ Pinned Streaming Slot sang virtual list (seed DOM height thật và bù offset có điều kiện qua `computeScrollCompensation`), hỗ trợ fallback khi cờ `ENABLE_VIRTUALIZED_CHAT === false`, và cleanup `ResizeObserver.disconnect()`.
- [ ] 2.3. **Characterization Tests & Trích Xuất Module An Toàn (Safe P1) [SỬA R2-M5 & R4-M2]**:
  - Viết 4 characterization tests bổ sung vào `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (hiện có 3 tests, đưa tổng số lên 7 tests) bao phủ: done/flush, typewriter streaming, error rollback, và abort partial persistence.
  - Trích xuất `useTypewriterBuffer.ts` từ `useChatStreamController.ts`.
  - Trích xuất `ChatMessagesArea.tsx` từ `ChatApp.tsx`.
  - Dỡ bỏ mục tiêu số dòng gượng ép <350/<400 dòng đợt này theo khuyến nghị R4-M2; bảo toàn an toàn các luồng callback hiện có.
  - Chạy `npx vitest run src/app/features/chat/components/hooks/useChatStreamController.test.ts` đảm bảo toàn bộ tests pass 100%.
- [ ] 2.4. **Tối ưu Markdown & Khóa Chống Double-Submit Cho InputForm [SỬA R2-M6]**:
  - Hoãn highlight code blocks trong `BubbleMarkdown.tsx` khi đang stream.
  - Xóa bỏ delay trailing 500ms trong `InputForm.tsx`; bổ sung `isSubmittingRef = useRef(false)`, lock trên cả nhánh text và image mode, reset via rAF/isStreaming, snapshot `pendingFileIdsRef`.
  - Cập nhật `InputForm.test.tsx` kiểm chứng TC-09 (chống double-submit trong cùng tick) và kiểm chứng prop `language` của VoiceButton.
  - Thay static imports cho 4 icon trong `HeaderBar.tsx`.

#### Giai Đoạn 3 (P2): Nâng Cấp Accessibility (WCAG 2.2) & Thiết Kế Mobile Nav

- [ ] 3.1. Nâng cấp 31 file có cỡ chữ <12px lên tối thiểu `text-xs` (12px) (bao gồm `image-gen/components/SettingsModal.tsx` [m-R4-2]).
- [ ] 3.2. Bổ sung `aria-expanded` trên `SidebarSection.tsx`, `ProjectNode.tsx`; thêm `aria-label` cho toàn bộ icon buttons.
- [ ] 3.3. Thay thế `<span role="button">` trong `IconPicker.tsx` bằng `<button>`.
- [ ] 3.4. Thay 4 inline SVGs trong `SidebarItem.tsx` bằng Lucide Icons.
- [ ] 3.5. Bổ sung nút nổi `ScrollToBottomButton.tsx` kèm badge unread count kết nối `useChatScroll`.
- [ ] 3.6. Xây dựng `MobileBottomNav.tsx` cho thiết bị di động.

#### Giai Đoạn 4 (P3): Bổ Sung Tính Năng Nâng Cao Có Đặc Tả Đầy Đủ [SỬA R2-M8]

- [ ] 4.1. Xây dựng Command Palette (`Cmd+K`) tại `src/app/features/command-palette/components/CommandPalette.tsx`, mount trong `MainLayout.tsx`, chặn trên `/auth/*` và `/admin`, tìm kiếm qua SWR `"/api/conversations"`, điều hướng `router.push('/?id=' + conv.id)`, bỏ qua khi focus ô nhập liệu, cleanup `removeEventListener`.
- [ ] 4.2. Xây dựng Keyboard Shortcuts Modal (`?`) tại `src/app/features/layout/components/KeyboardShortcutsModal.tsx`, mount trong `MainLayout.tsx`, bỏ qua khi focus ô nhập liệu, có cleanup listener.
- [ ] 4.3. Bổ sung bộ lọc tìm kiếm hội thoại tức thì client-side trên Sidebar.

#### Giai Đoạn 5: Nghiệm Thu Toàn Diện

- [ ] 5.1. Chạy toàn bộ unit tests: `npm run test:run`.
- [ ] 5.2. Chạy full verification suite: `npm run type-check; npm run lint; npm run test:run; npm run build`.
- [ ] 5.3. Thực hiện Checklist Manual Verification trên trình duyệt.
- [ ] 5.4. Cập nhật `docs/CHANGELOG.md` và `docs/lessons-learned.md`.

---

### 9. Test Contract & Manual Verification Checklists

#### 9.1. Unit Test Contracts (Đo Lường Được Bằng Vitest / JSDOM)

| Mã Hợp Đồng | Phân Hệ / Chức Năng                                         | File Test Cụ Thể                                                                                                     | Đầu Vào (Input)                                                                                                                                                                                           | Hành Vi Mong Đợi (Expected Output)                                                                                                                                                                                                                                                                                                                                 | Failure Mode Bị Bắt Lỗi                                                                                                            | Tiêu Chí Pass / Fail                                                                                                                                              |
| :---------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01**   | Modal Unsaved Confirm [SỬA R2-M5]                           | `src/app/features/gems/components/GemModal.test.tsx`<br>`src/app/features/personas/components/PersonaModal.test.tsx` | Gọi hàm đóng modal khi `hasDirtyEditor = true`                                                                                                                                                            | Gọi `confirm()` của store với `variant: "danger"`. Đọc state mới nhất qua `useGemStore.getState().hasDirtyEditor` hoặc `usePersonaStore.getState().hasDirtyEditor` [m-R2-3]. Sau khi resolve: nếu `true` -> gọi `closeModal()`; nếu `false` -> không đóng. Không gọi `window.confirm`.                                                                             | Gọi native `window.confirm`; dùng sai variant; treo Promise do re-entrancy; đóng modal khi resolve `false`.                        | **PASS**: `confirm()` được gọi đúng tham số, modal chỉ đóng khi người dùng xác nhận.<br>**FAIL**: Xuất hiện `window.confirm` hoặc sai variant.                    |
| **TC-02**   | Typewriter Buffer Refactor                                  | `src/lib/features/chat/typewriter.test.ts`                                                                           | Backlog các ngưỡng: 20, 50, 100, 300 ký tự                                                                                                                                                                | `computeCharsToTake(len)` trả về: len <= 30 -> 2; len <= 80 -> 6; len <= 200 -> 12; len > 200 -> `Math.floor(len / 3)`.                                                                                                                                                                                                                                            | Sai lệch giá trị chunk so với thuật toán gốc.                                                                                      | **PASS**: Khớp 100% kết quả với thuật toán hiện tại.<br>**FAIL**: Bất kỳ ngưỡng nào trả về sai số lượng.                                                          |
| **TC-03a**  | Virtualization Size Cache [SỬA R2-M1]                       | `src/lib/features/chat/virtualization.test.ts`                                                                       | `createSizeCache(estimatedHeight=100)`. Set index 0=150, index 1=300.                                                                                                                                     | `get(0) === 150`, `get(2) === 100` (ước lượng fallback), `getPrefixSum(2) === 450`, `getTotalHeight(3) === 550`.                                                                                                                                                                                                                                                   | Trả về `undefined` cho item chưa đo; tính sai prefix sum.                                                                          | **PASS**: Khớp đúng giá trị chiều cao và tổng tích lũy.<br>**FAIL**: Sai lệch prefix sum hoặc lỗi crash khi truy vấn index mới.                                   |
| **TC-03b**  | Virtualization Windowing & Dynamic Padding [SỬA R2-M1]      | `src/lib/features/chat/virtualization.test.ts`                                                                       | `computeVisibleRange(scrollTop=1000, viewportHeight=600, totalCount=100, sizeCache, overscan=3)` & `calculateVirtualPadding(startIndex, endIndex, totalCount, sizeCache)`                                 | Trả về `startIndex` và `endIndex` chính xác dựa trên prefix sum của `sizeCache`, kẹp trong `[0, totalCount-1]`. Tính đúng `paddingTop` và `paddingBottom`.                                                                                                                                                                                                         | Index âm hoặc vượt quá `totalCount`; padding trên/dưới tính sai khiến lệch vị trí cuộn.                                            | **PASS**: Visible range và padding tương thích hoàn hảo với kích thước động.<br>**FAIL**: Index hoặc padding sai lệch.                                            |
| **TC-03c**  | Virtualization Scroll Compensation [SỬA R4-M3]              | `src/lib/features/chat/virtualization.test.ts`                                                                       | `computeScrollCompensation(resizedIndex, startIndex, deltaHeight)` với các trường hợp: (1) `resizedIndex = 2, startIndex = 5, deltaHeight = 80`; (2) `resizedIndex = 7, startIndex = 5, deltaHeight = 80` | Trường hợp (1) `resizedIndex < startIndex`: trả về `80` (bù offset để neo nội dung viewport đọc của user không bị nhảy khi item phía trên thay đổi kích thước). Trường hợp (2) `resizedIndex >= startIndex`: trả về `0` (không bù offset vì item nằm trong hoặc sau viewport hiện tại, tránh kéo giật màn hình khi user đang đọc lịch sử mà item ở đáy streaming). | Trả về bù cuộn vô điều kiện làm giật màn hình khi user đọc lịch sử mà stream ở đáy; hoặc không bù cuộn khi item trên đỉnh mở rộng. | **PASS**: Bù đúng `deltaHeight` khi `resizedIndex < startIndex` và `0` khi `resizedIndex >= startIndex`.<br>**FAIL**: Sai lệch giá trị bù cuộn gây giật màn hình. |
| **TC-03d**  | Chat Scroll State & Unread Counter [SỬA R4-M3]              | `src/app/features/chat/components/hooks/useChatScroll.test.ts`                                                       | Giả lập container chat với hook `useChatScroll`: (1) container ở đáy; (2) cuộn lên vị trí giữa; (3) thêm tin nhắn mới vào danh sách khi `isAtBottom === false`; (4) gọi `scrollToBottom()`                | (1) `isAtBottom === true`, `unreadCount === 0`. (2) `isAtBottom === false`. (3) `unreadCount` tự động tăng thêm 1 cho mỗi tin nhắn mới đến. (4) Gọi `scrollToBottom()` kích hoạt scroll container mượt mà, `unreadCount` reset về 0, `isAtBottom` chuyển sang `true`.                                                                                              | Không cập nhật `isAtBottom` khi cuộn; không tăng `unreadCount` khi có tin mới; không reset unread count khi chạm đáy.              | **PASS**: Toàn bộ test case scroll state và unread counter pass 100%.<br>**FAIL**: Sai lệch trạng thái cuộn hoặc đếm sai số tin chưa đọc.                         |
| **TC-04**   | Dead Token Eradication [SỬA R2-M3 & m-R4-3]                 | Lệnh kiểm tra trong Verification Suite (Git Bash)                                                                    | Xem lệnh Git Bash kiểm chứng tại Mục 9.2 bên dưới                                                                                                                                                         | Output trả về rỗng (0 occurrences).                                                                                                                                                                                                                                                                                                                                | Còn sót token chết trong bất kỳ tệp nào thuộc `src/`.                                                                              | **PASS**: Exit code 1 (grep không tìm thấy dòng nào).<br>**FAIL**: Exit code 0 (tìm thấy ít nhất 1 occurrence).                                                   |
| **TC-04b**  | Typography Sub-12px Eradication [SỬA R2-M3 & m-R4-3]        | Lệnh kiểm tra trong Verification Suite (Git Bash)                                                                    | Xem lệnh Git Bash kiểm chứng tại Mục 9.2 bên dưới                                                                                                                                                         | Output trả về rỗng (0 file nguồn).                                                                                                                                                                                                                                                                                                                                 | Còn sót class `text-[9px]`, `text-[10px]`, `text-[11px]` trong mã nguồn.                                                           | **PASS**: Trả về rỗng (0 file).<br>**FAIL**: Tìm thấy bất kỳ file nguồn nào vi phạm cỡ chữ <12px.                                                                 |
| **TC-05**   | Bilingual Symmetry Check                                    | Hard Gate `tsc`                                                                                                      | TypeScript biên dịch `src/lib/utils/translations/index.ts`                                                                                                                                                | Biến `_viCheck` và `_enCheck` đạt kiểu `true`.                                                                                                                                                                                                                                                                                                                     | Lệch khóa giữa `vi.ts` và `en.ts`.                                                                                                 | **PASS**: `tsc --noEmit` hoàn thành sạch sẽ.<br>**FAIL**: Ném lỗi constraint `Record<EnKeys, string>`.                                                            |
| **TC-06**   | ProjectNode Export Handler [SỬA R2-M5 & M10]                | `src/app/features/sidebar/components/ProjectNode.test.tsx`                                                           | Gọi `handleExport(conv)` trong `ProjectNode`                                                                                                                                                              | Gọi `downloadConversationById(conv.id, conv.title)`. Nếu ném lỗi -> hiển thị `toast.error(t("exportFailed"))` và ghi `logger.error()`. Cờ `isExporting` khóa click kép.                                                                                                                                                                                            | Xuất file text 2 dòng tĩnh; không catch error; cho phép spam click.                                                                | **PASS**: `downloadConversationById` được gọi; toast thông báo đúng trạng thái; catch error đầy đủ.<br>**FAIL**: Tạo blob text giả lập hoặc nuốt lỗi.             |
| **TC-07**   | Language Hydration Persist [SỬA R2-M5, M1 & m-R4-6]         | `src/app/features/layout/components/LanguageUpdater.test.tsx`                                                        | Giả lập `localStorage` đã lưu `"vi"`, mount `LanguageUpdater` sử dụng cờ state `const [hasHydrated, setHasHydrated] = useState(false)`                                                                    | `LanguageUpdater` đọc `"vi"` từ storage và cập nhật vào store trước khi bất kỳ effect ghi nào kích hoạt. Cờ `hasHydrated` chỉ chuyển `true` sau khi đọc xong. `localStorage.setItem` KHÔNG BAO GIỜ bị gọi với đối số `"en"` trong suốt quá trình hydration. Không bị ghi đè thành default `"en"`.                                                                  | Store bị reset về default `"en"` và ghi đè storage; gọi `localStorage.setItem("language", "en")` làm mất dữ liệu người dùng.       | **PASS**: `useLanguageStore.getState().language === "vi"` và `localStorage.setItem` chưa từng được gọi với `"en"`.<br>**FAIL**: Storage bị ghi đè thành `"en"`.   |
| **TC-08**   | Knowledge Error Feedback [SỬA R2-M5]                        | `src/components/features/projects/KnowledgePanel.test.tsx`                                                           | Mô phỏng `onUpload` hoặc `onDelete` ném Exception                                                                                                                                                         | Bắt lỗi trong `catch`, kích hoạt `toast.error()` với thông điệp người dùng và gọi `logger.error()`.                                                                                                                                                                                                                                                                | Nuốt lỗi âm thầm hoặc không kích hoạt toast.                                                                                       | **PASS**: `toast.error` được gọi với message tương ứng.<br>**FAIL**: Không có toast hiển thị khi action lỗi.                                                      |
| **TC-09**   | Submit Double-Lock & Voice Language [SỬA R2-M5 & R2-M6]     | `src/app/features/chat/components/InputForm.test.tsx`                                                                | Nhấn submit 2 lần trong cùng tick / 50ms; thay đổi ngôn ngữ `"vi"` / `"en"`                                                                                                                               | Tin nhắn đầu tiên kích hoạt `onSubmit` ngay lập tức (không trễ 500ms); tin nhắn thứ 2 bị chặn bởi `isSubmittingRef`. `VoiceButton` nhận prop `language` tương ứng `"vi-VN"` / `"en-US"`.                                                                                                                                                                           | Chờ 500ms mới gửi; gửi 2 lần trùng lặp; prop voice button bị hardcode.                                                             | **PASS**: `onSubmit` được gọi đúng 1 lần duy nhất; prop language được truyền động chính xác.<br>**FAIL**: `onSubmit` bị gọi 2 lần hoặc voice language sai lệch.   |
| **TC-10**   | Stream Controller Characterization & Abort Sync [SỬA R2-M5] | `src/app/features/chat/components/hooks/useChatStreamController.test.ts`                                             | 3 tests hiện có + 4 characterization tests: done/flush, typewriter stream, error rollback, abort partial persistence                                                                                      | Toàn bộ 7 test cases pass 100%. Khi stream assistant bị abort, tin nhắn dở dang được đồng bộ vào messages list qua `syncPartialMessage` với cờ `isPartial: true`.                                                                                                                                                                                                  | Tin nhắn dở dang bị biến mất hoàn toàn khi abort; vỡ luồng stream khi phân rã hook.                                                | **PASS**: Pass 100% 7 tests của `useChatStreamController.test.ts`.<br>**FAIL**: Bất kỳ test case stream lifecycle nào bị fail.                                    |

#### 9.2. Lệnh Kiểm Tra Cột Mốc Dead Token & Typography (TC-04 & TC-04b) [SỬA m-R4-3]

Chạy trực tiếp trên Git Bash / POSIX Shell (hoặc PowerShell với lệnh regex tương thích) để tránh xung đột ký tự phân tách bảng Markdown:

```bash
# TC-04: Quét toàn bộ dead tokens (Yêu cầu: Exit code 1 - 0 occurrences)
grep -rE "\-\-(text-muted|surface-base|surface-hover|border-hover|text-tertiary|primary-hover|primary-foreground)\b" src/

# TC-04b: Quét font size < 12px trong file mã nguồn (Yêu cầu: Exit code 1 - 0 file)
grep -rlE "text-\[(9|10|11)px\]" src --exclude="*.test.tsx"
```

#### 9.3. Manual Verification Checklists (Thực Hiện Trên Trình Duyệt Thực Tế)

1. **Kiểm chứng Gradient 5 Theme Glassmorphism**:
   - [ ] Mở lần lượt 5 theme: Nebula, Aqua, Holo, Orchid, Sunset.
   - [ ] Kiểm tra bằng DevTools: Thẻ `<body>` và các container áp dụng `.bg-surface` hiển thị gradient đầy đủ, không bị gạch bỏ invalid value.
   - [ ] Các modal (`GemModal`, `PersonaModal`) mở lên có nền kính mờ `bg-(--surface)/95` chuẩn xác, không bị trong suốt hoàn toàn.
2. **Kiểm chứng Z-Index & Popover / Toast Stacking [SỬA R2-M2 & R4-M1]**:
   - [ ] Mở `GemModal` hoặc `PersonaModal` (`z-(--z-modal): 70`).
   - [ ] Mở `IconPicker` trong modal: Popover picker (`z-(--z-popover): 75`) hiển thị NỔI HOÀN TOÀN trên dialog content (`z-70`), không bị chìm xuống dưới overlay.
   - [ ] Mở các phần tử Radix floating bên trong modal (`Select`, `DropdownMenu`, `Popover`, `Tooltip`): Floating content (`z-(--z-popover): 75`) nổi trên dialog overlay và content (`z-70`).
   - [ ] Kích hoạt một thao tác gây lỗi (ví dụ lưu tên rỗng): Toast thông báo lỗi (`z-(--z-toast): 80`) xuất hiện NỔI HOÀN TOÀN TRÊN cả modal và popover, không bị che khuất.
   - [ ] Khi có lỗi stream, banner `StreamErrorBanner` (`z-(--z-banner): 90`) nổi trên cùng của giao diện.
   - [ ] Mở mobile sidebar drawer (`z-(--z-drawer): 60`): Dialog/Confirm mở lên nằm nổi trên drawer (`z-70`).
   - [ ] Trên mobile drawer (`z-60`), click menu 3 chấm của chat item: Dropdown portal (`z-75`) hiển thị nổi trên drawer, không bị chìm xuống dưới.
3. **Kiểm chứng Ảo Hóa Tin Nhắn, Handoff & Pinned Streaming [SỬA R2-M1 & R4-M3]**:
   - [ ] Mở một cuộc hội thoại có 150+ tin nhắn (kiểm tra với `ENABLE_VIRTUALIZED_CHAT = true` và fallback an toàn khi `false`).
   - [ ] Cuộn nhanh từ đầu đến cuối: không có hiện tượng giật màn hình hoặc nhảy thanh cuộn (scroll jumps).
   - [ ] Trong khi đang ở vị trí giữa lịch sử chat (ví dụ tin nhắn thứ 50), gửi câu hỏi mới hoặc nhận tin stream: Tin nhắn đang stream xuất hiện ở Pinned Streaming Slot ở đáy ngoài virtual list; thanh cuộn GIỮ NGUYÊN VỊ TRÍ ĐỌC của người dùng; thuật toán `computeScrollCompensation` không bù sai khoảng cách; nút "Scroll to Bottom" xuất hiện kèm badge đếm số tin chưa đọc.
   - [ ] Khi stream phát tín hiệu `done`: Kích thước thật của pinned slot được seed vào size cache, handoff êm dịu, không giật màn hình.
   - [ ] Bấm nút "Scroll to Bottom": Màn hình cuộn mượt mà xuống tin nhắn ở đáy, badge unread đếm về 0.
   - [ ] Kiểm tra branch isolation từ commit `a0fd5e8`: Không làm ảnh hưởng đến các tính năng chat cốt lõi.
4. **Kiểm chứng Điều Hướng Deep Research [SỬA R2-M4]**:
   - [ ] Trong Deep Research Report Panel, bấm nút tạo cuộc trò chuyện mới từ báo cáo.
   - [ ] Callback `onCreateConversation` tại `ChatApp.tsx:988` gọi `setSelectedConversationIdAndUrl` giúp URL cập nhật thành `/?id=<new-convo-id>` và giao diện hiển thị đúng cuộc trò chuyện vừa tạo (không còn hash `#conv=`).

---

### 10. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 10.1. Danh Sách Kiểm Thử Co-Located (Đầy Đủ File Nguồn & File Test) [SỬA R2-M5 & R4-M3]

Mọi module logic đều có file kiểm thử co-located đặt cạnh file nguồn tương ứng:

1. `src/lib/features/chat/typewriter.test.ts` (co-located với `src/lib/features/chat/typewriter.ts`)
2. `src/lib/features/chat/virtualization.test.ts` (co-located với `src/lib/features/chat/virtualization.ts`)
3. `src/app/features/chat/components/hooks/useChatScroll.test.ts` (co-located với `src/app/features/chat/components/hooks/useChatScroll.ts`) [SỬA R4-M3]
4. `src/app/features/gems/components/GemModal.test.tsx` (co-located với `GemModal.tsx`)
5. `src/app/features/personas/components/PersonaModal.test.tsx` (co-located với `PersonaModal.tsx`)
6. `src/app/features/sidebar/components/ProjectNode.test.tsx` (co-located với `ProjectNode.tsx`)
7. `src/app/features/layout/components/LanguageUpdater.test.tsx` (co-located với `LanguageUpdater.tsx`)
8. `src/components/features/projects/KnowledgePanel.test.tsx` (co-located với `KnowledgePanel.tsx`)
9. `src/app/features/chat/components/InputForm.test.tsx` (co-located với `InputForm.tsx`)
10. `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (co-located với `useChatStreamController.ts`)

#### 10.2. Lệnh Kiểm Tra Chất Lượng (Verification Commands)

Tuân thủ nghiêm ngặt quy định tại `.agents/rules/02-quality.md`:

```powershell
# Chạy thủ công từng chặng trên Windows PowerShell 5.1 (dùng dấu ;)
npm run type-check; npm run lint; npm run test:run; npm run build

# Hoặc chạy kiểm tra toàn diện một lệnh qua npm scripts
npm run verify; npm run build
```

Yêu cầu nghiệm thu tuyệt đối: **0 errors, 0 warnings trên linter, type-check, unit tests và Next.js build sạch sẽ**.

---

### 11. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risks & Technical Controls)

| Rủi Ro Kỹ Thuật Tiềm Ẩn                                                                                                                                        | Mức Độ     | Biện Pháp Phòng Ngừa Kỹ Thuật Cụ Thể Trong Mã Nguồn                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nhảy vị trí cuộn khi ảo hóa (Scroll Jumps)**: Tin nhắn chat có chiều cao thay đổi linh hoạt do chứa ảnh/code.                                                | Cao        | Sử dụng kỹ thuật **Size Cache (`createSizeCache`) kết hợp ResizeObserver**; tính toán `scroll-padding` động và bù cuộn có điều kiện qua `computeScrollCompensation(resizedIndex, startIndex, deltaHeight)` trong `virtualization.ts` (chỉ bù khi `resizedIndex < startIndex`). Khi handoff stream hoàn tất, seed ngay kích thước DOM thật vào cache. Gọi `disconnect()` khi unmount. [SỬA R2-M1 & R4-M3]                                                                                                               |
| **Mất đồng bộ stream với ảo hóa**: Tin nhắn trợ lý đang stream liên tục tăng kích thước ở đáy danh sách.                                                       | Cao        | Đặt tin nhắn đang stream vào **Pinned Streaming Slot** cố định ở cuối danh sách ngoài virtual window. Chỉ đưa vào cây ảo hóa khi stream phát tín hiệu `done`. Quản lý bằng feature flag `ENABLE_VIRTUALIZED_CHAT` (mặc định `false`, fallback an toàn). [SỬA R2-M1]                                                                                                                                                                                                                                                    |
| **Xung đột Stacking Context giữa Dialog và Floating Primitives**: Nâng Dialog lên `z-70` khiến popover, dropdown, tooltip, select bị chìm dưới dialog overlay. | Cao        | Chuẩn hóa hệ thống z-scale toàn diện (`--z-drawer: 60`, `--z-modal: 70`, `--z-popover: 75`, `--z-toast: 80`, `--z-banner: 90`). Toàn bộ floating primitives (`popover`, `select`, `tooltip`, `dropdown-menu`, `IconPicker`) sử dụng `z-(--z-popover)` (`75`), đảm bảo luôn nổi trên dialog overlay và content (`70`). [SỬA R4-M1]                                                                                                                                                                                      |
| **Gãy build Next.js 16 SWC do dynamic modal**: Bọc `dynamic(..., { ssr: false })` trong Server Component.                                                      | Cao        | Đưa toàn bộ modal dynamic vào client wrapper `LazyModals.tsx` (`"use client"`). Dùng latch `hasOpened` để duy trì modal mounted sau lần mở đầu tiên, bảo toàn animation đóng của Radix (`data-[state=closed]`). Mount duy nhất 1 lần tại `MainLayout.tsx`, giữ nguyên `src/app/layout.tsx`. Chạy `npm run build` ở mọi vòng kiểm chứng. [SỬA B1, R2-M7 & m-R4-5]                                                                                                                                                       |
| **Hồi quy kiểm thử stream controller & ChatApp khi phân rã**: Cố ép số dòng <350/<400 khi chưa có đủ test cho 15 callbacks lớn (~920 dòng).                    | Cao        | Phạm vi phân rã Safe P1 — chỉ trích xuất `useTypewriterBuffer` (~115 dòng) và `ChatMessagesArea` (có test). Dỡ bỏ mục tiêu số dòng gượng ép <350/<400 dòng đợt này theo khuyến nghị R4-M2 để bảo toàn an toàn các luồng callback hiện có. Viết bổ sung 4 characterization tests trước khi phân rã hook (tổng 7 tests). Giữ nguyên 100% logic `syncPartialMessage` và state machine của stream controller. Chạy lại toàn bộ test cases của `useChatStreamController.test.ts` sau mỗi lần chỉnh sửa. [SỬA R2-M5 & R4-M2] |
| **Gửi trùng tin nhắn khi bỏ debounce 500ms**: Người dùng nhấn Enter nhanh nhiều lần trong cùng tick.                                                           | Trung bình | Bổ sung khóa `isSubmittingRef = useRef(false)` trên cả nhánh text và image mode trong `InputForm.tsx`. Chặn ngay nếu in-flight, reset qua `requestAnimationFrame` và trạng thái `isStreaming`/`disabled`. Bảo toàn snapshot `pendingFileIdsRef`. [SỬA R2-M6]                                                                                                                                                                                                                                                           |
| **Vỡ màu giao diện khi đổi theme**: Tách gradient khỏi `--surface` ở 5 theme Glassmorphism.                                                                    | Trung bình | Tạo class tiện ích wrapper `.bg-surface` và `.theme-surface-canvas` trong `tokens.css`: `background: var(--surface-gradient, var(--surface));`. Đồng bộ `base.css:162` (`body { background: var(--surface-gradient, var(--surface)); }`). Kiểm chứng DevTools trên cả 5 theme. [TIẾP THU m-R2-2]                                                                                                                                                                                                                       |
| **Lệch khóa song ngữ gây lỗi compile**: Khi thêm nhiều string mới cho các phân hệ.                                                                             | Thấp       | Kiểm soát máy chặn (Hard Gate) tại `src/lib/utils/translations/index.ts` thông qua 2 biến `_viCheck` và `_enCheck`. Lệnh `npm run type-check` sẽ lập tức báo lỗi ngay nếu có bất kỳ khóa nào bị lệch.                                                                                                                                                                                                                                                                                                                  |

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer ghi nhận xét thẩm định)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 1
- **Kiểm chứng lỗi cũ**: N/A (đây là lượt thẩm định đầu tiên).

#### A. Xác Minh Các Claim Của Plan (đối chiếu codebase)

| Claim trong plan                                | Kết quả                 | Evidence                                                                                                                                                                                                                                                                     |
| :---------------------------------------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-01 `window.confirm` trong Gem/Persona modal | ĐÚNG                    | `[SRC]` `GemModal.tsx:16`, `PersonaModal.tsx:16`                                                                                                                                                                                                                             |
| BUG-02 export stub trong ProjectNode            | ĐÚNG                    | `[SRC]` `ProjectNode.tsx:70-79`                                                                                                                                                                                                                                              |
| BUG-03 side-effect trong `useLanguage`          | ĐÚNG (71 file gọi hook) | `[SRC]` `useLanguage.ts:18-22`; `[CMD]` `grep -rln useLanguage src --include=*.tsx \| wc -l` → 71                                                                                                                                                                            |
| BUG-04 KnowledgePanel silent fail               | ĐÚNG                    | `[SRC]` `KnowledgePanel.tsx:67-68, 92-93` chỉ `setError`                                                                                                                                                                                                                     |
| BUG-05 `language="vi-VN"`                       | ĐÚNG                    | `[SRC]` `InputForm.tsx:324`                                                                                                                                                                                                                                                  |
| BUG-06 `window.location.href = "/admin"`        | ĐÚNG                    | `[SRC]` `Sidebar.tsx:495`                                                                                                                                                                                                                                                    |
| BUG-07 thiếu Suspense cho `useSearchParams`     | PHÓNG ĐẠI               | `[SRC]` `useSearchParams` ở `GemManager.tsx:19`, `PersonaManager.tsx:20` (không phải 25/24); `GemManager` chỉ mount khi Radix `DialogContent` mở; route `/gems` đã bọc `<Suspense>` (`src/app/features/gems/page.tsx`)                                                       |
| CSS-01 gradient trong `--surface`               | ĐÚNG một phần           | `[SRC]` `nebula.css:7-11` là gradient; 33 chỗ dùng `bg-(--surface)` (`background-color` → invalid at computed-value time). NHƯNG `.bg-surface` (`tokens.css:9-11`) dùng shorthand `background:` nên gradient **đang hiển thị đúng** ở 15 chỗ, gồm `<body>` (`layout.tsx:29`) |
| PERF-01 kích thước file                         | ĐÚNG                    | `[CMD]` `wc -l` → ChatApp 1053, useChatStreamController 1039, Sidebar 610                                                                                                                                                                                                    |
| PERF-04 dynamic icon HeaderBar                  | ĐÚNG                    | `[SRC]` `HeaderBar.tsx:22-34`                                                                                                                                                                                                                                                |
| TC-02 "backlog vĩnh viễn"                       | SAI                     | `[SRC]` `useChatStreamController.ts:164-169` đã có sẵn thuật toán `bufferLen/3` khi >200 — đây là refactor, không phải bug fix                                                                                                                                               |
| Next.js version                                 | Lệch nhẹ                | `[CMD]` `node -p "require('./node_modules/next/package.json').version"` → `16.1.4`                                                                                                                                                                                           |

#### B. Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả               | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :--------------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **FAIL**              | `[CMD]` `npm run type-check` → exit 0 (baseline sạch). Nhưng plan sẽ phá build: (1) `next/dynamic({ ssr: false })` trong `MainLayout.tsx` — file này là **Server Component** (không có `"use client"`, import từ root `layout.tsx:4`); `[SRC]` `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` chứa lỗi compile _"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."_ (2) `variant: "warning"` ở bước 1.2 không tồn tại: `[SRC]` `confirmStore.ts:13` chỉ có `"default" \| "danger"` → TS error. |
| **S2 Lifecycle & Teardown**  | **FAIL (UNVERIFIED)** | Plan thêm RAF loop (`useTypewriterBuffer`), `ResizeObserver` (virtualization), global `keydown` listener (Cmd+K, `?`) nhưng không có dòng nào quy định cleanup (`cancelAnimationFrame`, `observer.disconnect()`, `removeEventListener`) hay test isolation. Không đổi SSE server-side → phần abort `req.signal` N/A.                                                                                                                                                                                                                                                              |
| **S3 Database & Temporal**   | PASS (N/A)            | `[SRC]` Plan không chạm migrations / `*.server.ts`; export dùng API sẵn có `download.ts:60-65` (`GET /api/conversations?id=`). Không có transaction mới → Adversarial timeline DB N/A.                                                                                                                                                                                                                                                                                                                                                                                            |
| **S4 Cross-Task State Flow** | **FAIL**              | `[ADV]` xem timeline M1 (mất ngôn ngữ đã lưu), M4 (z-index), M7 (hash `#conv=` không được consume).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **S5 Security Boundary**     | PASS                  | `[SRC]` Không thêm API route, không import `supabase.server.ts` vào client. TOCTOU/SSRF: N/A (không có URL input mới). Command Palette phải dùng dữ liệu SWR/store sẵn có, không tạo endpoint mới.                                                                                                                                                                                                                                                                                                                                                                                |
| **S6 External Resilience**   | PASS (N/A)            | Không đổi provider/stream server. `[SRC]` `downloadConversationById` throw lỗi (`download.ts:81-84`) → caller phải catch (xem M10).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Domain – Bilingual**       | FAIL một phần         | Xem M6/M10: danh sách file thiếu; `download.ts:68,74` throw message tiếng Việt hardcoded và `SidebarItem.tsx:107-109` hiển thị thẳng qua `toast.error(message)`.                                                                                                                                                                                                                                                                                                                                                                                                                  |

#### C. Phân Loại Lỗi

**[BLOCKER]**

- **B1 — Build break: `next/dynamic` `ssr: false` trong Server Component** (bước 2.7, file #25). `MainLayout.tsx` không phải client component (`[SRC]` `MainLayout.tsx:1-15`, `layout.tsx:4,40`). Next 16 SWC từ chối compile (`[SRC]` chuỗi lỗi trong `next-swc.win32-x64-msvc.node`). **Yêu cầu**: tạo wrapper client riêng (vd `src/app/features/layout/components/LazyModals.tsx` có `"use client"`) chứa `dynamic(() => import(...), { ssr: false })`, liệt kê vào [NEW]; hoặc bỏ `ssr: false`. Thêm bước verify `npm run build` (lỗi này không lộ ở type-check).
- **B2 — Rủi ro "Cao" không có technical control được xác minh (evidence-bar §4.5.4)**: 2 rủi ro Cao của virtualization (Scroll Jumps, Stream desync) chỉ nêu tên kỹ thuật ("Size Cache + ResizeObserver", "Pinned Streaming Slot") — không có hàm, file, thuật toán hay bước Verification nào. Hand-rolled virtualization cho danh sách chiều cao động + streaming + auto-scroll là thay đổi rủi ro cao nhất của plan. **Yêu cầu**: (a) đặc tả thuật toán thuần (`computeVisibleRange`, size cache, anchor theo bottom offset) trong `src/lib/features/chat/virtualization.ts` + test; (b) chỉ định interface giữa `ChatMessagesArea` ↔ `useChatScroll` (93 dòng hiện tại) ↔ pinned streaming slot; (c) cleanup `ResizeObserver`; (d) checklist Verification thủ công (hội thoại 200 tin, cuộn nhanh, stream khi đang ở giữa danh sách, branch-isolation từ commit `a0fd5e8`). Khuyến nghị mạnh: tách virtualization sang plan riêng.

**[MAJOR]**

- **M1 — Chuyển side-effect ngôn ngữ sang `LanguageUpdater` sẽ ghi đè preference đã lưu** (bước 1.4).
  ```
  Cơ chế: persist ngôn ngữ qua localStorage
  T1: Reload trang; useLanguageStore khởi tạo language="en" (languageStore.ts:10)
  T2: Passive effects chạy theo thứ tự cây: <LanguageUpdater/> (layout.tsx:37) là sibling ĐỨNG TRƯỚC <Providers>…<ChatApp/>
      → LanguageUpdater ghi localStorage("vikini-language","en")
  T3: Effect init của ChatApp (ChatApp.tsx:108-115) đọc localStorage → "en"
  Kết cục: lựa chọn "vi" của người dùng bị mất sau mỗi reload → LỖI (MAJOR)
  ```
  Lưu ý: bug này **đã tồn tại** hôm nay (effect của `useLanguage` gọi ở `ChatApp.tsx:101` đăng ký trước effect init ở dòng 108), và trên `/admin`, `/auth/*` (không mount ChatApp) thì preference không bao giờ được đọc. **Yêu cầu**: `LanguageUpdater` phải _đọc trước – ghi sau_ (cờ `hydrated`, chỉ ghi sau khi đã hydrate), hoặc dùng `persist` của `zustand/middleware`; xóa init ở ChatApp; thêm Test Contract + test cho kịch bản reload với `"vi"` đã lưu. `[CMD]` grep `vikini-language-change` → không có listener nào → xóa hẳn CustomEvent thay vì di chuyển.
- **M2 — Fix CSS-01 mâu thuẫn và gây hồi quy gradient**: File #9/#10 đổi `bg-surface` → `bg-(--surface)` ở `layout.tsx`/`page.tsx`, trong khi `.bg-surface` (`tokens.css:9-11`, shorthand `background:`) là thứ duy nhất **đang render gradient đúng** → body của 5 theme glass mất gradient. Class `.theme-surface-canvas` chỉ xuất hiện trong bảng rủi ro, không có trong bảng file/bước thực hiện. **Yêu cầu**: chốt 1 phương án: `--surface` = màu solid; `.bg-surface` (hoặc class canvas mới) = `background: var(--surface-gradient, var(--surface))`; liệt kê chính xác phần tử nào nhận canvas gradient; kiểm tra các chỗ dùng alpha `bg-(--surface)/95` (vd `GemModal.tsx:29`). TC-05 cần phương pháp kiểm chứng thực tế (jsdom không nạp CSS theme) → checklist thủ công trên trình duyệt cho 5 theme.
- **M3 — Chuyển sang `confirm()` async chưa đặc tả đúng**: `variant: "warning"` sai type (`confirmStore.ts:13`). `handleOpenChange` hiện đồng bộ (`GemModal.tsx:12-24`); khi chuyển async: người dùng bấm ESC/overlay 2 lần → `request()` lần 2 ghi đè `resolve` (`confirmStore.ts:37-40`) → Promise đầu treo vĩnh viễn. **Yêu cầu**: dùng `variant: "danger"` (hoặc `"default"`), guard in-flight (ref) chống re-entrancy, đọc `hasDirtyEditor` mới nhất qua `useGemStore.getState()` sau `await`; title/description dùng key i18n.
- **M4 — Thang z-index mâu thuẫn & gây hồi quy**: (a) Bước 1.1 định nghĩa `--z-toast: 60` nhưng bước 1.7/file #37 đổi `ToastContainer` → `z-50`, bằng overlay/content Dialog (`dialog.tsx:24,41`, portal gắn sau) → toast lỗi phát ra khi Gem/Persona modal đang mở bị che dưới overlay blur. (b) Dropdown portal ở `ProjectNode.tsx:168`, `SidebarItem.tsx:162` hiển thị trong drawer mobile `z-[60]` (`Sidebar.tsx:558`); đổi xuống `z-50` → menu nằm **dưới** drawer trên mobile. (c) `Sidebar.test.tsx:113-116` đang assert `z-[60]` — plan không nhắc (Test Integrity). **Yêu cầu**: bảng z-scale cụ thể (drawer < dropdown/popover < modal < toast), dùng cú pháp chắc chắn `z-(--z-toast)` với biến khai báo trong `base.css`; liệt kê việc cập nhật `Sidebar.test.tsx` theo Test Failure Triage (thay đổi chủ đích).
- **M5 — Vi phạm co-located test & thiếu nguồn logic**: `src/lib/features/chat/typewriter.test.ts` và `virtualization.test.ts` không có file nguồn tương ứng trong [NEW]; logic lại nằm ở `src/app/.../useTypewriterBuffer.ts`. **Yêu cầu**: thêm [NEW] `src/lib/features/chat/typewriter.ts` (`computeCharsToTake(bufferLen)`) và `virtualization.ts` (hàm thuần tính range/padding); hook chỉ gọi các hàm này. Đồng thời `useChatStreamController.test.ts` đã tồn tại → đưa vào bảng rủi ro regression; phải chứng minh không làm hỏng partial-persistence khi abort (commit `4bac11b`, `syncPartialMessage` quanh `useChatStreamController.ts:334`) — thêm Test Contract riêng.
- **M6 — Danh mục file thiếu so với chính Test Contract**: `[CMD]` grep: `--surface-base` ở 8 file, `--surface-hover` 7 file, `--text-muted` 9 file, `--border-hover` 2 file; font <12px ở **31 file** (plan liệt kê ~7). File bị sót gồm: `FileLightbox`, `FilePreviewCard`, `Canvas`, `ControlPanel`, `DescribeImageView`, `EditPanel`, `PromptBuilder`, `EditPlanModal`, `ResearchReportPanel`, `GemPreview`, `PersonaEditor`, `PersonaPreview`, `auth/signin/page`, `auth/error/page`, `admin/components/PersonasManager`, … Ngoài ra TC-06 yêu cầu 0 occurrence `--text-muted` trong `src/` nhưng bước 1.1 lại **định nghĩa** alias `--text-muted` trong `src/app/styles/themes/_shared/base.css` → tự mâu thuẫn. **Yêu cầu**: cập nhật bảng file đầy đủ theo output grep, chọn 1 trong 2 (alias hay xóa triệt để), TC-06 phủ đủ 7 token + lệnh grep cụ thể.
- **M7 — Điều hướng Deep Research bị chẩn đoán sai**: `[CMD]` grep `#conv\|location.hash\|hashchange` trong `src` → chỉ có chính `ChatApp.tsx:988`; không nơi nào đọc hash → nút tạo hội thoại từ Deep Research **hiện không làm gì**. Đổi sang `useRouter` chung chung không sửa được. **Yêu cầu**: gọi `setSelectedConversationIdAndUrl(conversationId)` từ `useUrlSync` (`useUrlSync.ts:17-18`, sync `?id=`), thêm Test Contract.
- **M8 — Test Contract không đo được / thiếu phủ**: TC-03 (đếm DOM ≤25), TC-04 (<8ms/tick), TC-05 (`getComputedStyle` theme) không chạy được trong vitest/jsdom (không layout, không nạp CSS theme). Thiếu TC cho: persist ngôn ngữ (M1), export ProjectNode (BUG-02), toast trên modal (M4), điều hướng Deep Research (M7), ScrollToBottom, VoiceButton theo ngôn ngữ, bỏ debounce 500ms nhưng vẫn chống double-submit (bước 2.5 — `InputForm.test.tsx` đã tồn tại). **Yêu cầu**: tách mỗi TC thành phần unit (hàm thuần) + checklist verification thủ công ghi rõ thao tác.
- **M9 — Phạm vi và các hạng mục không có đặc tả**: Mermaid P3 có "Contextual Message Toolbar Actions" nhưng không có bước/file nào. Command Palette, KeyboardShortcutsModal, MobileBottomNav: không chỉ định điểm mount, nguồn dữ liệu (SWR key/store nào), xung đột phím (`Cmd+Shift+O`, `?` khi focus trong input/contenteditable), cleanup listener. "Tìm kiếm Sidebar" không có đặc tả. **Yêu cầu**: đặc tả đầy đủ, hoặc (khuyến nghị) giới hạn plan này ở P0 (+ phần P1 an toàn: HeaderBar icon, debounce, lazy modal) và tách virtualization/decomposition, MobileNav, P3 thành các plan riêng — phù hợp nguyên tắc Scope/Minimal diffs của `00-core.md`.
- **M10 — Export ProjectNode thiếu xử lý lỗi**: `downloadConversationById` **throw** (`download.ts:81-84`) với message tiếng Việt hardcoded (`download.ts:68,74`). Bước 1.3 chỉ nói "thay bằng hàm" — thiếu `try/catch` + `toast.error(t(...))` + cờ in-flight (như `SidebarItem.tsx:100-112`), vi phạm `01-coding.md` §Error Handling. **Yêu cầu**: đặc tả handler đầy đủ; hiển thị key i18n thay vì `err.message` thô.

**[MINOR]**

- m1: Sửa số dòng BUG-07 (19/20) và hạ mức — chỉ là `<Suspense>` phòng ngừa, không phải de-opt hiện hữu.
- m2: Bảng Verified Versions ghi `next@16.1.1`; bản cài đặt là `16.1.4`.
- m3: TC-02 mô tả hành vi đã có — ghi rõ là refactor giữ nguyên hành vi.
- m4: `KeyboardShortcutsModal` chứa danh sách phím tắt đặc thù app → nên đặt ở `src/app/features/...` thay vì `src/components/ui/` (chỉ dành cho primitives).
- m5: Thêm `npm run build` vào Verification bên cạnh `npm run verify`.
- m6: Xóa init ngôn ngữ ở `ChatApp.tsx:108-115` cùng lúc với M1 để tránh 2 nguồn hydrate.

#### D. Kết Luận

**[CHANGES_REQUESTED]** — Còn 2 `[BLOCKER]` (B1, B2) và 10 `[MAJOR]` (M1–M10). S1, S2, S4 FAIL/UNVERIFIED.

Việc cần làm cho Revision 2:

1. Sửa B1 (client wrapper cho lazy modals) + thêm `npm run build` vào Verification.
2. Đặc tả virtualization kèm control kiểm chứng được, hoặc tách sang plan riêng (B2, M9).
3. Sửa hydrate/persist ngôn ngữ (M1), phương án gradient canvas nhất quán (M2), confirm async đúng type + chống re-entrancy (M3), bảng z-scale cụ thể + cập nhật `Sidebar.test.tsx` (M4).
4. Bổ sung nguồn `lib/` cho test co-located (M5); cập nhật danh mục file đầy đủ theo grep (M6).
5. Sửa điều hướng Deep Research qua `useUrlSync` (M7); export ProjectNode có try/catch + toast (M10).
6. Viết lại Test Contract: phần unit đo được + checklist thủ công, phủ các hạng mục còn thiếu (M8).

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 2

#### A. Kiểm Chứng Lỗi Cũ (so với Audit Run 1)

| Mã    | Trạng thái                                | Evidence / Ghi chú                                                                                                                                                                                                                                                                          |
| :---- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1    | **ĐÃ SỬA** (phát sinh lỗi mới R2-M7)      | `LazyModals.tsx` có `"use client"` → đúng. Nhưng bảng §7.2 dòng #9 (`layout.tsx`: "bọc `<LazyModals />`") và #10 (`MainLayout.tsx`: "render `<LazyModals />`") → mount 2 lần.                                                                                                               |
| B2    | **SỬA MỘT PHẦN** → hạ xuống MAJOR (R2-M1) | Đã có module thuần + test co-located + Pinned Slot + `disconnect()` + checklist thủ công. Còn thiếu: TC cho `createSizeCache`/`calculateBottomAnchorOffset`/`calculateVirtualPadding`, interface với `useChatScroll`, cách chuyển tin từ pinned slot vào danh sách ảo, đặc tả feature flag. |
| M1    | **ĐÃ SỬA**                                | Đọc trước – ghi sau (`hasHydrated`), xóa init `ChatApp.tsx:108-115`, xóa CustomEvent. `[SRC]` `LanguageUpdater.tsx` hiện chỉ set `lang`; `useLanguage.ts:18-22` là nơi ghi. TC-07 chưa có file test (xem R2-M5).                                                                            |
| M2    | **ĐÃ SỬA**                                | Tách `--surface` / `--surface-gradient`, giữ `.bg-surface` (`tokens.css:7-9` dùng shorthand `background:`). `[SRC]` `nebula.css:7-11` xác nhận `--surface` hiện là gradient.                                                                                                                |
| M3    | **ĐÃ SỬA**                                | `variant: "danger"` khớp `confirmStore.ts:13`; guard re-entrancy + `getState()`. Ghi chú nhỏ m-R2-3.                                                                                                                                                                                        |
| M4    | **SỬA MỘT PHẦN** → R2-M2                  | Toast `z-80` và dropdown `z-70` ổn; `Sidebar.test.tsx` đã được liệt kê. Nhưng `--z-modal` không được áp dụng cho `dialog.tsx`.                                                                                                                                                              |
| M5    | **ĐÃ SỬA** cho nguồn `lib/`               | `typewriter.ts`/`virtualization.ts` đã có trong [NEW]. `[SRC]` `useChatStreamController.ts:105-106,164-169`: `BASE_CHARS_PER_TICK = 2`, ngưỡng 30/80/200 → TC-02 khớp thuật toán gốc. Claim "57 tests" SAI (R2-M5).                                                                         |
| M6    | **CHƯA SỬA** → R2-M3                      | Số lượng file khớp grep nhưng **danh sách file sai**; §5.2 có 3 file không tồn tại.                                                                                                                                                                                                         |
| M7    | **CHƯA SỬA ĐÚNG** → R2-M4                 | Sai file đích và sai cách dùng hook.                                                                                                                                                                                                                                                        |
| M8    | **SỬA MỘT PHẦN** → R2-M5                  | TC đã tách phần unit với checklist thủ công, nhưng 5/10 TC không có file test.                                                                                                                                                                                                              |
| M9    | **CHƯA SỬA** → R2-M8                      | P2/P3 vẫn nằm trong plan, chưa đặc tả điểm mount và nguồn dữ liệu.                                                                                                                                                                                                                          |
| M10   | **ĐÃ SỬA**                                | `try/catch` + `isExporting` + `toast.error(t("exportFailed"))` + `logger.error()`.                                                                                                                                                                                                          |
| m1–m6 | **ĐÃ SỬA**                                | Dòng 19/20; `next@16.1.4`; TC-02 ghi là refactor; `KeyboardShortcutsModal` đặt ở `features/layout`; có `npm run build`; xóa init ở ChatApp.                                                                                                                                                 |

#### B. Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả    | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **FAIL**   | `[CMD]` `npm run type-check` → exit 0 (baseline sạch). `[SRC]` `package.json:7,25` có `build`, `verify`. Không thêm dependency, không có Prisma/Better Auth. Nhưng làm theo §1/§7.2 #26 (gọi `useUrlSync` trong `ResearchReportPanel`) sẽ lỗi TS: `useUrlSync.ts:11-14,31-34` yêu cầu bắt buộc `{ selectedConversationId, setSelectedConversationId }`. §5.2 chỉ định sửa 3 file không tồn tại (`GemCard.tsx`, `PersonaCard.tsx`, `admin/components/StatsCard.tsx`). |
| **S2 Lifecycle & Teardown**  | PASS       | Đã quy định `cancelAnimationFrame` (hook typewriter; pattern RAF hiện có tại `useChatStreamController.ts:157-175`), `ResizeObserver.disconnect()`, `removeEventListener` cho Cmd+K/`?`. Không đổi SSE server → `req.signal` N/A.                                                                                                                                                                                                                                     |
| **S3 Database & Temporal**   | PASS (N/A) | Không chạm migrations / `*.server.ts`. Export dùng lại `downloadConversationById` sẵn có.                                                                                                                                                                                                                                                                                                                                                                            |
| **S4 Cross-Task State Flow** | **FAIL**   | `[ADV]` R2-M4 (instance `useUrlSync` thứ 2 không biết state của ChatApp), R2-M7 (2 instance modal cùng subscribe 1 store), R2-M8 (`conversations` là `useState` cục bộ trong `useConversation.ts:196`, không phải store global).                                                                                                                                                                                                                                     |
| **S5 Security Boundary**     | PASS       | Không có API route mới, không import `*.server.ts` vào client. Lưu ý: nếu mount Command Palette ở `MainLayout` thì nó cũng chạy trên `/auth/*` và gọi `useSWR("/api/conversations")` (`useConversation.ts:208`) khi chưa đăng nhập → 401. Không phải lỗ hổng bảo mật nhưng cần chặn (R2-M8).                                                                                                                                                                         |
| **S6 External Resilience**   | PASS (N/A) | Không đổi provider/stream. Lỗi export được bắt và dịch qua key i18n.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Domain – Bilingual**       | PASS       | Key mới (`discardChangesTitle`, `discardChangesDesc`, `exportFailed`, `aiIsTyping`) chưa tồn tại (`[CMD]` grep `translations/` → 0), đã có bước bổ sung ở cả `vi.ts`/`en.ts` + hard gate `_viCheck`/`_enCheck`.                                                                                                                                                                                                                                                      |

#### C. Phân Loại Lỗi

**[BLOCKER]**: Không còn.

**[MAJOR]**

- **R2-M1 — Virtualization: control cho rủi ro "Cao" chưa có contract kiểm chứng** (còn sót từ B2).
  - TC-03 dùng `itemHeight` cố định, trong khi thiết kế dựa trên size cache cho chiều cao động → chữ ký hàm tự mâu thuẫn.
  - Chưa có TC cho `calculateBottomAnchorOffset`. Đây chính là control chống scroll jump.
  - Chưa có TC cho `createSizeCache` (set/get/prefix sum, xử lý item chưa đo) và `calculateVirtualPadding`.
  - Chưa quy định quan hệ với `useChatScroll` (`ChatApp.tsx:448-453`, đang giữ `scrollRef`/`handleScroll`/auto-scroll theo `streamingAssistant`): hook nào sở hữu scroll container, hook nào quyết định auto-scroll.
  ```
  Cơ chế: chuyển tin nhắn từ Pinned Streaming Slot vào virtual list
  T1: Stream "done" → tin dài 2.000px chuyển từ pinned slot vào danh sách ảo
  T2: Size cache chưa có kích thước thật của index mới → dùng chiều cao ước lượng (vd 100px)
  T3: Padding dưới tính theo ước lượng; ResizeObserver đo lại sau 1 frame
  Kết cục: thanh cuộn nhảy khoảng 1.900px trong 1 frame nếu không neo theo bottom offset → LỖI (MAJOR)
  ```
  **Yêu cầu**:
  - Ghi rõ chữ ký các hàm, dùng size cache thay cho `itemHeight` cố định.
  - Thêm TC cho anchor/size cache/padding.
  - Khi handoff, lấy kích thước đo cuối cùng của pinned slot seed vào cache.
  - Đặc tả interface giữa `ChatMessagesArea` ↔ `useChatScroll` ↔ `ScrollToBottomButton` (nguồn của unread count).
  - Feature flag: nêu rõ vị trí (`lib/utils/constants.ts`?) và giá trị mặc định.
  - Thêm vào checklist thủ công: kiểm tra branch isolation (commit `a0fd5e8`).
  - Khuyến nghị vẫn giữ nguyên: tách virtualization sang plan riêng.
- **R2-M2 — Thang z-index khai báo nhưng không được áp dụng cho Dialog**.
  - `[SRC]` `dialog.tsx:24,41` overlay/content vẫn `z-50`, và plan không sửa z-index trong `dialog.tsx` (§7.2 #29 chỉ đổi chữ "Close").
  - Bảng §1.3 ghi `--z-modal: 70 /* Dialogs, Confirm modals */` và checklist §9.2 mục 2 kiểm "GemModal (`z-70`)" → sai với thực tế sau khi triển khai.
  - Hệ quả: drawer mobile `z-60` (`Sidebar.tsx:558`) và overlay `z-[55]` (`Sidebar.tsx:547`) vẫn nằm **trên** mọi Dialog/Confirm (`z-50`). Thang "drawer < modal" mà plan tuyên bố không đúng.
  - `--z-dropdown: 50` được khai báo nhưng không nơi nào dùng.

  **Yêu cầu**:
  - Áp `z-(--z-modal)` cho overlay/content trong `dialog.tsx` (primitive dùng chung, nên kiểm tra tác động lên mọi Dialog), hoặc sửa lại bảng z-scale và checklist cho đúng thực tế.
  - Đổi `Sidebar.tsx:547,558` sang `z-(--z-drawer)` và ghi rõ trong bước 1.3.
  - Khai báo biến trong `:root`, không đặt trong `@theme`.

- **R2-M3 — Danh mục file của §5 sai so với grep (M6 chưa sửa)**. `[CMD]` `grep -rlE -- "--<token>\b" src`:
  - `--text-muted` thực tế: `ChatBubble`, `GemPreview`, `PersonaEditor`, `PersonaPreview`, `ProjectChatView`, `ProjectNode`, `Sidebar`, `SidebarSection`, `IconPicker`. Plan liệt kê nhầm `FileLightbox`, `admin/PersonasManager`, `EditPlanModal`, và sót `GemPreview`, `PersonaEditor`, `PersonaPreview`.
  - `--surface-base`: sót `FileLightbox.tsx`, liệt kê nhầm `PromptBuilder.tsx`.
  - `--surface-hover` thực tế: `GalleryView`, `ControlPanel`, `DescribeImageView`, `EditPanel`, `PromptBuilder`, `EditPlanModal`, `ResearchPlanCard`. Plan liệt kê nhầm `ResearchReportPanel`, `GemPreview`, `PersonaEditor`, `PersonaPreview`, `auth/signin/page`.
  - `--border-hover`: thực tế là `ResearchReportPanel.tsx` (không phải `CreateProjectModal.tsx`).
  - §5.2 (font <12px): `[CMD]` `grep -rlE "text-\[(9|10|11)px\]" src` → 33 file (31 file nguồn + 2 file test chỉ assert phủ định).
    - Plan có **13 mục không khớp**. 3 mục không tồn tại: `gems/components/GemCard.tsx`, `personas/components/PersonaCard.tsx`, `admin/components/StatsCard.tsx`. 10 mục còn lại tồn tại nhưng không chứa class này: `TokenBadge`, `BubbleHelpers`, `VoiceButton`, `FilePreviewArea`, `DashboardView`, `GemQuickSwitch`, `PersonaQuickSwitch`, `ImageCompareModal`, `ResearchProgressCard`, `ResearchThinkingPanel`.
    - Plan **sót 13 file nguồn**: `admin/components/PersonasManager`, `auth/error/page`, `chat/ImageGenPreview`, `image-gen/Canvas`, `DescribeImageView`, `ImageLightbox`, `SettingsModal`, `StyleSelector`, `TagInput`, `PersonaEditor`, `PersonaList`, `EditPlanModal`, `ResearchReportPanel`.
  - TC-04: regex thiếu `primary-foreground`. `git grep` bỏ qua file chưa tracked (nhiều file đang untracked/modified) → dùng `grep -rE ... src/`.

  **Yêu cầu**: dán lại đúng output grep; thêm TC cho font (`grep -rlE "text-\[(9|10|11)px\]" src --exclude=*.test.tsx` → rỗng).

- **R2-M4 — Sửa điều hướng Deep Research sai file và sai cách dùng hook** (M7 chưa sửa).
  - `[SRC]` Hash `#conv=` nằm ở `ChatApp.tsx:988` (callback `onCreateConversation`), không nằm trong `ResearchReportPanel.tsx`. Panel chỉ nhận prop `onCreateConversation` (`ResearchReportPanel.tsx:32,352`).
  - `useUrlSync` là hook có state và bắt buộc tham số (`useUrlSync.ts:31-34`). Gọi lần 2 trong panel sẽ tạo instance không liên kết với `selectedConversationId` của ChatApp.
  - `setSelectedConversationIdAndUrl` đã có sẵn trong scope ChatApp (`ChatApp.tsx:192`).

  **Yêu cầu**: sửa tại `ChatApp.tsx:988` bằng `setSelectedConversationIdAndUrl(currentTask.conversationId)`, bỏ `ResearchReportPanel.tsx` khỏi bước này (nó vẫn nằm trong danh sách token).

- **R2-M5 — Test Contract không có nơi thực thi và dựa vào số liệu sai**.
  - `[CMD]` `npx vitest run .../useChatStreamController.test.ts` → **3 tests**, không phải 57. TC-10, §8 bước 2.3 và bảng rủi ro §11 đều dựa vào con số 57.
  - Với việc tách một hook 1.040 dòng, 3 test (chỉ phủ `cancelStream`) không đủ làm lưới an toàn.
  - TC-01, TC-06, TC-07, TC-08, TC-09 ghi là "Vitest/JSDOM" nhưng không có file test nào trong §7/§10.1. `InputForm.test.tsx` đã tồn tại nhưng không nằm trong [MODIFY]. Chưa có TC cho `VoiceButton` theo ngôn ngữ.

  **Yêu cầu**:
  - Sửa lại số liệu.
  - Viết **characterization tests** cho stream controller (luồng done/typewriter flush/error/abort) _trước_ khi phân rã.
  - Chỉ định file test cho từng TC: `GemModal.test.tsx`, `LanguageUpdater.test.tsx`, `ProjectNode.test.tsx`, `KnowledgePanel.test.tsx`, cập nhật `InputForm.test.tsx`.

- **R2-M6 — `isSubmittingRef` không tồn tại; bỏ debounce sẽ mở ra lỗi gửi trùng**.
  - `[CMD]` `grep -rn isSubmittingRef src` → 0 kết quả.
  - `[SRC]` `InputForm.tsx:159-165,185`: chính debounce trailing 500ms đang là cơ chế gộp nhiều lần nhấn thành 1 lần gửi.
  - Plan ghi "bảo toàn" một cơ chế không có.

  ```
  Cơ chế: chống double-submit sau khi bỏ debounce
  T1: Enter → handleSubmit → onSubmit() gọi ngay; input chưa được parent clear (setState async)
  T2: Enter lần 2 trong cùng tick/frame → input.trim() vẫn khác rỗng, disabled chưa cập nhật
  Kết cục: onSubmit bị gọi 2 lần → tin nhắn trùng → LỖI (MAJOR)
  ```

  **Yêu cầu**: đặc tả lock mới cho cả nhánh text và nhánh image mode, gồm:
  - Vị trí set lock.
  - Điều kiện reset: khi `isStreaming`/`disabled` chuyển trạng thái, hoặc sau `onSubmit` ở microtask kế tiếp.
  - Giữ snapshot `pendingFileIdsRef`/`markAsSent`.

  TC-09 cần test cụ thể trong `InputForm.test.tsx`.

- **R2-M7 — Mount `LazyModals` 2 lần**. Bảng §7.2 #9 (`layout.tsx`) và #10 (`MainLayout.tsx`) đều render `<LazyModals />`, và `layout.tsx:39-42` đã bọc `MainLayout`. Hai `GemModal` cùng subscribe `useGemStore` → mở 2 Dialog chồng nhau và gọi `confirm()` 2 lần; `request()` lần 2 ghi đè `resolve` (`confirmStore.ts:37-40`), khiến Promise đầu treo. **Yêu cầu**: chỉ mount trong `MainLayout.tsx`, giữ nguyên `layout.tsx`. Thêm gợi ý: `ssr:false` vẫn tải chunk ngay khi mount → muốn lazy thật thì render có điều kiện theo `isOpen`.
- **R2-M8 — P2/P3 vẫn thiếu đặc tả** (M9 chưa sửa).
  - Command Palette mount ở `MainLayout` sẽ chạy trên mọi route, kể cả `/auth/*` và `/admin`.
  - "Dữ liệu hội thoại từ SWR/Zustand sẵn có" không đúng: `conversations` là `useState` trong `useConversation.ts:196`. Mỗi lần gọi `useConversation()` là một instance mới (4 nơi gọi).
  - Muốn chọn hội thoại phải đi qua URL sync của ChatApp. "Đổi model" là state cục bộ của ChatApp (`ChatApp.tsx:455-470`).
  - `MobileBottomNav`, `KeyboardShortcutsModal`, tìm kiếm Sidebar: chưa có điểm mount, danh sách mục, nguồn dữ liệu và test.

  **Yêu cầu**: tách P2 (MobileBottomNav, ScrollToBottom) và P3 sang plan riêng (khuyến nghị), hoặc đặc tả đủ: route guard, SWR key, hành động điều hướng (`router.push("/?id=")`), quy tắc bỏ qua khi focus trong input/contenteditable, và test.

**[MINOR]**

- m-R2-1: `blueprint.css` không thiếu token. `--surface-elevated` và `--accent-foreground` đã có mặc định ở `base.css:75,87` và được thừa kế → bước thêm là thừa (vô hại).
- m-R2-2: `base.css:162` (`body { background: var(--surface); }`) nên đổi sang `var(--surface-gradient, var(--surface))` cho nhất quán. Hiện `.bg-surface` trên `<body>` đang override nên không lỗi.
- m-R2-3: PersonaModal phải đọc `usePersonaStore.getState().hasDirtyEditor`, không phải `useGemStore` (§1 dòng 18 chỉ ghi `useGemStore`).
- m-R2-4: Sau khi xóa effect `ChatApp.tsx:108-115`, dọn import `LANGS`/`SupportedLanguage` nếu không còn dùng (tránh warning lint).
- m-R2-5: §1.3 (dòng 56) gọi tiêu chí "0 occurrence" là TC-06, nhưng trong bảng §9 kiểm tra dead token là TC-04.

#### D. Kết Luận

**[CHANGES_REQUESTED]** — 0 `[BLOCKER]`, 8 `[MAJOR]` (R2-M1 → R2-M8), 5 `[MINOR]`. S1 và S4 FAIL.

Việc cần làm cho Revision 3:

1. Sửa điều hướng Deep Research tại `ChatApp.tsx:988` (R2-M4); chỉ mount `LazyModals` một lần (R2-M7).
2. Đặc tả lock chống double-submit mới cho `InputForm` và test (R2-M6).
3. Áp `--z-modal` vào `dialog.tsx` và `--z-drawer` vào `Sidebar.tsx`, hoặc sửa lại bảng z-scale (R2-M2).
4. Dán lại đúng output grep cho §5.1/§5.2; sửa regex TC-04; thêm TC font (R2-M3).
5. Sửa số liệu "57 tests" → 3; thêm characterization tests trước khi phân rã; chỉ định file test cho TC-01/06/07/08/09 (R2-M5).
6. Hoàn thiện contract cho virtualization (size cache, anchor, handoff, interface với `useChatScroll`, feature flag) hoặc tách plan (R2-M1); tách/đặc tả P2–P3 (R2-M8).

### Audit Run 3

[REVIEWER_MODEL: gemini-3.8-flash]

- **Reviewer**: Fallback Lead Architecture Reviewer (@reviewer — Gemini 3.8 Flash)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 3
- **Kiểm chứng lỗi cũ**: Đối soát 8 điểm [MAJOR] (R2-M1 → R2-M8) và 5 [MINOR] từ Audit Run 2.

#### A. Kiểm Chứng Lỗi Cũ (so với Audit Run 2)

| Mã         | Trạng thái                | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :--------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R2-M1**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Đã hoàn thiện toàn diện contract toán học thuần trong `src/lib/features/chat/virtualization.ts` (`createSizeCache`, `computeVisibleRange`, `calculateVirtualPadding`, `calculateBottomAnchorOffset`) kèm co-located test `virtualization.test.ts` (TC-03a, 03b, 03c). Đặc tả cơ chế handoff từ Pinned Streaming Slot: seed DOM height đo thật vào size cache khi `done`, neo bottom offset chống scroll jump 1 frame. Ranh giới kiến trúc rõ ràng: `useChatScroll` tiếp tục là single source of truth sở hữu `scrollContainerRef`, truyền ref cho `ChatMessagesArea.tsx`. Feature flag `ENABLE_VIRTUALIZED_CHAT = false` tại `src/lib/utils/constants.ts` bảo vệ an toàn branch isolation từ commit `a0fd5e8`. `ResizeObserver.disconnect()` được dọn dẹp khi unmount. |
| **R2-M2**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Thang z-scale chuẩn hoá trong `:root` của `src/app/styles/themes/_shared/base.css` (`--z-dropdown: 50; --z-drawer: 60; --z-modal: 70; --z-toast: 80;`). Đồng bộ áp dụng `z-(--z-modal)` (`z-[70]`) cho cả overlay và content trong `src/components/ui/dialog.tsx:24,41`. Áp dụng `z-(--z-drawer)` (`z-[60]`) cho overlay và drawer trong `src/app/features/sidebar/components/Sidebar.tsx:547,558`. Áp dụng `z-(--z-toast)` (`z-[80]`) cho `ToastContainer.tsx`. Kê khai cập nhật `Sidebar.test.tsx` theo Test Failure Triage Loại C.                                                                                                                                                                                                                                  |
| **R2-M3**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Dán chính xác 100% output grep thực tế vào §5.1 (9 file `--text-muted`, 8 file `--surface-base`, 7 file `--surface-hover`, 1 file `--border-hover`, 1 file `--text-tertiary`, 1 file `--primary-hover` / `--primary-foreground`) và §5.2 (đủ 31 file nguồn cho cỡ chữ <12px). TC-04 cập nhật regex đầy đủ `primary-foreground` và dùng `grep -rE ... src/`. Bổ sung TC-04b kiểm soát tuyệt đối cỡ chữ <12px với 0 occurrences.                                                                                                                                                                                                                                                                                                                                         |
| **R2-M4**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Đã sửa đúng vị trí: tại `src/app/features/chat/components/ChatApp.tsx:988` (callback `onCreateConversation` của `ResearchReportPanel`), gọi trực tiếp `setSelectedConversationIdAndUrl(currentTask.conversationId)` (đã có sẵn trong scope ChatApp tại dòng 192). Bỏ hash ảo `#conv=` vô nghĩa. Loại bỏ `ResearchReportPanel.tsx` khỏi danh sách sửa điều hướng (panel chỉ nhận prop callback).                                                                                                                                                                                                                                                                                                                                                                        |
| **R2-M5**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Điều chỉnh chính xác số liệu test hiện có của `useChatStreamController.test.ts` (3 tests, không phải 57, đã kiểm chứng qua `npx vitest run ...`). Bổ sung 4 Characterization Tests bao phủ done/flush, typewriter streaming, error rollback, và abort partial-persistence nâng tổng số lên 7 tests trước khi phân rã. Chỉ định rõ ràng file test cho từng TC: TC-01 (`GemModal.test.tsx`, `PersonaModal.test.tsx`), TC-06 (`ProjectNode.test.tsx`), TC-07 (`LanguageUpdater.test.tsx`), TC-08 (`KnowledgePanel.test.tsx`), TC-09 (`InputForm.test.tsx`).                                                                                                                                                                                                               |
| **R2-M6**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Đặc tả khóa chống double-submit chủ động `isSubmittingRef = useRef(false)` trên cả nhánh tin nhắn văn bản và nhánh tạo ảnh (image mode). Thiết lập `isSubmittingRef.current = true` ngay trước khi gọi `onSubmit()`, chặn tức thì các lệnh submit kế tiếp trong cùng tick/frame. Giải phóng khóa khi `isStreaming`/`disabled` chuyển trạng thái hoặc qua microtask/rAF. Bảo toàn snapshot `pendingFileIdsRef` và `markAsSent`. TC-09 và file test `InputForm.test.tsx` kiểm chứng cụ thể.                                                                                                                                                                                                                                                                              |
| **R2-M7**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | `<LazyModals />` chỉ được render duy nhất 1 lần trong `src/app/features/layout/components/MainLayout.tsx`. Giữ nguyên `src/app/layout.tsx` (loại bỏ hoàn toàn khỏi bảng `[MODIFY]`). Thêm điều kiện render lazy thực thụ theo cờ `isOpen` trong store (`useGemStore((s) => s.isOpen)`, `usePersonaStore((s) => s.isOpen)`). Triệt tiêu nguy cơ mở 2 Dialog chồng nhau và xung đột Promise `confirmStore`.                                                                                                                                                                                                                                                                                                                                                              |
| **R2-M8**  | **ĐÃ KHẮC PHỤC TRIỆT ĐỂ** | Xác định rõ ràng ranh giới thực thi trực tiếp: tập trung toàn lực vào Giai đoạn P0 và Safe P1. Hạng mục P2/P3 được giữ lại với đặc tả kỹ thuật chi tiết: route-guard qua `usePathname()` chặn `/auth/*` và `/admin` tránh lỗi 401 SWR `"/api/conversations"`, điều hướng chọn hội thoại bằng `router.push('/?id=' + conv.id)`, bộ lọc bỏ qua khi `e.target` là `input`/`textarea`/`isContentEditable`, và cleanup listener đầy đủ.                                                                                                                                                                                                                                                                                                                                     |
| **m-R2-1** | **ĐÃ TIẾP THU**           | Bỏ qua việc sửa `blueprint.css` do các tokens đã được kế thừa chuẩn từ `base.css`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **m-R2-2** | **ĐÃ TIẾP THU**           | Cập nhật `base.css:162` (`body { background: var(--surface-gradient, var(--surface)); }`) đồng bộ nhất quán.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **m-R2-3** | **ĐÃ TIẾP THU**           | `PersonaModal` đọc `usePersonaStore.getState().hasDirtyEditor` thay vì đọc nhầm `useGemStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **m-R2-4** | **ĐÃ TIẾP THU**           | Dọn dẹp import `LANGS`/`SupportedLanguage` sau khi xóa effect khởi tạo tại `ChatApp.tsx:108-115`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **m-R2-5** | **ĐÃ TIẾP THU**           | Đồng bộ định danh TC-04 kiểm soát dead tokens trong toàn bộ văn bản kế hoạch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### B. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch bản                     | Kết quả        | Evidence / Ghi chú                                                                                                                                                                                                                                                                            |
| :--------------------------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS**       | `[CMD]` `npm run type-check` exit code 0 (clean baseline). `[SRC]` `LazyModals.tsx` có chỉ thị `"use client"` giải quyết triệt để lỗi Next.js 16 SWC compile crash. Không phụ thuộc Prisma/Better Auth. Không import thiếu module.                                                            |
| **S2 Lifecycle & Teardown**  | **PASS**       | `[SRC]` Quy định cleanup đầy đủ: `ResizeObserver.disconnect()` trong `ChatMessagesArea.tsx`, `cancelAnimationFrame` trong `useTypewriterBuffer.ts`, `removeEventListener` cho phím tắt toàn cục. Stream abort bảo toàn partial-persistence qua `syncPartialMessage` với cờ `isPartial: true`. |
| **S3 Database & Temporal**   | **PASS (N/A)** | `[SRC]` Kế hoạch tập trung 100% vào tầng Presentation / Client UI state. Không thay đổi DB schema, migrations, RLS policies hay server handlers.                                                                                                                                              |
| **S4 Cross-Task State Flow** | **PASS**       | `[ADV]` Xem 5 Adversarial Timelines chi tiết bên dưới: ngôn ngữ hydrate đọc-trước-ghi-sau, Deep Research đồng bộ `?id=`, modal mount đơn lập, chống double-submit, và handoff danh sách ảo không giật cuộn.                                                                                   |
| **S5 Security Boundary**     | **PASS**       | `[SRC]` Không lộ API route mới, không import `supabase.server.ts` vào client. Command Palette có route-guard ngăn ngừa rò rỉ hoặc lỗi 401 khi ở trang public/auth.                                                                                                                            |
| **S6 External Resilience**   | **PASS**       | `[SRC]` Đầy đủ khối `try/catch`, toast lỗi người dùng, và log `logger.error()` tại `ProjectNode.tsx` (export) và `KnowledgePanel.tsx` (upload/delete).                                                                                                                                        |
| **Domain – Bilingual & UI**  | **PASS**       | `[SRC]` Tuân thủ `.agents/rules/04-bilingual.md`. Kiểm soát đối xứng khóa qua hard gate TypeScript compile-time (`_viCheck`, `_enCheck`). Thang z-index và tokens Tailwind v4 chuẩn hoá. Nâng cấp 31 file font <12px đạt chuẩn WCAG 2.2.                                                      |

#### C. Adversarial Timelines (Kiểm Chứng 5 Trục Đối Kháng Bắt Buộc)

1. **Cơ chế: Handoff Pinned Streaming Slot sang Virtual List (R2-M1)**
   - T1: Assistant đang stream câu trả lời dài 2,000px trong Pinned Streaming Slot cố định ở đáy ngoài virtual window.
   - T2: Stream kết thúc (`done`), hệ thống lập tức đo chiều cao DOM thật của pinned slot và seed vào cache (`sizeCache.set(index, 2000)`).
   - T3: Hệ thống tính `calculateBottomAnchorOffset(prevScrollTop, prevScrollHeight, newScrollHeight)` bù đắp chính xác phần tăng trưởng chiều cao trước khi danh sách ảo render lại ở frame kế tiếp.
   - Kết cục: Vị trí cuộn của người dùng được giữ nguyên 100%, không bị nhảy cuộn (scroll jump 1 frame) → **AN TOÀN**.

2. **Cơ chế: Khóa Chống Double-Submit Trong `InputForm` (R2-M6)**
   - T1: Người dùng nhấn Enter / click Send lần 1; `handleSubmit` kiểm tra `isSubmittingRef.current === false` → lập tức gán `isSubmittingRef.current = true`, snapshot `pendingFileIdsRef`, gọi `markAsSent`, và kích hoạt `onSubmit()` tức thì (0ms latency).
   - T2: Người dùng nhấn phím liên tục lần 2 trong cùng tick / 50ms khi React chưa kịp re-render cập nhật `disabled`; `handleSubmit` phát hiện `isSubmittingRef.current === true` → chặn và return ngay lập tức.
   - T3: Khi `isStreaming` chuyển sang `true` hoặc qua microtask/rAF tiếp theo, khóa `isSubmittingRef.current` được giải phóng về `false`.
   - Kết cục: `onSubmit` được gọi duy nhất 1 lần, không tạo tin nhắn trùng lặp, không mất file đính kèm → **AN TOÀN**.

3. **Cơ chế: Persist & Hydrate Ngôn Ngữ "Đọc Trước - Ghi Sau" (M1/R2-M5)**
   - T1: Người dùng đã lưu ngôn ngữ `"vi"` trong `localStorage` trước đó và tải lại trang; Zustand store khởi tạo mặc định `"en"`.
   - T2: `LanguageUpdater.tsx` mount; effect với cờ `hasHydrated = false` chỉ đọc `localStorage.getItem("vikini-language")` (đọc ra `"vi"`), nạp vào store qua `setLanguage("vi")`, sau đó mới chuyển `hasHydrated = true`.
   - T3: Sau khi đã hydrated, các thay đổi tiếp theo của store mới được phép ghi vào `localStorage` và `document.documentElement.lang`.
   - Kết cục: Tùy chọn ngôn ngữ `"vi"` của người dùng không bao giờ bị ghi đè bởi giá trị mặc định `"en"` ban đầu → **AN TOÀN**.

4. **Cơ chế: Mount Đơn Lập `LazyModals` & Chống Treo Confirm Dialog (R2-M7)**
   - T1: Người dùng mở `GemModal` hoặc `PersonaModal`; duy nhất 1 instance modal được mount trong `MainLayout.tsx` (chỉ khi `isOpen = true`).
   - T2: Người dùng chỉnh sửa rồi nhấn ra overlay hoặc bấm ESC liên tiếp 2 lần; cờ `isConfirmingRef` ngăn chặn re-entrancy ở lần kích hoạt thứ 2.
   - T3: Dialog xác nhận hiển thị duy nhất, Promise của `confirmStore` resolve đúng giá trị người dùng lựa chọn; không bị ghi đè `resolve` và không làm treo Promise.
   - Kết cục: Trải nghiệm đóng mở modal mượt mà, không trùng lặp instance, không treo Promise → **AN TOÀN**.

5. **Cơ chế: Điều Hướng Deep Research Đồng Bộ URL (R2-M4)**
   - T1: Người dùng hoàn tất báo cáo Deep Research và nhấn nút "Tạo cuộc trò chuyện" trong `ResearchReportPanel`.
   - T2: Callback `onCreateConversation` tại `ChatApp.tsx:988` được kích hoạt: đóng panel, thoát chế độ Deep Research, và gọi trực tiếp `setSelectedConversationIdAndUrl(currentTask.conversationId)`.
   - T3: URL trình duyệt cập nhật sang `/?id=<conversationId>`, kích hoạt hook `useUrlSync` và nạp toàn bộ lịch sử tin nhắn của cuộc trò chuyện mới.
   - Kết cục: Không phát sinh hash ảo `#conv=`, URL đồng bộ chuẩn xác và hiển thị cuộc trò chuyện ngay lập tức → **AN TOÀN**.

#### D. Commands Executed (Bằng Chứng Kiểm Thử Read-Only)

- `git status` → Exit code 0 (Xác nhận trạng thái working tree).
- `npm run type-check` → Exit code 0 (Baseline TypeScript biên dịch sạch sẽ, không lỗi).
- `npx vitest run src/app/features/chat/components/hooks/useChatStreamController.test.ts` → Exit code 0 (3 tests passed, khớp đúng số liệu thực tế được cập nhật vào Revision 3).
- `npx vitest run src/app/features/chat/components/InputForm.test.tsx` → Exit code 0 (5 tests passed, sẵn sàng tích hợp bổ sung test double-submit và language prop).

#### E. Kết Luận

Kế hoạch **Revision 3** đã giải quyết triệt để, thấu đáo và hoàn hảo toàn bộ 8 điểm `[MAJOR]` (R2-M1 → R2-M8) và 5 điểm `[MINOR]` từ Audit Run 2. Cấu trúc 5 phần bắt buộc của Plan Completeness Gate đầy đủ 100%. Các ranh giới kiến trúc, co-located tests, thang z-index ngữ nghĩa, phòng ngừa re-entrancy/double-submit, và feature flag cách ly an toàn đã được đặc tả chính xác đến từng file và dòng code.

[PLAN_APPROVED]

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-09-30
- **Đối tượng**: Technical Plan — Revision 3
- **Ghi chú quy trình**: Audit Run 3 (fallback Gemini) đã cấp `[PLAN_APPROVED]` nhưng không có bằng chứng `[CMD]`/`[SRC]` cho phần z-index và phần phân rã file. Lượt này thẩm định độc lập lại Revision 3 và **thay thế** kết luận của Run 3. Thẻ ở cuối Run 3 không còn là dòng cuối của file nên không còn hiệu lực với `code-freeze-guard.js:225`.

#### A. Kiểm Chứng Lỗi Cũ (so với Audit Run 2)

| Mã       | Trạng thái                      | Evidence / Ghi chú                                                                                                                                                                                                                                                                      |
| :------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-M1    | **SỬA MỘT PHẦN** → R4-M3        | Đã có chữ ký hàm, TC-03a/b/c, feature flag, handoff seed DOM height. Nhưng interface với `useChatScroll` được mô tả như đã có sẵn, trong khi thực tế chưa có (xem R4-M3). Ngữ nghĩa của `calculateBottomAnchorOffset` cũng sai.                                                         |
| R2-M2    | **SỬA MỘT PHẦN** → R4-M1        | `dialog.tsx:24,41` → `z-(--z-modal)`, `Sidebar.tsx:547,558` → `z-(--z-drawer)`, toast `z-80`: đúng. `[CMD]` probe `tailwindcss.compile` (v4.1.18) xác nhận `z-(--z-modal)` → `z-index: var(--z-modal)`. Nhưng việc nâng Dialog lên 70 làm các floating primitive `z-50` bị che (R4-M1). |
| R2-M3    | **SỬA GẦN ĐỦ** → m-R4-1, m-R4-2 | `--text-muted` (9), `--surface-hover` (7) và §5.2 (31 file) khớp `[CMD]` grep. Còn lệch nhỏ ở `--surface-base`, `--border-hover` và 1 đường dẫn sai. TC-04 vẫn bắt được các chỗ này.                                                                                                    |
| R2-M4    | **ĐÃ SỬA**                      | `[SRC]` `ChatApp.tsx:988` là chỗ gán `window.location.hash`. `setSelectedConversationIdAndUrl` có sẵn trong scope tại `ChatApp.tsx:192`, sync `?id=` qua `useUrlSync.ts:57-76`.                                                                                                         |
| R2-M5    | **ĐÃ SỬA**                      | `[CMD]` `npx vitest run .../useChatStreamController.test.ts` → 3 passed. Đã chỉ định file test cho TC-01/06/07/08/09.                                                                                                                                                                   |
| R2-M6    | **ĐÃ SỬA**                      | `[SRC]` `InputForm.tsx:159-188` debounce 500ms + `pendingFileIdsRef`. Lock `isSubmittingRef` có vị trí set, điều kiện reset, phủ cả nhánh image và có TC-09.                                                                                                                            |
| R2-M7    | **ĐÃ SỬA**                      | `[SRC]` `MainLayout.tsx:1-15` hiện mount trực tiếp `GemModal`/`PersonaModal`/`ConfirmDialogHost`. Plan chỉ thay bằng `<LazyModals />` 1 lần, `layout.tsx` giữ nguyên.                                                                                                                   |
| R2-M8    | **ĐÃ SỬA**                      | Có route guard `usePathname`, SWR key, `router.push('/?id=')`, bỏ qua khi focus trong input/contenteditable, cleanup listener. P2/P3 được phân kỳ sau P0/Safe P1 (§6).                                                                                                                  |
| m-R2-1…5 | **ĐÃ TIẾP THU**                 | —                                                                                                                                                                                                                                                                                       |

#### B. Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả    | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------------------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **FAIL**   | `[CMD]` `npm run type-check` → exit 0 (baseline). `[SRC]` `package.json` không có Prisma/Better Auth. `[CMD]` probe Tailwind → `z-(--z-modal)` hợp lệ. Nhưng `ChatMessagesArea`/`ScrollToBottomButton` sẽ tiêu thụ `scrollContainerRef`, `isAtBottom`, `unreadCount`, trong khi `useChatScroll` không trả về các giá trị này (`useChatScroll.ts:85-90`) và file đó không nằm trong [MODIFY] → TS error (R4-M3). |
| **S2 Lifecycle & Teardown**  | PASS       | Plan quy định rõ `cancelAnimationFrame` (pattern RAF có sẵn tại `useChatStreamController.ts:152-212`), `ResizeObserver.disconnect()`, `removeEventListener`. Không đổi SSE server → `req.signal` N/A.                                                                                                                                                                                                           |
| **S3 Database & Temporal**   | PASS (N/A) | Không chạm migrations, RLS hay `*.server.ts`. Export dùng lại `downloadConversationById` (`download.ts:60`).                                                                                                                                                                                                                                                                                                    |
| **S4 Cross-Task State Flow** | **FAIL**   | `[ADV]` R4-M1 (stacking chéo giữa Dialog và Popover primitive), R4-M3 (anchor offset kéo viewport khi đang đọc giữa lịch sử).                                                                                                                                                                                                                                                                                   |
| **S5 Security Boundary**     | PASS       | Không có API route mới, không import `*.server.ts` vào client. TOCTOU/SSRF: N/A vì không có URL input mới.                                                                                                                                                                                                                                                                                                      |
| **S6 External Resilience**   | PASS (N/A) | Không đổi provider hay stream. Lỗi export/upload/delete đều có `toast.error` + `logger.error`.                                                                                                                                                                                                                                                                                                                  |
| **Domain – Bilingual**       | PASS       | Hard gate `_viCheck`/`_enCheck`, các key mới được thêm vào cả `vi.ts`/`en.ts`.                                                                                                                                                                                                                                                                                                                                  |

**Adversarial axes (4.5.2)**:

1. Đồng thời: double Enter (TC-09) và ESC 2 lần (`isConfirmingRef`) → AN TOÀN.
2. TOCTOU: đọc `getState().hasDirtyEditor` sau `await` → AN TOÀN. SSRF/URL: N/A.
3. Thất bại giữa chừng: `downloadConversationById` throw (`download.ts:81-84`) được catch + toast → AN TOÀN.
4. Serverless: N/A vì toàn bộ là client state.

#### C. Phân Loại Lỗi

**[BLOCKER]**: Không có.

**[MAJOR]**

- **R4-M1 — Nâng Dialog lên `z-70` làm các floating primitive `z-50` bị che bên trong modal.**
  - `[SRC]` Các primitive vẫn ở `z-50`: `popover.tsx:22`, `select.tsx:71`, `tooltip.tsx:22`, `dropdown-menu.tsx:49,66`, `alert-dialog.tsx:21,39`, và `IconPicker.tsx:142` (`PopoverContent ... z-50`). Plan không sửa file nào trong số này.
  - `[SRC]` `GemEditor.tsx:9,120` và `PersonaEditor.tsx:10,124` render `IconPicker` bên trong `GemModal`/`PersonaModal` (`DialogContent`, `GemModal.tsx:29`).
  ```
  Cơ chế: stacking context giữa các Radix portal
  T1: Mở GemModal → DialogOverlay/DialogContent portal vào body với z-index 70 (sau khi áp dụng §5.1 mục 7)
  T2: Bấm IconPicker trong GemEditor → PopoverContent portal vào body với z-50
  T3: Trình duyệt so z-index giữa 2 portal cùng cấp: 50 < 70
  Kết cục: danh sách icon nằm dưới DialogContent/overlay, người dùng không chọn được icon → LỖI (MAJOR, hồi quy chức năng)
  ```
  Tương tự với mọi `Select`/`Tooltip`/`DropdownMenu` primitive dùng trong Dialog, vì `DialogContent` là primitive dùng chung.
  **Yêu cầu**:
  - Sửa thang z: content nổi được portal (popover/select/tooltip/dropdown) phải ≥ `--z-modal`. Ví dụ: `--z-drawer: 60; --z-modal: 70; --z-popover: 75; --z-toast: 80`. Bỏ hoặc định nghĩa lại `--z-dropdown: 50` (hiện không dùng và đặt sai thứ tự).
  - Thêm `popover.tsx`, `select.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `alert-dialog.tsx` vào [MODIFY]. Đổi `IconPicker.tsx:142` từ `z-50` sang token mới.
  - Thêm 2 mục vào checklist §9.2: "mở IconPicker trong GemModal/PersonaModal" và "mở Select trong một Dialog".
- **R4-M2 — Mục tiêu phân rã file không đạt được với phương pháp đã nêu, và thiếu bản đồ tách.**
  - `[CMD]` `wc -l`: `useChatStreamController.ts` 1039, `ChatApp.tsx` 1053, `Sidebar.tsx` 610.
  - `[SRC]` Khối typewriter chỉ nằm ở `useChatStreamController.ts:97-212` (~115 dòng). Chỉ tách `useTypewriterBuffer` (§1 dòng 46, bước 2.3) thì còn ~920 dòng, không thể xuống <350. Phần còn lại gồm ~15 `useCallback` lớn (`prepareStreamRequest:481`, `processStreamResponse:625`, `coreSend:687`, `handleRegenerate:779`, `handleEdit:855`, `retrySave:912`, `handleContinue:946`, …).
  - `[SRC]` Vùng render tin nhắn của `ChatApp.tsx` là khoảng dòng 668–910 (~240 dòng). Tách `ChatMessagesArea` thì còn ~810 dòng, không xuống <400. `Sidebar.tsx` <400 không có phương pháp nào.
  - Đây là refactor rủi ro cao nhất (hook stream 1.040 dòng, lưới an toàn chỉ có 7 test). Plan chưa liệt kê các hook/component mới cần tạo trong [NEW].
    **Yêu cầu**: chọn một trong hai hướng:
  - (a) Đặc tả bản đồ tách theo `01-coding.md` §Splitting Strategies: tên file mới, callback nào chuyển đi đâu, interface trả về. Liệt kê vào [NEW] kèm test tương ứng.
  - (b) (khuyến nghị) Bỏ mục tiêu số dòng khỏi đợt này. Chỉ giữ việc tách typewriter + `ChatMessagesArea` như phạm vi §6 "Safe P1", và chuyển phân rã sang plan riêng.
- **R4-M3 — Interface `useChatScroll` được mô tả sai và control chống scroll-jump có ngữ nghĩa sai** (phần còn lại của R2-M1; rủi ro "Cao" theo 4.5.4).
  - `[SRC]` `useChatScroll.ts:19-90` chỉ trả về `{ scrollRef, handleScroll, handleTouchStart, handleTouchEnd }`. Hook không có `scrollContainerRef`, `isAtBottom`, `unreadCount`, và trạng thái bottom chỉ là ref nội bộ `shouldAutoScrollRef`. Plan viết "`useChatScroll` **tiếp tục** … quản lý `isAtBottom` … cung cấp `unreadCount`" nhưng `useChatScroll.ts` không nằm trong [MODIFY] và không có test cho logic unread.
  - `calculateBottomAnchorOffset` (TC-03c) luôn trả `prevScrollTop + delta` và được áp dụng vô điều kiện khi handoff:
  ```
  Cơ chế: bù scroll khi handoff pinned slot → virtual list
  T1: Người dùng đang đọc giữa lịch sử (shouldAutoScroll=false), scrollTop=2000; stream "done"
  T2: Chiều cao tổng tăng 400px do padding/ResizeObserver đo lại item NẰM DƯỚI viewport
  T3: Áp dụng calculateBottomAnchorOffset → scrollTop = 2000 + 400 = 2400
  Kết cục: viewport bị đẩy xuống 400px dù nội dung phía trên không đổi → chính là scroll jump mà control này phải ngăn → LỖI (MAJOR)
  ```
  Chỉ cần bù khi thay đổi chiều cao xảy ra ở item **phía trên** vùng hiển thị (`resizedIndex < startIndex`). Khi đang ở đáy thì auto-scroll hiện có (`useChatScroll.ts:73-78`) đã xử lý.
  **Yêu cầu**:
  - Thêm `useChatScroll.ts` vào [MODIFY], đặc tả các giá trị trả về mới (`isAtBottom` dạng state, `unreadCount` cùng quy tắc tăng/reset) và thêm test.
  - Đổi hàm anchor thành dạng có điều kiện, ví dụ `computeScrollCompensation(resizedIndex, startIndex, delta)`. Mở rộng TC-03c với 2 case: item trên viewport → bù `delta`; item dưới viewport/pinned slot → bù 0.

**[MINOR]**

- m-R4-1: `[CMD]` `--surface-base` thực tế nằm ở `FilePreviewCard.tsx`, không ở `IconPicker.tsx` (§5.1 mục 2). `--border-hover` có 2 file: thêm `ProjectChatView.tsx` (§5.1 mục 4, §7.2 #46).
- m-R4-2: §5.2 #22 `src/app/features/layout/components/SettingsModal.tsx` không tồn tại. Đường dẫn đúng là `src/app/features/image-gen/components/SettingsModal.tsx`.
- m-R4-3: Lệnh TC-04 nằm trong bảng Markdown với `\|`. Nếu agent copy nguyên văn vào `grep -E`, `\|` thành ký tự `|` literal, grep không bao giờ match và trả exit 1 = PASS giả. Nên đặt lệnh TC-04/TC-04b trong code block ngoài bảng (TC-04b hiện chứa `|` chưa escape nên cũng làm vỡ bảng), và ghi rõ chạy qua Git Bash.
- m-R4-4: Toast `z-9999` → `z-80` sẽ nằm dưới `StreamErrorBanner` `z-100` (`StreamErrorBanner.tsx:54`), cùng vị trí `top-4 right-4`. Nên đưa banner vào thang z hoặc ghi nhận đây là chủ đích.
- m-R4-5: Nếu `LazyModals` unmount ngay khi `isOpen=false` thì mất animation đóng của Radix (`data-[state=closed]`). Cân nhắc giữ modal mounted sau lần mở đầu tiên bằng latch `hasOpened`.
- m-R4-6: `hasHydrated` trong `LanguageUpdater` nên là `useState`, không phải ref. Với ref, effect ghi trong cùng commit sẽ đọc closure `language="en"` và ghi `"en"` một lần. TC-07 nên assert thêm `localStorage.setItem` **không bao giờ** được gọi với `"en"` khi storage đã lưu `"vi"`.

#### D. Kết Luận

**[CHANGES_REQUESTED]**: 0 `[BLOCKER]`, 3 `[MAJOR]` (R4-M1 → R4-M3), 6 `[MINOR]`. S1 và S4 FAIL. Kết luận `[PLAN_APPROVED]` của Audit Run 3 bị thay thế.

Việc cần làm cho Revision 4:

1. Sửa thang z để floating primitive ≥ modal. Thêm `popover`/`select`/`tooltip`/`dropdown-menu`/`alert-dialog`/`IconPicker` vào [MODIFY] và bổ sung checklist (R4-M1).
2. Bổ sung bản đồ phân rã cụ thể, hoặc bỏ mục tiêu số dòng `<350/<400` khỏi đợt này (R4-M2).
3. Thêm `useChatScroll.ts` vào [MODIFY] với interface mới + test. Sửa ngữ nghĩa anchor thành bù có điều kiện và mở rộng TC-03c (R4-M3).
4. Tiếp thu m-R4-1 → m-R4-6.

**Trạng thái: CHANGES_REQUESTED — chưa phê duyệt (Audit Run 4).**

### Audit Run 5

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-09-30
- **Đối tượng**: Technical Plan — Revision 4

#### A. Kiểm Chứng Lỗi Cũ (so với Audit Run 4)

| Mã     | Trạng thái | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :----- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-M1  | **ĐÃ SỬA** | Thang z mới `drawer 60 < modal 70 < popover 75 < toast 80 < banner 90` đúng thứ tự. `[SRC]` Các vị trí được sửa khớp với code: `popover.tsx:22`, `select.tsx:71`, `tooltip.tsx:22`, `dropdown-menu.tsx:49,66`, `alert-dialog.tsx:21,39`, `IconPicker.tsx:142` đều đang là `z-50`. `SidebarItem.tsx:162`, `ProjectNode.tsx:168`, `ProjectChatView.tsx:174` đang là `z-9999`, `ToastContainer.tsx:12` là `z-9999`, `StreamErrorBanner.tsx:54` là `z-100`. `[SRC]` `confirm-dialog.tsx:5-11` dùng `Dialog` dùng chung, nên confirm mở từ `GemModal` có cùng z 70 và portal mount sau, vì vậy nằm trên. `[CMD]` probe `twMerge("relative z-(--z-popover) max-h-1", "z-100")` → `"relative max-h-1 z-100"`: tailwind-merge 3.4.0 nhận `z-(--var)` là cùng nhóm z-index, nên override của consumer vẫn thắng như cũ. Checklist §9.3 mục 2 đã có IconPicker/Select trong modal. |
| R4-M2  | **ĐÃ SỬA** | Chọn hướng (b): bỏ mục tiêu `<350/<400` (§1 dòng 46, §6, §8 bước 2.3, §11), chuyển phân rã sang plan riêng. `[CMD]` `wc -l`: `ChatApp.tsx` 1053, `useChatStreamController.ts` 1039, không đổi so với Run 4. `[CMD]` `npx vitest run useChatStreamController.test.ts Sidebar.test.tsx` → 6 passed (3 + 3), khớp số liệu "hiện có 3 tests".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R4-M3  | **ĐÃ SỬA** | `computeScrollCompensation(resizedIndex, startIndex, delta)` chỉ bù khi `resizedIndex < startIndex`. TC-03c có đủ 2 case (bù `delta` / bù 0). `useChatScroll.ts` đã được thêm vào [MODIFY] #24 với interface trả về mới, có `useChatScroll.test.ts` (TC-03d) và nằm trong §10.1. `[SRC]` `useChatScroll.ts:6-11,87-92` xác nhận interface hiện tại, nên phần mở rộng là thay đổi cộng thêm. Consumer duy nhất là `ChatApp.tsx:448`. Còn một khoảng trống nhỏ về quy tắc reset (m-R5-1).                                                                                                                                                                                                                                                                                                                                                                                  |
| m-R4-1 | **ĐÃ SỬA** | `[CMD]` `grep -rlE -- "--surface-base\b" src` → 8 file, gồm `FilePreviewCard.tsx`. `--border-hover` → 2 file. `--text-muted` → 9, `--surface-hover` → 7, `--text-tertiary`/`--primary-hover`/`--primary-foreground` → 1. Tất cả khớp §5.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| m-R4-2 | **ĐÃ SỬA** | `[CMD]` TC-04b → đúng 31 file, gồm `src/app/features/image-gen/components/SettingsModal.tsx`. Khớp §5.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| m-R4-3 | **ĐÃ SỬA** | Lệnh TC-04/TC-04b đã được đưa ra code block ở §9.2. `[CMD]` Chạy nguyên văn TC-04 trên Git Bash → exit 0 với 21 file (baseline FAIL như mong đợi). Regex hoạt động, không còn nguy cơ PASS giả.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| m-R4-4 | **ĐÃ SỬA** | `--z-banner: 90` > toast 80.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| m-R4-5 | **ĐÃ SỬA** | Latch `hasOpenedGem`/`hasOpenedPersona`. `[SRC]` `GemModal.tsx:10,28` tự đọc `isOpen` từ store, nên sau khi latch mount thì `data-[state=closed]` vẫn chạy bình thường.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| m-R4-6 | **ĐÃ SỬA** | `hasHydrated` dùng `useState`. TC-07 có assertion không bao giờ `setItem("en")`. `[SRC]` `languageStore.ts:9-12` không có persist middleware, default là `"en"`. `useLanguage.ts:18-22` hiện ghi `localStorage` từ mọi consumer, và effect này chạy trước effect đọc ở cha `ChatApp.tsx:108-115` (children-first). Đây đúng là nguyên nhân mất ngôn ngữ, và plan đã loại bỏ cả hai.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### B. Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả    | Evidence / Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :--------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | PASS       | `[CMD]` `npm run type-check` → exit 0 (baseline). `[SRC]` `package.json` không có Prisma/Better Auth, không thêm dependency. Mọi module mới đều nằm trong [NEW]. `useChatScroll` đã vào [MODIFY], nên consumer `ChatMessagesArea`/`ScrollToBottomButton` không còn tham chiếu thuộc tính không tồn tại. `MainLayout.tsx:1-15` không có `"use client"`, và `dynamic({ ssr:false })` được cô lập trong `LazyModals.tsx` có `"use client"`. Không có env var mới. |
| **S2 Lifecycle & Teardown**  | PASS       | Có `cancelAnimationFrame` (useTypewriterBuffer), `ResizeObserver.disconnect()`, `removeEventListener("keydown")` (Command Palette/Shortcuts). Không đổi SSE server nên `req.signal` là N/A. Các test mới mock `confirmStore`/`download.ts`/`toast` ở biên, không tự khẳng định kết quả của chính nó.                                                                                                                                                           |
| **S3 Database & Temporal**   | PASS (N/A) | Không chạm migrations, RLS hay `*.server.ts`. Export dùng lại `downloadConversationById` (`[SRC]` `download.ts:60`).                                                                                                                                                                                                                                                                                                                                           |
| **S4 Cross-Task State Flow** | PASS       | `[SRC]` `useUrlSync` → `setSelectedConversationIdAndUrl` (`ChatApp.tsx:192`) thay cho `window.location.hash` (`ChatApp.tsx:988`). `hasDirtyEditor` được đọc qua `getState()` sau `await`. Thứ tự hydrate ngôn ngữ đã kiểm (m-R4-6). Thang z đã kiểm chéo với toàn bộ `z-*` trong `src/**/*.tsx` (`[CMD]` grep). Còn m-R5-1 và m-R5-2 (không chặn).                                                                                                             |
| **S5 Security Boundary**     | PASS       | Không có API route mới, không import `*.server.ts` vào client. Command Palette chặn `/auth/*` và `/admin` trước khi gọi SWR. TOCTOU/SSRF: N/A vì không có URL input mới.                                                                                                                                                                                                                                                                                       |
| **S6 External Resilience**   | PASS (N/A) | Không đổi provider hay stream. Lỗi export/upload/delete đều có `toast.error` + `logger.error`. `StreamErrorBanner` được nâng lên lớp z cao nhất.                                                                                                                                                                                                                                                                                                               |
| **Domain – Bilingual**       | PASS       | Hard gate `_viCheck`/`_enCheck` (TC-05). Mọi key mới (`discardChangesTitle/Desc`, `exportFailed`, `aiIsTyping`, …) được thêm vào cả `vi.ts`/`en.ts`.                                                                                                                                                                                                                                                                                                           |

**Adversarial axes (4.5.2)**:

```
Cơ chế: stacking IconPicker trong GemModal (R4-M1)
T1: Mở GemModal → Overlay/Content portal z-70 | T2: Mở IconPicker → PopoverContent portal z-75 | T3: So z giữa 2 portal cùng cấp body: 75 > 70
Kết cục: picker nổi trên dialog → AN TOÀN
```

```
Cơ chế: hydrate ngôn ngữ (m-R4-6)
T1: Mount, store="en", hasHydrated=false; effect đọc → setLanguage("vi"), setHasHydrated(true) | T2: Effect ghi trong cùng commit thấy hasHydrated=false → bỏ qua | T3: Re-render: language="vi", hasHydrated=true → ghi "vi"
Kết cục: localStorage không bao giờ nhận "en" → AN TOÀN
```

1. Đồng thời: double Enter (TC-09, `isSubmittingRef`), ESC 2 lần (`isConfirmingRef`), double-click export (`isExporting`) → AN TOÀN.
2. TOCTOU: `getState().hasDirtyEditor` được đọc sau `await` → AN TOÀN. SSRF/URL: N/A.
3. Thất bại giữa chừng: `downloadConversationById` throw → catch + toast + reset `isExporting` → AN TOÀN.
4. Serverless: N/A vì toàn bộ là client state.

#### C. Phân Loại Lỗi

**[BLOCKER]**: Không có.

**[MAJOR]**: Không có.

**[MINOR]** (không chặn, xử lý khi thực thi):

- m-R5-1 — Quy tắc `unreadCount` chưa có điều kiện reset khi đổi hội thoại. `[SRC]` `ChatApp` được mount không có `key` (`page.tsx:22`, `features/chat/page.tsx:18`), nên `useChatScroll` sống xuyên suốt khi đổi conversation. Nếu người dùng đang cuộn lên (`isAtBottom=false`) rồi chọn hội thoại khác, `renderedMessagesLength` nhảy (ví dụ 40 → 150) và có thể bị đếm thành 110 tin "chưa đọc". Nên: (a) chỉ đếm phần tăng `len - prevLen > 0`; (b) reset `unreadCount=0` và `isAtBottom=true` khi `selectedConversationId` đổi (truyền vào options của hook); (c) thêm case này vào TC-03d.
- m-R5-2 — Mâu thuẫn nhỏ về ngữ nghĩa badge. §1 ghi "đếm số tin/token mới", TC-03d đếm theo tin nhắn, còn checklist §9.3 mục 3 kỳ vọng badge hiện **trong lúc** stream. Nhưng tin đang stream nằm ở `streamingAssistant`, không làm tăng `renderedMessagesLength` cho đến khi `done`. Nên chốt một định nghĩa, ví dụ đếm tin nhắn và coi stream đang chạy khi `!isAtBottom` là 1 chỉ báo "có nội dung mới".
- m-R5-3 — `ControlPanel.tsx:480` và `EditPanel.tsx:277` truyền `z-100` vào `SelectContent`. Vì twMerge giữ override (`[CMD]` probe ở trên), các Select này nằm trên toast (80) và banner (90). Nên bỏ `z-100` để dùng token `--z-popover`. Có thể gộp vào bước 1.2.
- m-R5-4 — Các modal tự dựng vẫn ở `z-50`, ngoài thang z: `EditPlanModal.tsx:66,79`, `ResearchReportPanel.tsx:211,228`, `ResearchThinkingPanel.tsx:61,78`, `ProjectSettingsModal.tsx:163,166`, `ImageCompareModal.tsx:84,86`, `FileLightbox.tsx:206`, `ImageLightbox.tsx`, và `Dialog.Overlay` của admin `*Manager.tsx`. Hiện không có luồng nào mở chúng từ bên trong Dialog z-70, nên không phải hồi quy. Nên ghi nhận là nợ kỹ thuật cho plan sau.
- m-R5-5 — `Sidebar.tsx:547` overlay (`z-[55]`) và drawer (`z-[60]`) cùng chuyển sang `--z-drawer`. Thứ tự hiển thị vẫn đúng nhờ DOM order trong cùng portal. `Sidebar.test.tsx:116` đang assert `toContain("z-[60]")` nên phải đổi sang `z-(--z-drawer)` theo Triage Loại C, như plan đã ghi.

#### D. Kết Luận

**APPROVED**: 0 `[BLOCKER]`, 0 `[MAJOR]`, 5 `[MINOR]`. S1–S6 PASS. Cả 3 `[MAJOR]` và 6 `[MINOR]` của Audit Run 4 đã được khắc phục và kiểm chứng bằng `[CMD]`/`[SRC]`. Các m-R5-1 → m-R5-5 xử lý trong lúc thực thi. Nên xử lý m-R5-1 cùng bước 2.2, trước khi làm `ScrollToBottomButton` (bước 3.5).

[PLAN_APPROVED]

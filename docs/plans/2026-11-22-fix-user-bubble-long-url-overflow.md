# Implementation Plan: Fix User Chat Bubble Horizontal Overflow on Long Unbroken URLs

- **Date**: 2026-11-22
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Status**: Completed
- **Revision**: 1
- **Plan File**: `docs/plans/2026-11-22-fix-user-bubble-long-url-overflow.md`

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Goal

Khắc phục triệt để lỗi tràn ngang về phía trái (unscrollable LTR left-overflow) của bóng chat người dùng (`ChatBubble` khi `!isBot`) khi tin nhắn chứa chuỗi URL dài không có khoảng trắng (ví dụ: URL sản phẩm Amazon dài 170+ ký tự hoặc URL Google Docs/Sheets/Slides), đồng thời bịt các khe hở tràn ngang tương tự trong khối suy luận `ThinkingBlock` (`BubbleHelpers.tsx`), chế độ chỉnh sửa tin nhắn (`isEditing`), và chip tệp đính kèm (`FileInMessage.tsx`) ở màn hình siêu hẹp:

1. **Chặn tràn ngang & cắt xén về phía trái**: Đảm bảo bóng chat người dùng luôn nằm trọn bên trong cột hội thoại (`bubbleRect.left >= containerRect.left`, `bubbleRect.right <= containerRect.right`, `bubbleRect.width <= containerRect.width * 0.85`) trên cả Desktop (`1440×900`) và Mobile (`375×812`) ở cả Dark & Light themes.
2. **Bảo toàn shrink-to-fit & xuống dòng tự nhiên**: Tin nhắn ngắn (`"Cảm ơn bạn!"`) vẫn co gọn đúng độ rộng nội dung (không bị giãn `w-full`); văn bản tiếng Việt/tiếng Anh nhiều từ vẫn xuống dòng theo ranh giới khoảng trắng đến tối đa `85%` (tuyệt đối không dùng `break-all` làm gãy chữ giữa từ).
3. **Đồng bộ kiểm thử & bộ nhớ thể chế**: Bổ sung unit/regression tests co-located, kiểm chứng Playwright Visual QA đa góc nhìn kèm kiểm tra `getBoundingClientRect()`, và hoàn tất Post-Fix Protocol (`docs/lessons-learned.md` + `docs/CHANGELOG.md`).

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** chuyển tin nhắn người dùng sang render bằng `ReactMarkdown` hoặc tự động biến URL trong bóng người dùng thành thẻ `<a>` bấm được (giữ nguyên hành vi plain-text `<span>` tại `src/app/features/chat/components/BubbleMarkdown.tsx:207-209`).
- **KHÔNG** tách nhỏ hay tái cấu trúc không liên quan đối với `ChatBubble.tsx` ngoài các lớp Tailwind sửa lỗi và xóa 1 dòng trống thừa ngay trong khối JSX chỉnh sửa để giữ tổng số dòng `<= 500`.
- **KHÔNG** thay đổi bảng màu semantic tokens, khoảng cách dọc `py-3.5`, cơ chế nổi của `MessageActions`, hay logic Markdown / `SmartCode` của tin nhắn trợ lý (`isBot === true`).
- **KHÔNG** sửa đổi API route, Supabase schema, hay file cấu hình toàn cục (`globals.css`, `utilities.css`, `eslint.config.mjs`).
- **KHÔNG** thêm hay chỉnh sửa khóa song ngữ VI/EN (tác vụ thuần CSS layout & test, không có văn bản hiển thị mới).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

Toàn bộ tài liệu và `SKILL.md` thuộc domain Bug Fixing & UI Components đã được đọc trực tiếp bằng `read_file` trước khi thiết kế kế hoạch:

| Tài liệu / Skill đã đọc (`read_file`)           | Quy tắc / Nội dung áp dụng                                                                                                                                                                                                               | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                                                                                                                                     |
| :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-debug/SKILL.md:12-93`    | Quy trình Debugging 6 bước (root cause trước khi sửa) + Post-Fix Protocol 5 bước (`npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`, kiểm tra ngưỡng 3 lần để thăng cấp rule).                               | Đã xác nhận root cause kép (`min-w-0`/`max-w-full` thiếu + `overflow-wrap: break-word` không giảm `min-content`); kiểm tra `docs/lessons-learned.md:109-131` xác nhận đây mới là lần 1 của lỗi `overflow-wrap` (không thăng cấp rule vào `.agents/rules/`); lên lịch ghi bài học & CHANGELOG ở Bước cuối.              |
| `.agents/rules/03-ui.md:73-75,118,121-128`      | User bubble dùng `--raised`, ràng buộc chiều rộng bằng `min()`, cấm dead shadcn tokens/raw colors/sub-12px, và bắt buộc Playwright Visual QA (Desktop `1440×900` & Mobile `375×812` × Dark/Light + gọi `read_file` soi từng ảnh `.png`). | Giữ nguyên token `bg-(--raised) text-(--text)` trên user bubble; đổi `src/app/features/chat/components/FileInMessage.tsx:90` sang `max-w-[min(220px,100%)]`; thiết kế kế hoạch Visual QA đủ 4 góc nhìn kèm kiểm tra `getBoundingClientRect()` (vì `scrollWidth <= innerWidth` không bắt được left-overflow trong LTR). |
| `.agents/rules/01-coding.md:98-106`             | Giới hạn kích thước UI component Hard Max `500` dòng, TypeScript strict cấm `any`, `0` lint warnings.                                                                                                                                    | `ChatBubble.tsx` hiện đang `501` dòng; gộp `min-w-0` vào tiền tố chung và bỏ 1 dòng trống thừa tại `src/app/features/chat/components/ChatBubble.tsx:265` (ngay trong vùng JSX đang sửa) để đưa file về đúng `500` dòng mà không refactor ngoài phạm vi.                                                                |
| `.agents/agents/reviewer/evidence-bar.md:50-61` | Yêu cầu Wiring Probes, Negative Probes và ánh xạ mọi rủi ro Cao/Trung bình tới technical control cụ thể (`[SRC]` hoặc probe kiểm chứng).                                                                                                 | Thiết kế tường minh `WP-1..WP-3`, `NP-1..NP-3`, và bảng rủi ro ánh xạ 1-1 ở Mục 9 & Mục 10.                                                                                                                                                                                                                            |
| `docs/lessons-learned.md:109-131`               | Kiểm tra tiền sử lỗi UI/flex (`min-h-0` sidebar `2026-09-27`, plain-text code block `2026-10-11`).                                                                                                                                       | Xác nhận vị trí bổ sung mục bài học mới ngay đầu mục `## UI and Styling`, đồng thời ghi nhận khác biệt quan trọng giữa `overflow-wrap: break-word` và `anywhere` + bẫy LTR left-overflow không cuộn được.                                                                                                              |
| `docs/CHANGELOG.md:11-24`                       | Định dạng nhật ký thay đổi mới nhất đặt trên cùng (nhóm `2026-11-22`).                                                                                                                                                                   | Định dạng sẵn mục cập nhật CHANGELOG đúng cấu trúc hiện hành của dự án.                                                                                                                                                                                                                                                |

---

### 3. Assumptions & Cross-Task Dependencies

#### Verified Assumptions (`[SRC]` / `[URL]`)

1. **Chuỗi phần tử cha tạo nên cột chat `896px` & bẫy LTR left-overflow** (`[SRC]`):
   - `src/app/features/chat/components/ChatApp.tsx:268,287-299` và `src/app/features/layout/utils/shellNav.ts:67-71`: Trên Desktop `1440×900` với sidebar mở (`md:pl-[calc(21rem+var(--sal,0px))]` = `336px`), `#main-content` có `flex-1 overflow-y-auto px-4 md:px-0` (rộng `1104px`). Vì `overflow-y: auto` ép `overflow-x` tính toán thành `auto`, mọi phần tử con tràn quá biên trái (start edge trong LTR) bị cắt xén không thể cuộn tới, trong khi `document.documentElement.scrollWidth` vẫn `<= window.innerWidth`.
   - `src/app/features/chat/components/ChatMessagesArea.tsx:206`: Cột tin nhắn dùng `max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto w-full py-6` (`896px` tại `1440px`: `left = 440px`, `right = 1336px`; và `343px` tại Mobile `375px` sau `px-4`: `left = 16px`, `right = 359px`).
2. **Nguyên nhân gốc kép gây tràn `1629px` (`left: -293px`) trên bóng người dùng** (`[SRC]`):
   - `src/app/features/chat/components/ChatBubble.tsx:246`: Phần tử gốc dùng `flex w-full flex-col py-3.5 items-end` (căn phải).
   - `src/app/features/chat/components/ChatBubble.tsx:248-250`: Wrapper giới hạn rộng chỉ có `items-end max-w-[85%]` (thiếu `min-w-0` cho `!isBot`).
   - `src/app/features/chat/components/ChatBubble.tsx:266-268`: Wrapper xếp chồng chỉ có `items-end max-w-full` (thiếu `min-w-0` cho `!isBot`).
   - `src/app/features/chat/components/ChatBubble.tsx:269-273`: Hộp bóng người dùng có `px-1` ở base class và `bg-(--raised) px-4 py-2.5 text-(--text)` ở nhánh `!isBot` — **thiếu hoàn toàn `max-w-full min-w-0`**, đồng thời tạo xung đột cascade `px-1` vs `px-4`.
   - `src/app/features/chat/components/ChatBubble.tsx:308-311`: Wrapper nội dung `flex flex-col w-full overflow-hidden` thiếu `min-w-0`.
   - `src/app/features/chat/components/BubbleMarkdown.tsx:207-209`: Nhánh `isBot === false` render `<span className="whitespace-pre-wrap break-words ...">`. Trong Tailwind CSS v4, `break-words` biên dịch thành `overflow-wrap: break-word`, vốn **không** đưa cơ hội ngắt mềm vào tính toán kích thước nội tại `min-content` theo W3C CSS Text Level 3 (`[URL]`), khiến hộp shrink-to-fit bên trong `items-end` phình ra đúng chiều dài chuỗi URL không ngắt (`~1629px`) và đẩy tràn sang trái (`left: -293px`).
3. **Các điểm tràn ngang liên đới đã kiểm tra thực tế** (`[SRC]`):
   - `src/app/features/chat/components/BubbleHelpers.tsx:83,110-115`: `ThinkingBlock` có `whitespace-pre-wrap max-h-96 overflow-y-auto` nhưng thiếu `wrap-anywhere overflow-x-hidden` (và wrapper thiếu `min-w-0`). Khi suy luận `<thought>` chứa URL dài không khoảng trắng, vùng `font-mono` không bẻ dòng và sinh thanh cuộn ngang/tràn biên phải.
   - `src/app/features/chat/components/ChatBubble.tsx:274-289`: Chế độ chỉnh sửa `isEditing` có wrapper `flex flex-col gap-2 w-full min-w-[min(60vw,18rem)] md:min-w-[min(100%,32rem)]` (thiếu `max-w-full` phòng thủ) bao `<Textarea className="w-full ... overflow-hidden">`. Trên Mobile `375px`: `min(60vw, 18rem) = 225px <= 259.55px` (chiều rộng lõi 85% bubble); trên Desktop `1440px`: `32rem = 512px <= 729.6px`. Bổ sung `max-w-full` vào dòng `275` và kiểm chứng trực tiếp bằng Playwright ở `isEditing` với URL dài.
   - `src/app/features/chat/components/FileInMessage.tsx:81-108`: Vùng chip tệp dùng `flex flex-wrap gap-1.5 mb-2` (thiếu `min-w-0 max-w-full`) và nút `max-w-[220px]` (thiếu `min-w-0`). Ở `375px` (`220 <= 259.55px`) vẫn vừa, nhưng ở màn hình siêu hẹp `320px` (lõi `212.8px`) nút `220px` vượt `7.2px`; đổi sang `max-w-[min(220px,100%)] min-w-0` giải quyết triệt để và đúng chuẩn `.agents/rules/03-ui.md:118`.
   - `src/app/features/chat/components/MessageActions.tsx:116-129`: Trên Desktop dùng `md:absolute md:top-full md:right-0` (thoát luồng, neo biên phải của wrapper `src/app/features/chat/components/ChatBubble.tsx:249`), trên Mobile dùng `flex items-center gap-0.5 justify-end` (~`150px` tối đa 4 nút <= `291.55px`). Không bị ảnh hưởng tiêu cực.
   - `src/app/features/chat/components/BubbleMarkdown.tsx:115-117,152-161,219-231` và `src/app/styles/themes/_shared/utilities.css:18-21`: Tin nhắn trợ lý (`isBot === true`) đã có chuỗi `w-full min-w-0` + `.chat-markdown` (`word-break: break-word`) + `a.break-all`, nên không có lỗi tràn ngang và không cần sửa đổi ngoài phạm vi.
4. **Hỗ trợ `wrap-anywhere` trong Tailwind CSS v4.1.18 & tương thích ESLint** (`[SRC]` / `[URL]`):
   - `src/app/globals.css:6` nạp `@import "tailwindcss";` với `tailwindcss@4.1.18` (`node_modules/tailwindcss/package.json:3`), hỗ trợ sẵn utility `wrap-anywhere` (`overflow-wrap: anywhere;`) được giới thiệu từ Tailwind CSS v4.1 (`[URL]`).
   - `eslint.config.mjs:119-144` và `scripts/vikini-design-lint.mjs:12-24`: Plugin `vikini-design` chỉ chặn màu thô, legacy tokens, font `< 12px`, và `uppercase`; hoàn toàn cho phép `wrap-anywhere`, `min-w-0`, `max-w-full`, `overflow-x-hidden`.
5. **Ràng buộc dòng code của `ChatBubble.tsx`** (`[SRC]`):
   - `src/app/features/chat/components/ChatBubble.tsx` hiện dài `501` dòng (`src/app/features/chat/components/ChatBubble.tsx:501`). Xóa 1 dòng trống tại `src/app/features/chat/components/ChatBubble.tsx:265` (nằm ngay giữa vùng JSX đang sửa `248-311`) đưa file xuống đúng `500` dòng (`<= 500` Hard Max của `.agents/rules/01-coding.md:102`).

#### Cross-Task Dependencies

- Không phụ thuộc vào task hay migration nào khác; `CRITIC_REQUIRED` = `no` (không chạm `*.server.ts`, auth, database/SQL, hay `.agents/**`).
- Không ảnh hưởng tới tính năng Google Docs URL auto-resolution hay chip `SourceLinks.tsx` vừa triển khai ngày `2026-11-22` (ngược lại, giúp các URL Google Docs dài người dùng dán vào hiển thị gọn gàng trong bóng chat thay vì tràn trái).

---

### 4. Bảng Verified Versions

| Công nghệ / Thư viện             | Phiên bản thực tế | Nguồn xác minh (`[SRC]` / `[URL]`)                                                                                                         | Ghi chú tương thích năm 2026                                                                                                                                                  |
| :------------------------------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tailwind CSS**                 | `4.1.18`          | `[SRC]` `package.json:53,114`, `node_modules/tailwindcss/package.json:3`<br>`[URL]` https://tailwindcss.com/docs/overflow-wrap             | v4.1+ hỗ trợ native `wrap-anywhere` (`overflow-wrap: anywhere`), `wrap-break-word`, `wrap-normal`. Thay thế `break-words` bằng `wrap-anywhere` (không dùng đồng thời cả hai). |
| **CSS Text Module Level 3**      | W3C CR            | `[URL]` https://www.w3.org/TR/css-text-3/#overflow-wrap-property<br>`[URL]` https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap | `overflow-wrap: anywhere` tính soft-wrap opportunities vào `min-content` (nhưng KHÔNG đổi `max-content`), khác với `break-word`.                                              |
| **CSS Overflow / Box Alignment** | W3C Spec          | `[URL]` https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_alignment                                                                 | Tràn qua start-edge (bên trái trong LTR do `align-items: flex-end`) là vùng unscrollable và bị cắt; `scrollWidth <= innerWidth` không đủ để phát hiện lỗi.                    |
| **Next.js**                      | `16.4.0`          | `[SRC]` `package.json:64`, `node_modules/next/package.json:3`                                                                              | App Router; Visual QA chạy `next dev` theo `.agents/rules/03-ui.md:125`.                                                                                                      |
| **React / React DOM**            | `19.2.3`          | `[SRC]` `package.json:69-70`, `node_modules/react/package.json:7`                                                                          | Tương thích `React.memo` và `useDeferredValue` hiện có trong `ChatBubble.tsx`.                                                                                                |
| **Vitest**                       | `4.1.12`          | `[SRC]` `package.json:118`, `node_modules/vitest/package.json:4`, `vitest.config.ts:8`                                                     | Chạy unit/component tests trên môi trường `happy-dom` với `@testing-library/react`.                                                                                           |
| **Playwright**                   | `1.62.1`          | `[SRC]` `package.json:87`, `node_modules/@playwright/test/package.json:3`, `playwright.config.ts:3-4`                                      | Dùng kiểm chứng Visual QA trực tiếp trên Chromium (`1440×900` & `375×812` × Dark/Light).                                                                                      |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

> **Plan Scope & File Size Compliance**: Không chạm file nhạy cảm (`*.server.ts`, SQL, `.agents/**`). Sau khi chỉnh sửa, mọi component UI đều đạt chuẩn `<= 500` dòng (`.agents/rules/01-coding.md:102`).

- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx` — Thêm `min-w-0` cho các tầng flex người dùng (`249`, `267`, `309`), thêm `min-w-0 max-w-full` và tách `px-1` riêng cho nhánh `isBot` (`270-272`), thêm `max-w-full` phòng thủ cho `isEditing` (`275`), và xóa 1 dòng trống thừa ở dòng `265` để giữ tổng số dòng `500 <= 500`.
- `[MODIFY]` `src/app/features/chat/components/BubbleMarkdown.tsx` — Thay `break-words` bằng `wrap-anywhere` trên `<span>` nhánh `isBot === false` (`208`) để `overflow-wrap: anywhere` giới hạn `min-content` trong flex shrink-to-fit.
- `[MODIFY]` `src/app/features/chat/components/BubbleHelpers.tsx` — Thêm `w-full min-w-0` vào khung `ThinkingBlock` (`83`) và `wrap-anywhere overflow-x-hidden` vào vùng nội dung mở rộng (`112`) để URL dài trong `<thought>` tự xuống dòng, không sinh thanh cuộn ngang.
- `[MODIFY]` `src/app/features/chat/components/FileInMessage.tsx` — Thêm `min-w-0 max-w-full` vào wrapper danh sách tệp (`81`) và đổi `max-w-[220px]` thành `max-w-[min(220px,100%)] min-w-0` trên nút chip tệp (`90`) để an toàn kể cả ở viewport siêu hẹp `320px`.
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.test.tsx` — Bổ sung các regression test cho chuỗi lớp containment (`min-w-0`, `max-w-[85%]`, `max-w-full`), loại bỏ xung đột `px-1` trên bóng người dùng, bảo toàn shrink-to-fit (không gắn `w-full` trên hộp user bubble), URL dài không khoảng trắng, và `isEditing` container.
- `[NEW]` `src/app/features/chat/components/BubbleMarkdown.test.tsx` — Unit/regression test co-located cho `BubbleMarkdown` (nhánh `isBot={false}` dùng `whitespace-pre-wrap wrap-anywhere` và không chứa `break-words`/`break-all`, giữ nguyên newline & `className`; nhánh `isBot={true}` giữ `.chat-markdown.w-full.overflow-hidden` & `a.break-all`).
- `[MODIFY]` `src/app/features/chat/components/BubbleHelpers.test.tsx` — Bổ sung regression test cho `ThinkingBlock` khi mở rộng với URL dài (kiểm tra `wrap-anywhere`, `overflow-x-hidden`, `overflow-y-auto`, và wrapper `min-w-0`).
- `[NEW]` `src/app/features/chat/components/FileInMessage.test.tsx` — Unit/regression test co-located cho `FileInMessage` kiểm chứng `min-w-0 max-w-full`, `max-w-[min(220px,100%)] min-w-0`, và `<span className="truncate">` với tên tệp dài không khoảng trắng.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi nhận bài học mới (Post-Fix Protocol) dưới mục `## UI and Styling` về lỗi LTR unscrollable left-overflow + khác biệt `overflow-wrap: break-word` vs `anywhere` trong flex `items-end`.
- `[MODIFY]` `docs/CHANGELOG.md` — Ghi nhận bản vá mới nhất dưới nhóm ngày `2026-11-22`.

---

### 6. Caller-First Design Sketch

#### Public Interfaces (Không đổi — 100% Backward Compatible)

- `ChatBubbleProps` (`src/app/features/chat/components/ChatBubble.tsx:63-87`): Không thay đổi chữ ký hay props của caller (`src/app/features/chat/components/ChatMessagesArea.tsx:254-274`).
- `BubbleMarkdownProps` (`src/app/features/chat/components/BubbleMarkdown.tsx:190-197`): Không thay đổi; bất kỳ caller nào gọi `<BubbleMarkdown isBot={false} content={...} />` trong flex/grid container đều tự động hưởng `min-content` an toàn nhờ `wrap-anywhere`.
- `ThinkingBlock` (`src/app/features/chat/components/BubbleHelpers.tsx:57-65`) và `FileInMessageProps` (`src/app/features/chat/components/FileInMessage.tsx:17-21`): Không thay đổi.

#### Chuỗi CSS Layout Trước / Sau (User Bubble `!isBot`)

```tsx
// src/app/features/chat/components/ChatBubble.tsx — Từ dòng 246 xuống src/app/features/chat/components/BubbleMarkdown.tsx:208
// 1. Root (giữ nguyên):
<motion.div className={`group flex w-full flex-col py-3.5 ${isBot ? "" : "items-end"}`}>

  // 2. Cap wrapper (line 249): tách min-w-0 vào tiền tố chung cho cả bot & user
  <div className={`relative flex flex-col min-w-0 ${isBot ? "w-full" : "items-end max-w-[85%]"}`}>

    {isBot && (/* Avatar + model label */)}
    // (Xóa dòng trống 265 để tổng số dòng ChatBubble.tsx = 500 <= 500)

    // 3. Stack wrapper (line 267): tách min-w-0 vào tiền tố chung
    <div className={`flex flex-col gap-2 min-w-0 ${isBot ? "items-start w-full" : "items-end max-w-full"}`}>

      // 4. Bubble box (lines 270-272): thêm min-w-0 max-w-full chung; chuyển px-1 vào riêng nhánh isBot
      <div
        className={`relative rounded-2xl text-base leading-relaxed transition-colors min-w-0 max-w-full ${
          isBot ? "px-1 text-(--text) w-full" : "bg-(--raised) px-4 py-2.5 text-(--text)"
        }`}
      >
        {isEditing ? (
          // 5a. Edit wrapper (line 275): bổ sung max-w-full phòng thủ
          <div className="flex flex-col gap-2 w-full max-w-full min-w-[min(60vw,18rem)] md:min-w-[min(100%,32rem)]">
            <Textarea ... />
          </div>
        ) : (
          // 5b. Content wrapper (line 309): bổ sung min-w-0
          <div className="flex flex-col w-full min-w-0 overflow-hidden" aria-busy={...}>
            {/* src/app/features/chat/components/FileInMessage.tsx:81 -> "flex flex-wrap gap-1.5 mb-2 min-w-0 max-w-full" */}
            {/* src/app/features/chat/components/FileInMessage.tsx:90 -> "... max-w-[min(220px,100%)] min-w-0 ..." */}
            {/* src/app/features/chat/components/BubbleMarkdown.tsx:208 (isBot === false) -> */}
            <span className={`whitespace-pre-wrap wrap-anywhere ${className}`}>{content}</span>
          </div>
        )}
      </div>
    </div>
  </div>
</motion.div>
```

#### Chứng Minh Toán Học Sizing (`fit-content(available)`)

Với phần tử shrink-to-fit bên trong `flex-col items-end`, chiều rộng sử dụng là `min(max-width, max(min-content, min(max-content, available)))`:

- **`wrap-anywhere` (`overflow-wrap: anywhere`)**:
  - Giảm `min-content` xuống ~1 ký tự (`~10px`, cộng padding `32px` = `~42px`) thay vì `~1629px`.
  - **KHÔNG** làm giảm `max-content` (theo CSS Text Level 3, `max-content` chỉ ngắt ở ký tự xuống dòng cứng `\n`).
- Hệ quả cho 3 loại nội dung trên Desktop `1440×900` (cột `896px`, `85% = 761.6px`, lõi `729.6px`):
  1. **Tin nhắn ngắn** (`"Cảm ơn bạn!"`, `max-content ≈ 132px`): `min(761.6, max(42, min(132, 896))) = 132px` ➔ **Co gọn (shrink-to-fit) chính xác**.
  2. **Đoạn văn nhiều từ** (`max-content ≈ 1900px`): `min(761.6, max(42, min(1900, 896))) = 761.6px` ➔ Mở rộng tới `85%`, sau đó ngắt dòng ở **ranh giới khoảng trắng tự nhiên** (không cắt giữa từ như `break-all`).
  3. **URL dài 170+ ký tự không khoảng trắng** (`max-content ≈ 1629px`, `min-content ≈ 42px`): `min(761.6, max(42, min(1629, 896))) = 761.6px` ➔ Nằm gọn trong `85%` (`left = 574.4px >= 440px`, `right = 1336px`), bẻ dòng mềm mượt bên trong `729.6px`.

#### `BubbleHelpers.tsx` (`ThinkingBlock`)

- Dòng `83`: `mb-4 w-full min-w-0 rounded-lg border border-(--line) overflow-hidden bg-(--raised)`
- Dòng `112`: `px-3 py-3 border-t border-(--line) text-sm text-(--muted) font-mono leading-relaxed bg-(--raised)/50 whitespace-pre-wrap wrap-anywhere max-h-96 overflow-y-auto overflow-x-hidden`

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [x] **Bước 1 — Sửa chuỗi flex & padding conflict trong `ChatBubble.tsx`**:
  - Cập nhật `src/app/features/chat/components/ChatBubble.tsx:249,267,270-272,275,309` theo đúng Design Sketch ở Mục 6.
  - Xóa 1 dòng trống tại `src/app/features/chat/components/ChatBubble.tsx:265` để tổng số dòng file sau định dạng Prettier là `<= 500` dòng.
- [x] **Bước 2 — Đổi `break-words` ➔ `wrap-anywhere` trong `BubbleMarkdown.tsx`**:
  - Cập nhật `src/app/features/chat/components/BubbleMarkdown.tsx:208` từ `whitespace-pre-wrap break-words` sang `whitespace-pre-wrap wrap-anywhere` (loại bỏ hoàn toàn `break-words` để tránh xung đột cùng thuộc tính `overflow-wrap`).
- [x] **Bước 3 — Chặn tràn ngang trong `ThinkingBlock` (`BubbleHelpers.tsx`) & `FileInMessage.tsx`**:
  - Cập nhật `src/app/features/chat/components/BubbleHelpers.tsx:83,112` (`w-full min-w-0` và `wrap-anywhere overflow-x-hidden`).
  - Cập nhật `src/app/features/chat/components/FileInMessage.tsx:81,90` (`min-w-0 max-w-full` và `max-w-[min(220px,100%)] min-w-0`).
- [x] **Bước 4 — Viết & cập nhật các bộ test co-located**:
  - Cập nhật `src/app/features/chat/components/ChatBubble.test.tsx` (thêm các case `TC-UB-01`, `TC-UB-03`, `TC-UB-05`, `TC-UB-06` + `NP-1`).
  - Tạo mới `src/app/features/chat/components/BubbleMarkdown.test.tsx` (`TC-UB-02`, `TC-UB-03`, `TC-UB-04`, `TC-UB-09` + `NP-1`).
  - Cập nhật `src/app/features/chat/components/BubbleHelpers.test.tsx` (`TC-UB-07`).
  - Tạo mới `src/app/features/chat/components/FileInMessage.test.tsx` (`TC-UB-08`).
- [x] **Bước 5 — Chạy kiểm thử tự động (Tier 1 & Tier 2)**:
  - Chạy bộ test co-located targeted, `npm run type-check; npm run lint; npm run test:run`, kiểm tra line count `ChatBubble.tsx <= 500`.
- [x] **Bước 6 — Playwright Visual QA Gate (Bắt buộc theo `.agents/rules/03-ui.md:121-128`)**:
  - Khởi động `next dev` cục bộ (port `3100`), mock auth/API hội thoại gồm: (a) tin nhắn người dùng ngắn `"Cảm ơn bạn!"`, (b) đoạn văn nhiều từ tiếng Việt/Anh, (c) tin nhắn người dùng chứa URL Amazon 170+ ký tự không khoảng trắng, (d) tin nhắn hỗn hợp văn bản + URL Google Docs dài + tệp đính kèm tên dài, (e) tin nhắn trợ lý có `ThinkingBlock` chứa URL dài không khoảng trắng, và (f) trạng thái mở `Edit` trên tin nhắn chứa URL dài.
  - Chạy kịch bản Playwright đo `getBoundingClientRect()` (trái/phải/rộng) + `getComputedStyle(...).overflowWrap === "anywhere"` + `thinkingEl.scrollWidth <= thinkingEl.clientWidth + 1` + `document.documentElement.scrollWidth <= window.innerWidth` và chụp `.png` vào thư mục scratch ngoài git ở **4 cấu hình**: Desktop `1440×900` Dark, Desktop `1440×900` Light, Mobile `375×812` Dark, Mobile `375×812` Light.
  - Gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự soi bố cục, độ gọn shrink-to-fit, cách xuống dòng và độ tương phản; dừng `next dev`, khôi phục `next-env.d.ts` nếu bị chạm, xóa file scratch.
- [x] **Bước 7 — Post-Fix Protocol (`.agents/skills/vikini-debug/SKILL.md:62-93`)**:
  - Thêm bài học `### 2026-11-22: User chat bubble unscrollable LTR left-overflow on long unbroken URLs (overflow-wrap: break-word vs anywhere)` ngay dưới `## UI and Styling` trong `docs/lessons-learned.md`.
  - Cập nhật mục fix tương ứng ở đầu `docs/CHANGELOG.md` (nhóm `2026-11-22`).
  - Chạy lại `npm run type-check; npm run lint; npm run test:run` lần cuối sau khi sửa xong toàn bộ và kết thúc báo cáo bằng dòng xác nhận: `Lesson recorded in docs/lessons-learned.md: ...`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Test Case ID   | Mô tả hành vi & Đầu vào (Input)                                                                                                                                                 | Kết quả mong đợi (Pass Criteria)                                                                                                                                                                                                                                                                                                                                                                                                       | Điều kiện thất bại (Fail Mode)                                                                                              | Tầng kiểm thử                                                                    |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **`TC-UB-01`** | Tin nhắn người dùng ngắn: `"Cảm ơn bạn!"` (`role: "user"`).                                                                                                                     | User bubble (`div.rounded-2xl`) giữ `bg-(--raised) px-4 py-2.5 text-(--text) min-w-0 max-w-full` và **KHÔNG** có `w-full`; trên Playwright Desktop `1440×900`, `bubbleRect.width < containerRect.width * 0.5` và `bubbleRect.right <= containerRect.right + 1`.                                                                                                                                                                        | Bóng chat giãn full `85%`/`100%` làm mất hiệu ứng shrink-to-fit.                                                            | Vitest (`ChatBubble.test.tsx`) + Playwright Visual QA                            |
| **`TC-UB-02`** | Văn bản người dùng nhiều từ tiếng Việt & tiếng Anh (~250 ký tự, có khoảng trắng).                                                                                               | `<BubbleMarkdown isBot={false}>` render `<span>` với `whitespace-pre-wrap wrap-anywhere` và **KHÔNG** có `break-all`; trên Playwright, bóng đạt tối đa `<= 85%` cột chat và ngắt dòng tại ranh giới từ (không cắt giữa từ thường).                                                                                                                                                                                                     | Dùng `break-all` làm gãy từ bình thường giữa chừng hoặc vượt quá `85%`.                                                     | Vitest (`BubbleMarkdown.test.tsx`) + Playwright Visual QA                        |
| **`TC-UB-03`** | Tin nhắn người dùng chỉ chứa 1 URL Amazon dài 170+ ký tự không khoảng trắng (`https://www.amazon.com/dp/B09V3KXJPB?...`) và URL Google Docs dài.                                | Toàn bộ 4 tầng wrapper trong `ChatBubble.tsx` có `min-w-0`, hộp bóng có `max-w-full`, `<span>` có `wrap-anywhere` (`getComputedStyle(span).overflowWrap === "anywhere"`). Trên Playwright (cả `1440×900` và `375×812`): `bubbleRect.left >= containerRect.left - 1`, `bubbleRect.right <= containerRect.right + 1`, `bubbleRect.width <= containerRect.width * 0.85 + 2`, và chiều cao `bubbleRect.height > 60` (đã xuống nhiều dòng). | `bubbleRect.left < containerRect.left - 1` (tràn trái về phía sidebar), `width > 85%`, hoặc chỉ hiển thị 1 dòng bị cắt xén. | Vitest (`ChatBubble.test.tsx`, `BubbleMarkdown.test.tsx`) + Playwright Visual QA |
| **`TC-UB-04`** | Tin nhắn người dùng hỗn hợp: `"Xem giúp mình link này:\nhttps://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?usp=sharing&tab=t.0&very_long_param=..."` | Giữ nguyên ký tự xuống dòng `\n` (`whitespace-pre-wrap`), văn bản đầu xuống dòng tự nhiên, URL bẻ dòng mềm bên trong bóng, thỏa mãn `left >= containerRect.left - 1` và `right <= containerRect.right + 1`.                                                                                                                                                                                                                            | Mất xuống dòng `\n` hoặc URL kéo rộng toàn bộ bóng vượt `85%`.                                                              | Vitest (`BubbleMarkdown.test.tsx`) + Playwright Visual QA                        |
| **`TC-UB-05`** | Kiểm tra xung đột padding cascade giữa user bubble và assistant bubble.                                                                                                         | User `.rounded-2xl` có `px-4`, `py-2.5`, `min-w-0`, `max-w-full` và **KHÔNG** có `px-1`; Assistant `.rounded-2xl` có `px-1`, `w-full`, `min-w-0`, `max-w-full`, `text-(--text)` và không có `bg-(--raised)`.                                                                                                                                                                                                                           | User bubble còn lẫn `px-1` hoặc assistant bubble mất `px-1`/`w-full`.                                                       | Vitest (`ChatBubble.test.tsx`)                                                   |
| **`TC-UB-06`** | Chế độ chỉnh sửa (`isEditing = true`) trên tin nhắn người dùng chứa URL dài 170+ ký tự.                                                                                         | Container edit có `w-full max-w-full`; `<Textarea>` giữ nguyên giá trị URL và lưu/hủy đúng; trên Playwright (`1440×900` & `375×812`), hộp edit thỏa `editRect.left >= containerRect.left - 1` và `editRect.right <= containerRect.right + 1`.                                                                                                                                                                                          | Hộp edit tràn trái hoặc vượt khỏi cột chat trên Desktop/Mobile.                                                             | Vitest (`ChatBubble.test.tsx`) + Playwright Visual QA                            |
| **`TC-UB-07`** | `ThinkingBlock` mở rộng với chuỗi `<thought>` chứa URL dài 170+ ký tự không khoảng trắng.                                                                                       | Khung ngoài có `w-full min-w-0`; nội dung mở rộng có `whitespace-pre-wrap wrap-anywhere overflow-x-hidden overflow-y-auto`; trên Playwright, `getComputedStyle(el).overflowWrap === "anywhere"` và `el.scrollWidth <= el.clientWidth + 1` (không sinh thanh cuộn ngang).                                                                                                                                                               | Xuất hiện thanh cuộn ngang hoặc URL trong `<thought>` bị cắt ngang khỏi biên phải.                                          | Vitest (`BubbleHelpers.test.tsx`) + Playwright Visual QA                         |
| **`TC-UB-08`** | `FileInMessage` hiển thị tệp có tên dài không khoảng trắng (ví dụ `very_long_unbroken_attachment_filename_2026_11_22_report_final_v2.pdf`).                                     | Wrapper có `min-w-0 max-w-full`, nút tệp có `max-w-[min(220px,100%)] min-w-0`, tên tệp có `truncate`; không kéo phình bóng chat vượt `85%`.                                                                                                                                                                                                                                                                                            | Tên tệp kéo giãn bóng chat hoặc nút `220px` tràn khỏi bóng trên màn hình hẹp.                                               | Vitest (`FileInMessage.test.tsx`) + Playwright Visual QA                         |
| **`TC-UB-09`** | Hồi quy tin nhắn trợ lý `BubbleMarkdown` (`isBot={true}`) chứa URL Markdown và văn bản thường.                                                                                  | Render `.chat-markdown.w-full.overflow-hidden`, thẻ `<a>` vẫn có `break-all`, không làm gãy rendering Markdown hay `StreamingActivityBar`.                                                                                                                                                                                                                                                                                             | Phá vỡ định dạng Markdown hoặc làm mất `break-all` trên liên kết trợ lý.                                                    | Vitest (`BubbleMarkdown.test.tsx`, `ChatBubble.test.tsx`)                        |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Unit / Component Test Files

1. `src/app/features/chat/components/ChatBubble.test.tsx` (cập nhật — đã có sẵn 523 dòng, mở rộng suite `User message rendering` & `Edit mode`).
2. `src/app/features/chat/components/BubbleMarkdown.test.tsx` (tạo mới — co-located cạnh `BubbleMarkdown.tsx`).
3. `src/app/features/chat/components/BubbleHelpers.test.tsx` (cập nhật — mở rộng suite `ThinkingBlock`).
4. `src/app/features/chat/components/FileInMessage.test.tsx` (tạo mới — co-located cạnh `FileInMessage.tsx`).

#### Lệnh Kiểm Chứng (Windows PowerShell 5.1 — bắt buộc dùng `;`, cấm `&&`)

```powershell
# 1. Targeted co-located component tests
npx vitest run src/app/features/chat/components/ChatBubble.test.tsx src/app/features/chat/components/BubbleMarkdown.test.tsx src/app/features/chat/components/BubbleHelpers.test.tsx src/app/features/chat/components/FileInMessage.test.tsx --reporter=dot

# 2. Full verification suite (Tier 2)
npm run type-check; npm run lint; npm run test:run

# 3. Line-count guard on ChatBubble.tsx (<= 500 hard max)
(Get-Content src/app/features/chat/components/ChatBubble.tsx).Count
```

#### Wiring Probes (Chứng Minh Cơ Chế Hoạt Động Thực Tế)

- **`WP-1` (Live Tailwind CSS v4.1.18 Compilation Probe)**: Trên `next dev` thực tế qua Playwright, thực thi `page.evaluate()` đọc `getComputedStyle(userSpan).overflowWrap` và `getComputedStyle(thinkingContent).overflowWrap` — BẮT BUỘC trả về chính xác `"anywhere"` (chứng minh Tailwind v4.1.18 biên dịch thành công `wrap-anywhere` thành CSS thật, không phải tên class vô hiệu).
- **`WP-2` (ESLint Vikini Design Wiring Probe)**: Chạy `npx eslint src/app/features/chat/components/ChatBubble.tsx src/app/features/chat/components/BubbleMarkdown.tsx src/app/features/chat/components/BubbleHelpers.tsx src/app/features/chat/components/FileInMessage.tsx` — exit code `0`, `0` errors, `0` warnings (`vikini-design` rules kích hoạt tại `eslint.config.mjs:119-144`).
- **`WP-3` (File Size Hard Max Probe)**: `(Get-Content src/app/features/chat/components/ChatBubble.tsx).Count` trả về `<= 500` (xác nhận tuân thủ `.agents/rules/01-coding.md:102`).

#### Negative Probes (Chứng Minh Guard/Rule Chặn Đúng Lỗi)

- **`NP-1` (Anti-Regression Class Assertions trong Vitest)**:
  - `BubbleMarkdown.test.tsx` khẳng định `expect(span).not.toHaveClass("break-words")` và `expect(span).not.toHaveClass("break-all")` trên nhánh `isBot={false}` (chặn việc quay lại `overflow-wrap: break-word` gây tràn hoặc `break-all` phá vỡ từ).
  - `ChatBubble.test.tsx` khẳng định user `.rounded-2xl` `not.toHaveClass("px-1")` và `not.toHaveClass("w-full")` (chặn xung đột cascade padding và chặn phá vỡ shrink-to-fit).
- **`NP-2` (Playwright Bounding-Box LTR Left-Overflow Probe)**:
  - Trên live browser (`1440×900` và `375×812`, Dark & Light), kiểm chứng **đồng thời** 4 bất đẳng thức cho mọi bóng tin nhắn người dùng (ngắn, đoạn văn, URL Amazon 170+ ký tự, URL Google Docs, hỗn hợp + file, và chế độ Edit):
    1. `bubbleRect.left >= containerRect.left - 1` (bắt trực tiếp lỗi tràn trái unscrollable trong LTR — thứ mà `scrollWidth <= innerWidth` bỏ sót!),
    2. `bubbleRect.right <= containerRect.right + 1`,
    3. `bubbleRect.width <= containerRect.width * 0.85 + 2`,
    4. `document.documentElement.scrollWidth <= window.innerWidth` và với `ThinkingBlock` đang mở: `thinkingContent.scrollWidth <= thinkingContent.clientWidth + 1`.
- **`NP-3` (Multimodal Visual QA Inspection — 4 Ma Trận Viewport × Theme)**:
  - Chụp `.png` tại thư mục scratch ngoài git (`Desktop 1440×900 Dark`, `Desktop 1440×900 Light`, `Mobile 375×812 Dark`, `Mobile 375×812 Light`) cho cả trạng thái xem thường, mở `ThinkingBlock`, và mở `Edit` trên tin nhắn URL dài.
  - Gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự kiểm tra bằng mắt: không tràn vào sidebar, không bị cắt ký tự đầu URL, tin nhắn ngắn vẫn co gọn tự nhiên, độ tương phản `--raised`/`--text` rõ nét ở cả Dark & Light, sau đó dọn sạch tiến trình `next dev` và thư mục scratch.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                | Mức độ         | Tác động                                                                                                                                                                                           | Technical Control & Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                          |
| :-------------------------------------------------------------------------------------------------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`wrap-anywhere` không được biên dịch thành `overflow-wrap: anywhere` (hoặc xung đột với `break-words`)**            | **Cao**        | Bóng chat người dùng vẫn giữ `min-content = ~1629px` và tiếp tục tràn trái `left: -293px` trên trình duyệt thật.                                                                                   | Control: Thay thế hoàn toàn `break-words` bằng `wrap-anywhere` tại `src/app/features/chat/components/BubbleMarkdown.tsx:208` (trên `tailwindcss@4.1.18`, `node_modules/tailwindcss/package.json:3`). Kiểm chứng bắt buộc bằng **`WP-1`** (`getComputedStyle(...).overflowWrap === "anywhere"`) + **`NP-1`** (`not.toHaveClass("break-words")`) + **`NP-2`** (`bubbleRect.left >= containerRect.left - 1`).                         |
| **Phá vỡ hiệu ứng shrink-to-fit của tin nhắn ngắn (`"Cảm ơn bạn!"`)**                                                 | **Trung bình** | Nếu gắn nhầm `w-full` lên hộp user bubble (`src/app/features/chat/components/ChatBubble.tsx:249,267,270`), tin nhắn ngắn bị kéo dài thành thanh ngang rộng `85%`, sai thẩm mỹ UI.                  | Control: Chỉ dùng `max-w-[85%] min-w-0` / `max-w-full min-w-0` (tuyệt đối không dùng `w-full` cho nhánh `!isBot` ở `src/app/features/chat/components/ChatBubble.tsx:249,267,270-272`). Kiểm chứng bằng **`NP-1`** (`not.toHaveClass("w-full")`) và **`TC-UB-01`** (`bubbleRect.width < containerRect.width * 0.5` trong Playwright Visual QA).                                                                                     |
| **Chế độ `isEditing` hoặc `ThinkingBlock` / `FileInMessage` bị tràn ngang trên Mobile `375px` hoặc Desktop `1440px`** | **Trung bình** | Khi sửa tin nhắn URL dài hoặc mở `<thought>` chứa URL dài, hộp edit tràn biên cột chat hoặc `ThinkingBlock` sinh thanh cuộn ngang khó đọc.                                                         | Control: Thêm `max-w-full` vào `src/app/features/chat/components/ChatBubble.tsx:275`, `w-full min-w-0` + `wrap-anywhere overflow-x-hidden` vào `src/app/features/chat/components/BubbleHelpers.tsx:83,112`, và `min-w-0 max-w-full` + `max-w-[min(220px,100%)] min-w-0` vào `src/app/features/chat/components/FileInMessage.tsx:81,90`. Kiểm chứng bằng **`TC-UB-06`**, **`TC-UB-07`**, **`TC-UB-08`**, **`NP-2`**, và **`NP-3`**. |
| **`ChatBubble.tsx` vượt trần Hard Max `500` dòng sau khi sửa**                                                        | **Trung bình** | Vi phạm chuẩn kích thước UI Component tại `.agents/rules/01-coding.md:102`.                                                                                                                        | Control: Factor `min-w-0` vào chuỗi chung thay vì lặp nhánh, và xóa 1 dòng trống thừa ngay tại `src/app/features/chat/components/ChatBubble.tsx:265` (giảm từ `501` xuống `500` dòng). Kiểm chứng bằng **`WP-3`** (`(Get-Content ...).Count -le 500`).                                                                                                                                                                             |
| **Kiểm thử tự động bỏ sót LTR left-overflow nếu chỉ đo `scrollWidth <= innerWidth`**                                  | **Trung bình** | Trong LTR, phần tử tràn sang trái của `#main-content` (`src/app/features/chat/components/ChatApp.tsx:295`, `overflow-y-auto`) không làm tăng `scrollWidth`, dẫn đến báo xanh giả (false positive). | Control: Bắt buộc kiểm tra `getBoundingClientRect()` ở cả 2 biên trái/phải (`NP-2`) + soi ảnh chụp thực tế (`NP-3`), đồng thời ghi thành Prevention Rule trong `docs/lessons-learned.md`.                                                                                                                                                                                                                                          |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision `1` (lượt thẩm định đầu tiên — không có bảng lỗi cũ từ lượt trước).
- Kết quả chạy `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-user-bubble-long-url-overflow.md` (exit code `0`):
  - `[PASS] SECTIONS 7/7`
  - `65/65` `[PASS] LINE_REF` hợp lệ trên codebase thật
  - `[INFO] CRITIC_REQUIRED no` (xác nhận không chạm `*.server.ts`, auth, database/SQL, hay `.agents/**`)
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                          | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | ------- | -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | RISK_DISMISSED | N/A     | `node_modules/tailwindcss/dist/chunk-CT46QCH7.mjs:10,16`             | `[SRC]`    | Kiểm chứng trực tiếp compiler `tailwindcss@4.1.18`: dòng `10` đăng ký tĩnh `e("wrap-anywhere",[["overflow-wrap","anywhere"]])`, còn dòng `16` ánh xạ `break-words` ➔ `wrap-break-word` (`overflow-wrap: break-word`). Thay `break-words` bằng `wrap-anywhere` tại `src/app/features/chat/components/BubbleMarkdown.tsx:208` xử lý đúng nguyên nhân gốc `min-content`, kèm `WP-1` đo `getComputedStyle` trên trình duyệt thật.                                                                                |
| 2   | RISK_DISMISSED | N/A     | `src/app/features/chat/components/ChatBubble.tsx:275,287`            | `[SRC]`    | Trong CSS, `min-width` thắng `max-width`, nên đã đối chiếu số học `min-w-[min(60vw,18rem)] md:min-w-[min(100%,32rem)]` dựa trên `src/app/features/chat/components/ChatApp.tsx:295` và `src/app/features/layout/utils/shellNav.ts:67-71`: ở `375px`, `225px <= 259.55px`; ở `320px`, `192px <= 212.8px`; ở `768px` (`md`), `min(100%,32rem)` khóa tại `100%` (`<= 335.2px`); ở `1440px`, `512px <= 729.6px`. Bổ sung `max-w-full` mang tính phòng thủ không gây hồi quy và có `TC-UB-06` + `NP-2` kiểm chứng. |
| 3   | RISK_DISMISSED | N/A     | `src/app/features/chat/components/FileInMessage.tsx:35-54,81,90,101` | `[SRC]`    | Nghi vấn tên tệp dài không khoảng trắng kéo phình nút `flex` hoặc phát sinh `fetch()` treo trong test mới: `<span className="truncate">` (`line 101`) có `overflow: hidden` nên automatic min-size là `0`, cắt gọn đúng trong `max-w-[min(220px,100%)] min-w-0`; `MessageImageThumb` chỉ gọi `fetch()` khi `file.kind === "image"` không có `initialSrc` và đã hủy bằng cờ `cancelled = true` khi unmount.                                                                                                   |
| 4   | DEFECT         | [MINOR] | `src/app/features/chat/components/ChatBubble.tsx:265,275,501`        | `[SRC]`    | Xóa 1 dòng trống tại dòng `265` đưa `ChatBubble.tsx` từ `501` về đúng trần `500/500` dòng (`.agents/rules/01-coding.md:102`), không còn biên dự phòng nếu định dạng lại dòng `275` (`122` ký tự > `printWidth: 100` tại `.prettierrc:5`). Hiện Prettier v3 giữ thẻ single-string-attribute trên 1 dòng (tương tự `ChatBubble.tsx:398`); khuyến nghị kiểm tra `WP-3` sau khi format.                                                                                                                          |
| 5   | DEFECT         | [MINOR] | `.agents/rules/03-ui.md:126`                                         | `[SRC]`    | Bước 6 & `NP-2`/`NP-3` đủ 4 cấu hình viewport×theme, `getBoundingClientRect()`, `scrollWidth <= innerWidth` và đọc ảnh bằng `read_file`, nhưng chưa nêu tường minh bước kiểm tra `axe-core` tại `.agents/rules/03-ui.md:126`. Do thay đổi thuần CSS layout không đụng ARIA/tên truy cập, lỗi này ở mức `[MINOR]`; khuyến nghị chạy kèm `axe-core` trong kịch bản Playwright Bước 6.                                                                                                                          |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                          | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                | Chi tiết                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan Completeness Gate (7 mục)**           | PASS    | `[CMD]` `verify-plan.mjs` (`SECTIONS 7/7`, `65/65 LINE_REF`)                                                                                                                                                                                                                                              | Đủ Goal/Out of Scope, Pre-Work & Skills Loaded, Assumptions/Dependencies, Verified Versions, Files, Caller-First Sketch, Steps, Test Contract (`TC-UB-01..09`), Co-located Tests & Probes (`WP-1..3`, `NP-1..3`), Risk Table.                                                                                                            |
| **Skills Loaded & Applied**                  | PASS    | `[SRC]` `.agents/skills/vikini-debug/SKILL.md:12-93`, `.agents/rules/03-ui.md:73-75,118,121-128`, `.agents/rules/01-coding.md:98-106`                                                                                                                                                                     | Ánh xạ đủ skill bắt buộc cho miền Bug Fixing & UI Components, bao gồm Post-Fix Protocol (`docs/lessons-learned.md` + `docs/CHANGELOG.md`) và ngưỡng 3 lần không thăng cấp rule.                                                                                                                                                          |
| **S1: Cold-start & Build**                   | PASS    | `[CMD]` `npm run type-check` (exit `0`), `npm run lint` (exit `0`, 0 errors), `npx eslint --print-config src/app/features/chat/components/ChatBubble.tsx` (`vikini-design/*: [2]`); `[SRC]` `package.json:53,64,69-70,87,114,118`, `node_modules/tailwindcss/dist/chunk-CT46QCH7.mjs:10,16`               | Baseline TypeScript sạch; 4 rule `vikini-design` kích hoạt mức `error` trên `ChatBubble.tsx`; `wrap-anywhere` xác minh trực tiếp trong `tailwindcss@4.1.18`; không thêm package hay biến `.env`. (Lưu ý baseline `npm run lint` có 1 warning `curly` sẵn có ngoài phạm vi tại `src/lib/features/chat/googleDocsResolver.server.ts:421`.) |
| **S2: Runner Lifecycle & Teardown**          | PASS    | `[CMD]` `npx vitest run src/app/features/chat/components/ChatBubble.test.tsx src/app/features/chat/components/BubbleHelpers.test.tsx --reporter=dot` (2 files, 31/31 passed); `[SRC]` `tests/setup.ts:7-9`, `src/app/features/chat/components/FileInMessage.tsx:51-53`                                    | Vitest tự động dọn DOM bằng `afterEach(cleanup)` tại `tests/setup.ts:7-9`; không thêm timer/listener mới; Bước 6 & `NP-3` quy định dừng `next dev`, khôi phục `next-env.d.ts` và xóa thư mục scratch.                                                                                                                                    |
| **S3: Database & Temporal Logic**            | N/A     | N/A                                                                                                                                                                                                                                                                                                       | Tác vụ thuần CSS layout & component tests tại `src/app/features/chat/components/`, không chạm bảng dữ liệu, migration, RLS hay múi giờ.                                                                                                                                                                                                  |
| **S4: Cross-Task State Flow**                | PASS    | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:63-87,246-311,475-499`, `src/app/features/chat/components/ChatMessagesArea.tsx:206,241-277`, `src/app/features/chat/components/MessageActions.tsx:116-129`, `src/lib/features/files/useFiles.ts:36-58`, `src/lib/features/files/store.ts:69-188` | Không đổi chữ ký props, memo comparator, Zustand (`useFileStore`) hay SWR (`useFiles`); chuỗi container từ `ChatApp.tsx:268,295` ➔ `ChatMessagesArea.tsx:206` ➔ `ChatBubble.tsx:246-311` ➔ `BubbleMarkdown.tsx:208` khớp mã nguồn thật.                                                                                                  |
| **S5: Security Boundary & 3-Tier Auth**      | N/A     | N/A                                                                                                                                                                                                                                                                                                       | Không chạm API routes, `auth()`/`requireUser()`, `*.server.ts`, Redis hay cấu hình `rehypeSanitize` (`BubbleMarkdown.tsx:174-188` giữ nguyên; user bubble vẫn là plain-text `<span>`).                                                                                                                                                   |
| **S6: External Resilience & Serverless Cap** | N/A     | N/A                                                                                                                                                                                                                                                                                                       | Không gọi AI provider bên ngoài, không thay đổi SSE stream hay `maxDuration`.                                                                                                                                                                                                                                                            |
| **Domain: Open Inquiry (Vikini)**            | PASS    | `[CMD]` `node scripts/verify-docs.mjs` (Check `[4/5]` PASS: governance char limits); `[SRC]` `.agents/rules/03-ui.md:21-29,73-75`, `.agents/rules/04-bilingual.md`, `src/app/styles/themes/_shared/utilities.css:18-21`                                                                                   | Giữ nguyên token Vikini 3.0 (`bg-(--raised)`, `text-(--text)`), không thêm chuỗi UI mới (không cần sửa `vi.ts`/`en.ts`), giữ `.chat-markdown` của bot không hồi quy, giới hạn `ChatBubble.tsx <= 500` dòng.                                                                                                                              |
| **Risk Table & Enforcement Probes**          | PASS    | `[SRC]` `eslint.config.mjs:119-144`, `scripts/vikini-design-lint.mjs:12-24`; `[CMD]` `npx eslint --print-config`                                                                                                                                                                                          | 1 rủi ro Cao và 4 rủi ro Trung bình đều ánh xạ 1-1 tới technical control tại `file:line` và bộ probe `WP-1..3` / `NP-1..3`.                                                                                                                                                                                                              |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục đối kháng)**:
  - **Trục 1 (Đồng thời)**: `N/A` — Không có ghi trạng thái đồng thời, giao dịch DB hay retry stream; chỉ thay đổi lớp CSS tĩnh và component tests.
  - **Trục 2 (Khoảng trống check→use / TOCTOU)**: `N/A` — Không có bước kiểm tra quyền, kiểm tra quota, hay xác thực URL phía server.
  - **Trục 3 (Thất bại giữa chừng & bước dọn dẹp)**: `N/A` — Không mở SSE stream hay tài nguyên mạng mới; `FileInMessage.tsx:37,51-53` giữ nguyên cờ hủy `cancelled` khi unmount và Bước 6 có quy trình dừng `next dev`/xóa scratch.
  - **Trục 4 (Môi trường serverless)**: `N/A` — Toàn bộ file chỉnh sửa là Client Components (`"use client"`) và unit tests.
- **Commands Executed (allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-user-bubble-long-url-overflow.md` ➔ exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`).
  2. `npm run type-check` ➔ exit `0`.
  3. `npx vitest run src/app/features/chat/components/ChatBubble.test.tsx src/app/features/chat/components/BubbleHelpers.test.tsx --reporter=dot` ➔ exit `0` (`2 passed`, `31 passed`).
  4. `npx eslint --print-config src/app/features/chat/components/ChatBubble.tsx` ➔ exit `0` (xác nhận `vikini-design/*` ở mức `2`).
  5. `npm run lint` ➔ exit `0` (`0 errors, 1 warning` sẵn có ngoài phạm vi ở `googleDocsResolver.server.ts:421`).
  6. `node scripts/verify-docs.mjs` ➔ exit `1` (Check `[3/5]` và `[4/5]` governance char limits `PASS`; Check `[1/5]`/`[2/5]` lỗi sẵn có từ worktree `.claude/worktrees/` cũ và Check `[5/5]` `CHANGELOG.md` 120,685 bytes sẵn có ngoài phạm vi task).
  7. `git status` ➔ exit `0` (không có thay đổi source code trước duyệt).

#### 4. Kết Luận

- Không ghi nhận lỗi `[BLOCKER]` hay `[MAJOR]`; chỉ có 2 lưu ý `[MINOR]` không chặn thực thi (`ChatBubble.tsx` chạm trần `500/500` dòng sau khi xóa dòng `265`, và khuyến nghị kèm `axe-core` trong bước Playwright Visual QA).
- `CRITIC_REQUIRED` = `no` ➔ Kế hoạch đủ điều kiện mở khóa thực thi ngay theo phạm vi `[NEW]`/`[MODIFY]` đã khai báo.

[PLAN_APPROVED]

# Thiết Kế Chi Tiết: Nâng Cấp Toàn Diện UX/UI Chat Core Vikini (Phương Án A+)

> **Ngày tạo**: 2026-09-04  
> **Trạng thái**: Đã phê duyệt ý tưởng (Ready for Implementation Planning)  
> **Tác giả**: AI Lead Full-Stack & Design Engineer  
> **Phạm vi**: Chat Core (`ChatBubble`, `InputForm`, `ChatControls`, `SmartCode`, `MessageActions`, `BubbleHelpers`)

---

## 1. Tổng Quan & Mục Tiêu (Executive Summary)

Đợt nâng cấp **Chat Core UX/UI Augmentation** nhằm chuyển hóa trải nghiệm cốt lõi của Vikini từ mức "hoạt động tốt" lên chuẩn **Craft-grade đẳng cấp cao (World-Class)**.

Bản thiết kế giải quyết triệt để 4 nhóm vấn đề chính:

1. **Kiến trúc & Giới hạn mã nguồn**: Phân rã file `ChatBubble.tsx` (hiện 582 dòng, vượt trần 500 dòng) thành các module con đơn nhiệm (`BubbleMarkdown`, `BubbleAvatar`), triệt tiêu các anti-pattern (prop-drilling `t`, hand-rolled modal backdrop).
2. **Chuẩn hóa Design Tokens & 15 Themes**: Khắc phục 100% các class CSS chết trong Tailwind v4 (`border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`, `bg-control`, `bg-surface/95`), đảm bảo hiển thị sắc nét và tương thích toàn bộ 15 themes (Focus, Glassmorphism, RA2).
3. **Thang đo Typography & Accessibility**: Xóa bỏ hoàn toàn font chữ sub-12px (`text-[8px]`, `text-[10px]`), nâng lên chuẩn `text-xs` (12px) dễ đọc, bổ sung đầy đủ focus states (`focus-visible:ring-2`) và thuộc tính ARIA (`aria-expanded`, `aria-pressed`).
4. **Vi tương tác (Micro-interactions theo Emil Kowalski)**: Thêm phản hồi vật lý `:active` scale cho nút bấm, con trỏ gõ chống rớt dòng (`anti-orphan TypingCursor`), Thinking block chuyển trạng thái mượt mà, khối code Developer-grade bỏ cửa sổ Mac giả, thanh MessageActions dạng Floating Glass Dock tinh tế.

---

## 2. Kiểm Tra Hiện Trạng & Vấn Đề (Current State Audit)

| Khu vực / File                         | Hiện trạng & Điểm nghẽn                                                                                                                           | Vi phạm quy chuẩn                                                                                | Giải pháp chuẩn hóa                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `ChatBubble.tsx` (582 dòng)            | File gộp quá nhiều logic: Markdown renderers, avatar pulse, edit state, clipboard, TTS, layout.                                                   | Vượt trần 500 dòng (`rules/01-coding.md`).                                                       | Tách thành `ChatBubble.tsx` (<220 dòng), `BubbleMarkdown.tsx` (~150 dòng), `BubbleAvatar.tsx` (~65 dòng).        |
| `ChatBubble.tsx` & `BubbleHelpers.tsx` | Dùng các class: `border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`, `bg-control`.                        | Class chết trong Tailwind v4 (`rules/03-ui.md`). Không ăn style trên 15 themes.                  | Chuyển sang `border-(--border)`, `bg-(--surface-elevated)`, `text-(--text-primary)`, `text-(--text-secondary)`.  |
| `InputForm.tsx` (365 dòng)             | Prop-drilling `t?: Record<string, string>`, dùng SVG code tay (`PaperAirplaneIcon`, `StopIcon`).                                                  | Vi phạm `rules/04-bilingual.md` (cấm prop-drill `t`), vi phạm `rules/03-ui.md` (cấm custom SVG). | Dùng trực tiếp `useLanguage()`, thay bằng icons Lucide (`SendHorizontal`, `Square`).                             |
| `ChatControls.tsx` (340 dòng)          | Dùng `text-[8px]`, `text-[10px]` cho nút Web Search, Thinking, Deep Research. Modal overlay dùng `<div className="fixed inset-0" onClick=... />`. | Vi phạm cỡ chữ tối thiểu 12px và cấm hand-rolled modal backdrop (`rules/03-ui.md`).              | Đưa về `text-xs` (12px) kèm letter-spacing, thay modal overlay bằng Radix Popover/Dropdown chuẩn.                |
| `SmartCode.tsx` (150 dòng)             | Có 3 chấm Mac window giả (`#ff5f56`, `#ffbd2e`, `#27c93f`), class `card-surface`, `bg-control`.                                                   | Hoa văn AI rập khuôn (`skills/redesign-existing-projects`), class chết Tailwind v4.              | Bỏ 3 chấm Mac, đưa về header tối giản chuẩn dev-tool, gradient mask chân trang, token `bg-(--surface-elevated)`. |
| `MessageActions.tsx` (128 dòng)        | Cỡ chữ `text-[10px]`, thiếu active press feedback, thiếu focus ring.                                                                              | Thiếu a11y và phản hồi tương tác (`skills/emil-design-eng`).                                     | Nâng cấp thành Floating Glass Dock, tap target $\ge 28\text{px}$, `active:scale-[0.95]`.                         |

---

## 3. Kiến Trúc Phân Rã Component (Component Decomposition)

```
src/app/features/chat/components/
├── ChatBubble.tsx              # Shell controller (~220 dòng)
├── BubbleMarkdown.tsx          # [NEW] Custom ReactMarkdown renderers (~150 dòng)
├── BubbleAvatar.tsx            # [NEW] Avatar AI / User & loading shimmer (~65 dòng)
├── BubbleHelpers.tsx           # TypingDots, TypingCursor, ThinkingBlock (~110 dòng)
├── SmartCode.tsx               # Khối mã nguồn cao cấp (~140 dòng)
├── MessageActions.tsx          # Floating Glass Dock (~100 dòng)
├── InputForm.tsx               # Smart Input Bar (~310 dòng)
└── ChatControls.tsx            # Floating Auxiliary Toolbar (~280 dòng)
```

### 3.1 Giao diện Props & Phân Định Trách Nhiệm

#### `BubbleMarkdown.tsx`

```typescript
interface BubbleMarkdownProps {
  content: string;
  isBot: boolean;
  onLightboxFile?: (file: FileItem) => void;
}
```

- Sử dụng `React.memo` để tránh re-render khi tin nhắn khác đang stream.
- Cấu hình Markdown renderers:
  - `p`: Thụt dòng vừa phải, `leading-relaxed`, `text-[15px]` hoặc `text-base`.
  - `h1`, `h2`, `h3`: Font SemiBold/Bold, viền dưới nhẹ cho `h1`.
  - `table`: Bao bọc trong container `overflow-x-auto rounded-lg border border-(--border) bg-(--surface-elevated)`.
  - `blockquote`: `border-l-2 border-(--accent)/50 pl-4 italic text-(--text-secondary)`.
  - `code`: Nhúng `SmartCode` cho block code, inline code có nền `bg-(--control-bg)` và chữ `text-(--accent)`.

#### `BubbleAvatar.tsx`

```typescript
interface BubbleAvatarProps {
  isBot: boolean;
  isLoading: boolean;
  modelName?: string;
}
```

- Nếu là User: Hiển thị chữ `ME` hoặc avatar người dùng với nền `bg-(--accent)` và viền `border-(--accent)/20`.
- Nếu là Assistant (Bot):
  - Khi `isLoading` (đang chờ phản hồi): Vòng xoay shimmer halo tinh tế với `Sparkles` trên nền `bg-(--accent)/10` và border `border-(--accent)/30`.
  - Khi đã có dữ liệu: Hiển thị `ModelAvatar` nhận diện thương hiệu AI (Gemini, Claude, DeepSeek...).

#### `ChatBubble.tsx` (Shell)

- Quản lý `isEditing`, `editContent`, clipboard copy feedback, TTS `isSpeaking`.
- Tách `thought` và `rest` từ nội dung tin nhắn bot.
- Tự động chuyển `deferredDisplayContent` vào `<BubbleMarkdown />` để giữ frame rate ổn định 60fps khi cuộn.
- Bố cục responsive: Người dùng căn phải (`items-end`), Trợ lý căn trái (`items-start`), max-width 90-95%.

---

## 4. Chuẩn Hóa Design Tokens & Trải Nghiệm Thị Giác (Visual Polish)

### 4.1 Bảng ánh xạ Token Chuẩn

Tất cả các lớp CSS bề mặt và màu sắc phải dùng cú pháp token tùy biến của Vikini:

```css
/* Nền trang và vùng chứa */
--surface          -> bg-(--surface)
--surface-muted    -> bg-(--surface-muted)
--surface-elevated -> bg-(--surface-elevated)

/* Chữ và biểu tượng */
--text-primary     -> text-(--text-primary)
--text-secondary   -> text-(--text-secondary)

/* Điều khiển và nút bấm */
--control-bg       -> bg-(--control-bg)
--control-bg-hover -> hover:bg-(--control-bg-hover)
--control-border   -> border-(--control-border)

/* Đường phân cách */
--border           -> border-(--border)

/* Nhận diện & Điểm nhấn */
--accent           -> bg-(--accent) / text-(--accent) / ring-(--accent)
--accent-foreground-> text-(--accent-foreground)
--success          -> text-(--success)
--danger           -> text-(--danger)
```

### 4.2 Thang đo Typography

- **Thân chữ Chat**: `text-[15px]` trên mobile, `text-base` (16px) trên desktop, khoảng cách dòng `leading-relaxed` (1.65).
- **Nhãn, Nút, Huy hiệu**: Tối thiểu `text-xs` (12px), `font-medium` hoặc `font-semibold`, kèm `tracking-wider` cho uppercase.
- **Tiêu đề tin nhắn**:
  - `h1`: `text-xl md:text-2xl font-bold tracking-tight text-(--text-primary) border-b border-(--border) pb-2 mb-4 mt-6`
  - `h2`: `text-lg md:text-xl font-semibold tracking-tight text-(--text-primary) mb-3 mt-5`
  - `h3`: `text-base font-semibold text-(--text-primary) mb-2 mt-4`

### 4.3 Ambient Tinted Shadows

- Khung Input và Bubble bot có độ đổ bóng mang sắc thái tự nhiên:
  `shadow-[0_4px_20px_rgb(0_0_0/0.08)]` kết hợp viền mờ `border-(--border)`.

---

## 5. Vi Tương Tác & Chuyển Động (Emil Kowalski Micro-interactions)

### 5.1 Nút Send/Stop Trạng Thái Thông Minh (State Machine)

- **Trạng thái rỗng**: Nút Send có `opacity-40 cursor-not-allowed scale-95`.
- **Trạng thái sẵn sàng (có text/file)**: Nút Send bật sáng với `opacity-100 scale-100 bg-(--accent) text-(--accent-foreground)` kèm đổ bóng nhẹ `shadow-[0_0_12px_var(--accent)]`.
- **Trạng thái nhấn (Press Feedback)**: Thêm `active:scale-[0.92] transition-transform duration-150 ease-out`.
- **Trạng thái Streaming (Morph to Stop)**:
  - Biểu tượng chuyển đổi mượt sang `Square` (bo góc mềm).
  - Viền có nhịp thở pulsing nhẹ `ring-2 ring-(--danger)/30 bg-(--danger) text-white`.

### 5.2 Con Trỏ Soạn Thảo (Anti-orphan TypingCursor)

- `TypingCursor` được bọc cùng một span `inline-block whitespace-nowrap` với ký tự cuối cùng của chuỗi văn bản để đảm bảo không bao giờ bị rớt một mình xuống hàng mới.
- Tần số nhấp nháy 800ms dạng `ease-in-out` tự nhiên.

### 5.3 ThinkingBlock Accordion

- **Giao diện khi AI suy nghĩ**: Viền phát sáng nhẹ `border-(--accent)/40`, icon `Brain` kèm text `thinkingProcess`.
- **Hiệu ứng thu gọn**: Sử dụng Framer Motion `height: "auto"` thay vì CSS max-height hack, thuộc tính `aria-expanded={!isCollapsed}`, góc xoay `ChevronDown` 180ms.

### 5.4 SmartCode Developer-grade

- Bỏ 3 chấm màu Mac.
- Header gồm:
  - Bên trái: Tên ngôn ngữ in hoa `font-mono text-xs font-semibold text-(--text-secondary)`.
  - Bên phải: Nút "Sao chép" với biểu tượng `Copy` $\rightarrow$ `Check` (`text-(--success)` scale `1.15`).
- Khi vượt quá 20 dòng: Lớp phủ gradient mờ dần `bg-gradient-to-t from-(--surface-elevated) to-transparent` và nút bấm "Mở rộng code" căn giữa thanh lịch.

### 5.5 Floating Glass MessageActions Dock

- Vị trí: Đặt nổi ở chân tin nhắn với khoảng đệm an toàn.
- Nền: `backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) rounded-full px-2 py-1 shadow-sm`.
- Mỗi hành động (Copy, Edit, Regenerate, Speak) là một nút tròn hoặc pill nhỏ, tap-target tối thiểu 28px, có tooltip mô tả và `active:scale-[0.92]`.

---

## 6. Tuân Thủ Đa Ngôn Ngữ & Tiêu Chuẩn Repo (Bilingual & Rules)

- **`rules/04-bilingual.md`**:
  - Loại bỏ hoàn toàn `t?: Record<string, string>` trong `InputForm.tsx`.
  - Tất cả các component con gọi trực tiếp `const { t } = useLanguage()` và dùng key tương ứng (`t("send")`, `t("stopBtn")`, `t("copy")`, `t("copied")`, `t("edit")`, v.v.).
- **`rules/01-coding.md`**:
  - Không sử dụng `any`. Tất cả error catching dùng `catch (err: unknown)`.
  - File size giới hạn: Không có file nào trong nhóm Chat vượt quá 400 dòng.
- **`rules/03-ui.md`**:
  - Toàn bộ icons đến từ `lucide-react`.
  - Hỗ trợ keyboard navigation (`Tab` + `Enter`), focus indicators rõ nét trên toàn bộ các nút.

---

## 7. Kế Hoạch Triển Khai & Kiểm Thử (Verification Plan)

### 7.1 Kế hoạch Kiểm Thử Tự Động (Automated Tests)

- **Tạo Test Co-located**: Tạo `src/app/features/chat/components/ChatBubble.test.tsx` kiểm thử:
  - Render tin nhắn của User (căn phải, hiển thị đúng text, không render ThinkingBlock).
  - Render tin nhắn của Bot (căn trái, render ModelAvatar, render Markdown, render MessageActions).
  - Khối suy nghĩ `ThinkingBlock` thu gọn / mở rộng đúng trạng thái `aria-expanded`.
  - Khối code `SmartCode` hiển thị đúng ngôn ngữ và thao tác copy clipboard.
- **Lệnh thực thi**:
  - `npm run type-check`: Kiểm tra TypeScript nghiêm ngặt, không lỗi type.
  - `npm run test`: Chạy toàn bộ unit test với Vitest.
  - `npm run verify`: Kiểm tra tổng hợp (Type-check + Lint + Test coverage).

### 7.2 Kiểm Thử Trực Quan (Manual Verification)

- Kiểm tra hiển thị trên 3 nhóm theme đại diện:
  1. Default Dark / Focus (Black/Charcoal)
  2. Glassmorphism (Nền mờ xuyên thấu, kiểm tra độ tương phản chữ)
  3. Retro RA2 (Kiểm tra token viền và màu chủ đạo)
- Kiểm tra chuyển đổi mượt mà khi AI stream văn bản (không layout jump, cursor dính liền chữ).
- Kiểm tra phản hồi bấm nút Send/Stop và thao tác đính kèm tệp trên giao diện.

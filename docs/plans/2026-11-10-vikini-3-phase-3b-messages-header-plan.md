# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 3B: Tin Nhắn Không Bong Bóng, Thanh Thao Tác Gọn, Header Chat

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-10
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: Giai đoạn 1–3A (commit `2d00a3d`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: `docs/specs/2026-11-08-vikini-3-redesign-brief.md` mục "Chat" ("unbubbled AI messages with model avatar + name; 28px rhythm; icon-only action bar with labels/tooltips, delete inside ⋯; solid header; … one-line disclaimer"), canvas board **Chat** (artifact `EX6CrQpyty54jcm8LAeeGN`), audit **H6** và một phần **H5** (UPPERCASE). Giai đoạn 3 chia: 3A (xong) / **3B (plan này)** / 3C composer + sheet tùy chọn mobile (H2) / 3D tên truy cập + test a11y (C3).

1. **Tin nhắn AI không bong bóng**: dòng đầu tin nhắn AI = avatar model + **tên model đã dịch** (dùng `resolveChatModelDisplay` từ 3A, hậu tố "(cũ)/(đã ngừng)"), nội dung ngay dưới, không nền. Tin nhắn người dùng: bong bóng `--raised` + chữ `--text` (thay nền `--accent` chói), căn phải, không avatar "ME".
2. **Nhịp dọc 28px**: khoảng cách giữa hai tin nhắn từ ~120–150px (`py-6` + `gap-3` + action bar) xuống ~28px; mỗi màn hình chứa nhiều lượt hơn.
3. **Thanh thao tác (H6)**: chỉ icon (Sao chép, Tạo lại, Tiếp tục, Đọc to, Rẽ nhánh, Sửa cho tin người dùng) — mỗi nút 32×32, `aria-label` + tooltip; **Xóa** chuyển vào menu "⋯" (mục cuối, màu `--danger`, tách bằng separator). Bỏ chữ UPPERCASE ("COPY", "REGENERATE"). Desktop: hiện khi hover/focus-within tin nhắn, luôn hiện với tin AI cuối; mobile: luôn hiện.
4. **Header chat desktop 60px** (`ChatHeader`): tiêu đề đoạn chat (cắt gọn) + dòng phụ "Dự án · tên" nếu thuộc dự án + menu "⋯" (Đổi tên, Xóa — dùng handler sẵn có). Chỉ hiện khi đang xem một đoạn chat (không ở landing, không ở trang dự án). Nền `--bg` + viền `--line` (C6 cho desktop sau khi 2B ẩn `HeaderBar` desktop).
5. **Disclaimer 1 dòng, chữ thường** (H5): `LandingDisclaimer` và dòng disclaimer trong `ChatControls` bỏ `uppercase tracking-widest font-bold`, cỡ 12px, màu `--faint`.

**Out of Scope (What We're NOT Doing)**:

- Composer: toggle Web/Always search/Thinking có `aria-pressed`, chip GEM/Persona, sheet tùy chọn mobile, vệt accent khi streaming (3C, H2).
- Thời gian trả lời cạnh tên model (canvas "4,2 giây") — dữ liệu chỉ có trong `thinkingStats` của model suy luận, không có cho mọi tin nhắn; để sau khi backend lưu `durationMs`.
- Chia sẻ đoạn chat (canvas có nút "Chia sẻ") — chưa có tính năng chia sẻ.
- Đổi markdown/code block, ThinkingBlock, SourceLinks, TokenBadge (giữ nguyên, chỉ đổi khung).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                                                                                         | Nội dung rút ra                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/03-ui.md`                                                  | Token, `aria-label` cho icon-only, Radix DropdownMenu, chữ ≥ 12px, uppercase chỉ cho nhãn nhóm sidebar                                                                                                                                                      |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                                                                                  | Mục "Chat"                                                                                                                                                                                                                                                  |
| Canvas board Chat                                                                                                                   | Tin AI: avatar + "Gemini 3.8 Flash" + nội dung không nền; tin người dùng bong bóng `--raised`; action bar icon có nhãn "Sao chép / Tạo lại / Đọc to / Rẽ nhánh từ đây / Thêm (xóa, xuất…)"; header 60px "tiêu đề + Dự án · …"; disclaimer chữ thường 1 dòng |
| `src/app/features/chat/components/ChatBubble.tsx`, `MessageActions.tsx`, `ChatApp.tsx`, `LandingDisclaimer.tsx`, `ChatControls.tsx` | Cấu trúc hiện tại (A1–A6)                                                                                                                                                                                                                                   |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                 | Quyết định kỹ thuật chịu ảnh hưởng                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | `ChatBubble`/`MessageActions` có test lớn và được dùng ở luồng chat chính | Giữ nguyên **props** của `MessageActions` và `ChatBubble`; chỉ đổi markup/class; cập nhật test theo Loại C có liệt kê |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn "Thêm thao tác", "Đổi tên", "Dự án"                                  | Tái dùng key có sẵn khi có; key mới thêm vào **cả** `vi.ts`/`en.ts`                                                   |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                       | Bằng chứng                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Mỗi tin nhắn là khối `py-6` + `gap-3`, nội dung `max-w-[95%]` + `gap-4` với avatar; danh sách bọc `space-y-2`                          | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:222`, `src/app/features/chat/components/ChatBubble.tsx:225`, `src/app/features/chat/components/ChatMessagesArea.tsx:198`         |
| A2  | Tin người dùng có nền `--accent` + `shadow-lg`                                                                                         | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:243`                                                                                                                             |
| A3  | Action bar: viên thuốc mờ `opacity-60 md:opacity-0` hiện khi hover; nhiều nút dùng `uppercase tracking-tighter`; nút Xóa nằm giữa nhóm | `[SRC]` `src/app/features/chat/components/MessageActions.tsx:72`, `src/app/features/chat/components/MessageActions.tsx:80`, `src/app/features/chat/components/MessageActions.tsx:162-172` |
| A4  | `ChatBubble` truyền đủ handler vào `MessageActions` (copy, edit, regenerate, continue, delete, speak, branch)                          | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:429-445`                                                                                                                         |
| A5  | Desktop không còn header (2B: `HeaderBar hideOnDesktop`); ChatApp có `selectedConversationId`, `currentConversation`                   | `[SRC]` `src/app/features/chat/components/ChatApp.tsx:268-272`, `src/app/features/chat/components/ChatApp.tsx:76`                                                                         |
| A6  | Disclaimer đang `uppercase tracking-widest font-bold` ở 2 nơi                                                                          | `[SRC]` `src/app/features/chat/components/LandingDisclaimer.tsx:19`, `src/app/features/chat/components/ChatControls.tsx:331`                                                              |
| A7  | Có test co-located cho `ChatBubble` và `MessageActions`                                                                                | `[SRC]` `src/app/features/chat/components/ChatBubble.test.tsx:1`, `src/app/features/chat/components/MessageActions.test.tsx:1`                                                            |

**Cross-Task Dependencies**: dùng `resolveChatModelDisplay` (3A). 3C sẽ đặt composer mới dưới vùng tin nhắn này; header 3B chừa chỗ bên phải cho nút tùy chọn sau này.

**Quyết định sản phẩm (Default Assumption)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Action bar desktop**: _Default_ hiện khi hover/focus; **luôn hiện** cho tin AI cuối cùng (để thấy Tạo lại/Tiếp tục).
- `[NEEDS_PRODUCT_DECISION]` **D2 — Rẽ nhánh**: _Default_ giữ ngoài menu (nút icon) như canvas; chỉ Xóa vào "⋯".

### 4. Bảng Verified Versions

| Thư viện / Công cụ              | `package.json` | Phiên bản | Ghi chú                                                | Nguồn                                                       |
| ------------------------------- | -------------- | --------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `@radix-ui/react-dropdown-menu` | `^2.1.16`      | 2.1.x     | Menu "⋯" của tin nhắn và header                        | `[SRC]` `package.json:44`                                   |
| `@radix-ui/react-tooltip`       | `^1.2.8`       | 1.2.x     | Tooltip nhãn nút icon                                  | `[SRC]` `package.json:51`                                   |
| `framer-motion`                 | có sẵn         | —         | Giữ animation vào của tin nhắn, giảm `y` từ 20 xuống 8 | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:6` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx` — khung tin AI không nền + dòng tên model; tin người dùng bong bóng `--raised`; nhịp dọc; truyền `alwaysShowActions` cho tin AI cuối.
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.test.tsx` — TC-01…TC-03 (Loại C cho các ca khẳng định class cũ `bg-(--accent)` của tin người dùng, liệt kê trong commit).
- `[MODIFY]` `src/app/features/chat/components/BubbleAvatar.tsx` — biến thể nhỏ 24px (`size="sm"`) cho dòng tên model. **(Revision 2)** Giữ nguyên nhánh avatar người dùng của component; chỉ `ChatBubble` ngừng render avatar cho tin người dùng.
- `[MODIFY]` `src/app/features/chat/components/BubbleAvatar.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/MessageActions.tsx` — icon-only + tooltip, menu "⋯" chứa Xóa, prop `alwaysVisible`.
- `[MODIFY]` `src/app/features/chat/components/MessageActions.test.tsx` — TC-04…TC-07.
- `[MODIFY]` `src/app/features/chat/components/ChatMessagesArea.tsx` — bỏ `space-y-2` (nhịp do tin nhắn tự quản).
- `[NEW]` `src/app/features/chat/components/ChatHeader.tsx` — header desktop 60px (§6.3).
- `[NEW]` `src/app/features/chat/components/ChatHeader.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx` — gắn `ChatHeader` khi có đoạn chat đang mở (không landing, không trang dự án).
- `[MODIFY]` `src/app/features/chat/components/LandingDisclaimer.tsx`, `src/app/features/chat/components/ChatControls.tsx` — disclaimer chữ thường 1 dòng (chỉ dòng disclaimer; phần còn lại của `ChatControls` để 3C).
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts` — `messageMoreActions` ("Thêm thao tác"), `chatHeaderMore` ("Tùy chọn đoạn chat"), `chatInProject` ("Dự án") nếu chưa có.
- `[MODIFY]` `.agents/rules/03-ui.md` (quy ước tin nhắn/thao tác) → Critic Pass; `[MODIFY]` `docs/architecture.md`; `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 Tin nhắn**

```tsx
// AI
<article className="group py-3.5" aria-label={`${modelLabel}`}>
  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-(--text)">
    <BubbleAvatar isBot size="sm" … /> <span>{modelLabel}</span>
  </div>
  <div className="text-base leading-relaxed">{/* markdown như cũ */}</div>
  <MessageActions … alwaysVisible={isLastAssistant} />
</article>
// Người dùng
<article className="group py-3.5 flex flex-col items-end">
  <div className="max-w-[85%] rounded-2xl bg-(--raised) px-4 py-2.5 text-(--text)">…</div>
  <MessageActions … />
</article>
```

Nhịp: `py-3.5` (14px trên + 14px dưới = 28px giữa hai tin) — đúng "28px rhythm".

**6.2 `MessageActions`**

```tsx
<div className={cn("flex items-center gap-0.5 mt-1", alwaysVisible ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100")}>
  <IconAction label={copied ? t("copied") : t("copy")} icon={copied ? Check : Copy} onClick={onCopy} />
  {onEdit && <IconAction label={t("edit")} icon={Pencil} … />}
  {onContinue && <IconAction label={t("continue")} icon={Play} … />}
  {canRegenerate && <IconAction label={t("regenerate")} icon={RefreshCw} … />}
  {onSpeak && <IconAction label={…} icon={…} pressed={isSpeaking} … />}
  {onBranch && <IconAction label={t("branchInNewChat")} icon={GitFork} … />}
  {onDelete && messageId && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><IconAction label={t("messageMoreActions")} icon={MoreHorizontal} /></DropdownMenuTrigger>
      <DropdownMenuContent align="start"><DropdownMenuItem className="text-(--danger)" onClick={() => onDelete(messageId)}>{t("delete")}</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  )}
</div>
// IconAction: button 32×32, aria-label, Tooltip side="top", không chữ hiển thị
```

**6.3 `ChatHeader`**

```tsx
<header className="hidden md:flex h-15 shrink-0 items-center justify-between gap-4 border-b border-(--line) bg-(--bg) px-6">
  <div className="min-w-0">
    <h2 className="truncate text-base font-semibold text-(--text)">{title || t("newChat")}</h2>
    {projectName && (
      <p className="truncate text-xs text-(--muted)">
        {t("chatInProject")} · {projectName}
      </p>
    )}
    {/* (Revision 2) ChatApp: projectName = useProjectStore().projects.find(p => p.id === currentConversation?.projectId)?.name */}
  </div>
  <DropdownMenu>… Đổi tên (onRename) · separator · Xóa (onDelete, --danger) …</DropdownMenu>
</header>
```

`h2` vì `h1` ẩn của trang Chat đã có (2A). Không render trên mobile (mobile dùng `HeaderBar`).

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-09 → **đỏ**.
- [ ] **B2 — `MessageActions`** (icon-only, "⋯", `alwaysVisible`).
- [ ] **B3 — `ChatBubble` + `BubbleAvatar` + `ChatMessagesArea`** (khung, nhịp, tên model).
- [ ] **B4 — `ChatHeader` + gắn vào `ChatApp`**.
- [ ] **B5 — Disclaimer**.
- [ ] **B6 — i18n + living docs**.
- [ ] **B7 — Verify** §9 + QA Playwright (đoạn chat mock 1440×900 & 375px).

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                      | Input                                          | Kỳ vọng                                                                                                                   |
| ----- | ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `ChatBubble.test.tsx`     | tin AI có `meta.model = "gemini-2.5-flash"`    | Hiện chữ "Gemini 3.5 Flash-Lite (cũ)" cạnh avatar; khối nội dung **không** có class nền (`bg-(--accent)`/`bg-(--raised)`) |
| TC-02 | `ChatBubble.test.tsx`     | tin người dùng                                 | Bong bóng có `bg-(--raised)` và `text-(--text)`, **không** có `bg-(--accent)`; không có avatar người dùng                 |
| TC-03 | `ChatBubble.test.tsx`     | bất kỳ tin                                     | Phần tử gốc có `py-3.5`, không còn `py-6`                                                                                 |
| TC-04 | `MessageActions.test.tsx` | tin AI đủ handler                              | Mọi nút có `aria-label`; **không** có chữ "COPY"/"REGENERATE" hiển thị; không có class `uppercase`                        |
| TC-05 | `MessageActions.test.tsx` | có `onDelete`                                  | Không có nút "Xóa" ở hàng ngoài; mở "Thêm thao tác" → có mục "Xóa"; chọn → `onDelete(messageId)` 1 lần                    |
| TC-06 | `MessageActions.test.tsx` | không có `onDelete` (Negative)                 | Không render nút "Thêm thao tác"                                                                                          |
| TC-07 | `MessageActions.test.tsx` | `alwaysVisible` true/false                     | true → không có `md:opacity-0`; false → có `md:opacity-0` và `md:group-focus-within:opacity-100`                          |
| TC-08 | `ChatHeader.test.tsx`     | `title`, `projectName`, `onRename`, `onDelete` | Có `h2` với tiêu đề; dòng "Dự án · tên"; menu gọi đúng handler; thiếu `projectName` → không có dòng phụ (Negative)        |
| TC-09 | `ChatHeader.test.tsx`     | `title` rỗng                                   | Hiện "Cuộc trò chuyện mới"; header có class `hidden md:flex`                                                              |

**(Revision 2) Ca test cũ được thay theo Loại C (đích danh)** — mọi ca khác giữ nguyên, không giảm `expect`:

| Ca cũ                                                                 | Vị trí                                                         | Thay bằng                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| "renders delete button and triggers onDelete with messageId"          | `src/app/features/chat/components/MessageActions.test.tsx:179` | TC-05 (Xóa trong menu "⋯", vẫn khẳng định `onDelete(messageId)`)                          |
| "does not render delete button when messageId or onDelete is missing" | `src/app/features/chat/components/MessageActions.test.tsx:198` | TC-06 (không có nút "Thêm thao tác")                                                      |
| "renders container with floating glass dock classes"                  | `src/app/features/chat/components/MessageActions.test.tsx:265` | TC-07 (lớp hiển thị theo `alwaysVisible`)                                                 |
| "renders reverse flex order for user messages"                        | `src/app/features/chat/components/MessageActions.test.tsx:284` | Giữ ý định: tin người dùng căn phải — khẳng định container có `justify-end`               |
| Ca avatar người dùng "ME" trong tin nhắn                              | `src/app/features/chat/components/ChatBubble.test.tsx:61`      | TC-02 (không có avatar người dùng trong `ChatBubble`; test của `BubbleAvatar` giữ nguyên) |
| "applies accent design tokens to user bubble and no dead classes"     | `src/app/features/chat/components/ChatBubble.test.tsx:72-81`   | TC-02 (bong bóng `--raised`/`--text`, vẫn khẳng định không có class chết)                 |

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/chat/components --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

**Wiring Probes**: W1 Grep `uppercase` trong `MessageActions.tsx`, `LandingDisclaimer.tsx` → 0. W2 Grep `bg-(--accent) px-4 py-2.5` trong `ChatBubble.tsx` → 0. W3 QA Playwright với đoạn chat mock: khoảng cách đáy tin này → đỉnh tin sau ≤ 40px; header desktop hiện tiêu đề; mobile không có header 60px; mở "⋯" → có "Xóa".

**Negative Probes**: N1 tạm đưa nút Xóa ra hàng ngoài → TC-05 đỏ. N2 tạm bỏ nhánh `alwaysVisible` → TC-07 đỏ. N3 tạm đổi bong bóng người dùng về `bg-(--accent)` → TC-02 đỏ. Hoàn tác sau mỗi probe.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                         | Mức        | Control                                                                                                  |
| -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Test `ChatBubble`/`MessageActions` hiện có khẳng định class cũ | Trung bình | Cập nhật theo Loại C, liệt kê ca thay đổi; không giảm ca hành vi (copy, edit, regenerate, branch, speak) |
| Người dùng không tìm thấy nút Xóa                              | Thấp       | "⋯" có `aria-label` + tooltip "Thêm thao tác"; QA                                                        |
| Header chiếm chỗ làm cuộn tin nhắn lệch (scroll-to-bottom)     | Trung bình | Header là `shrink-0` ngoài vùng `role="log"`; giữ nguyên hook cuộn; QA tin dài                           |
| Tin AI không nền khó phân biệt với tin người dùng ở theme sáng | Thấp       | Tên model + avatar ở đầu tin; bong bóng người dùng `--raised` khác `--bg` ở cả 10 tổ hợp (đã có ở token) |

### Lộ Trình

| Bước | Nội dung                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 3C   | Composer: toggle `aria-pressed`, chip GEM/Persona/Suy luận, sheet tùy chọn mobile, vệt accent khi streaming (H2) |
| 3D   | `aria-label`/tooltip control icon-only còn thiếu (C3) + test a11y                                                |
| 4    | Ảnh: tabs Tạo ảnh / Thư viện / Mô tả ảnh (M3, M5)                                                                |
| 5    | Novelcrafter theo canvas (H1)                                                                                    |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, gỡ alias token                             |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây")]

#### 1. Output verify-plan.mjs

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-10-vikini-3-phase-3b-messages-header-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED yes`, `VERIFY_PLAN: PASS`.
- Đối chiếu source: A1–A7 khớp.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                        | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                            | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                          |
| --- | -------------- | ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/chat/components/MessageActions.test.tsx:179-198` | [SRC] Ca "renders delete button and triggers onDelete" và "floating glass dock classes" (`src/app/features/chat/components/MessageActions.test.tsx:265`), "reverse flex order" (`:284`); `ChatBubble.test.tsx` có ca avatar "ME" (`src/app/features/chat/components/ChatBubble.test.tsx:61`) và token bong bóng accent (`src/app/features/chat/components/ChatBubble.test.tsx:72-81`) | §8 chỉ nói chung "Loại C cho class cũ" — chưa **liệt kê đích danh** các ca test sẽ bị thay; theo chuẩn các plan trước, mọi ca bị thay phải được liệt kê để reviewer kiểm "không giảm expect ngoài danh sách". **Sửa**: thêm danh sách Loại C cụ thể + ca thay thế tương ứng. |
| 2   | DEFECT         | [MINOR] | `src/app/features/chat/components/BubbleAvatar.tsx:142`            | [SRC] `BubbleAvatar` có nhánh người dùng ("ME") và test riêng (`src/app/features/chat/components/BubbleAvatar.test.tsx:22`)                                                                                                                                                                                                                                                           | §5 ghi "bỏ avatar người dùng" trong `BubbleAvatar` — không cần sửa component; chỉ `ChatBubble` ngừng render avatar cho tin người dùng. Giữ nhánh để không vỡ test và caller khác.                                                                                            |
| 3   | DEFECT         | [MINOR] | `src/app/features/chat/hooks/useConversation.ts:88`                | [SRC] Hội thoại có `projectId`; tên dự án nằm ở `useProjectStore`                                                                                                                                                                                                                                                                                                                     | §6.3 chưa nói lấy `projectName` từ đâu. Ghi rõ: `projects.find(p => p.id === currentConversation?.projectId)?.name` trong `ChatApp`.                                                                                                                                         |
| 4   | RISK_DISMISSED | —       | `src/app/features/chat/components/ChatApp.tsx:76`                  | [SRC] `currentConversation` đã có sẵn trong `ChatApp`                                                                                                                                                                                                                                                                                                                                 | Header lấy tiêu đề từ đây, không cần fetch thêm.                                                                                                                                                                                                                             |

#### Kết Luận

1 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định); Critic Pass miễn theo cách PM đã chọn ở các plan trước — PM có thể yêu cầu chạy]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-10-vikini-3-phase-3b-messages-header-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §8 có bảng 6 ca Loại C đích danh, mỗi ca có ca thay thế giữ ý định.
- Audit Run 1 #2 `[MINOR]` → **đã xử lý**: giữ nhánh người dùng của `BubbleAvatar`.
- Audit Run 1 #3 `[MINOR]` → **đã xử lý**: nguồn `projectName` ghi rõ trong §6.3.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                    | Bằng chứng                                                                               | Lý do / Hướng xử lý khi code                                                                                                                                                                    |
| --- | -------------- | ------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/app/features/chat/components/MessageActions.test.tsx:284` | [SRC] Ca "reverse flex order" khẳng định thứ tự nút cho tin người dùng                   | Thay bằng khẳng định căn phải (`justify-end`) giữ đúng ý định "thanh thao tác bám phía tin người dùng".                                                                                         |
| 2   | DEFECT         | [MINOR] | `src/app/features/chat/components/ChatBubble.tsx:243`          | [SRC] Chế độ sửa tin người dùng dùng `min-w-[60vw] md:min-w-[600px]` bên trong bong bóng | Khi đổi bong bóng sang `max-w-[85%]`, khung sửa vẫn phải rộng đủ; giữ lớp min-width của nhánh sửa, QA mở chế độ sửa ở 375px.                                                                    |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/chat/components/ChatMessagesArea.tsx:198`    | [SRC] Danh sách bọc `space-y-2`                                                          | Bỏ `space-y-2` để nhịp 28px do `py-3.5` của tin quản; kiểm thêm khối "mb-4" của thông báo ngữ cảnh phía trên (`src/app/features/chat/components/ChatMessagesArea.tsx:201`) vẫn cách đều khi QA. |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-06, TC-08) và Negative Probe N1–N3; ca Loại C liệt kê đích danh. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

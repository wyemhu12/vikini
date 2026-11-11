# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 6A: Gems & Personas — Lưới Card, Một Nút Chính + Menu "⋯" (H3)

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: claude-fable-5-2]`)
- **Depends on**: Giai đoạn 5A (commit `4d796e8`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: audit **H3** ("card hẹp, tên bị cắt 'Writ…', 4 nút xếp dọc, 'Delete Gem' xuống 2 dòng, nút xóa ngay dưới Edit; mobile: danh sách nằm trong vùng cuộn lồng nhau, card cuối bị cắt; dòng phụ 'Global Mode' không giải thích"; sửa: lưới `auto-fill minmax(280px,1fr)`, mỗi card một nút chính "Dùng Gem", Preview/Edit/Delete vào menu "⋯", Delete tách riêng ở cuối và tô đỏ) và brief ("Gems/Personas lưới card").

1. **`LibraryCard` dùng chung** cho Gem và Persona: ô icon, tên **không cắt một dòng** (tối đa 2 dòng), nhãn phụ (hệ thống / giọng điệu), mô tả tối đa 3 dòng, **một nút chính** ("Dùng Gem" / "Dùng Persona", `aria-pressed` khi đang dùng) và menu **"⋯"**: Xem trước, Sửa, rồi phân cách và **Xóa** (màu `--danger`). Mục hệ thống chỉ có Xem trước. **(Revision 2)** Khi trang **không** gắn với đoạn chat nào (`canApply = false`): nút chính là **"Xem trước"** (không `aria-pressed`), menu bỏ mục Xem trước trùng, và trang có dòng hướng dẫn "Mở từ một đoạn chat để dùng cho đoạn chat đó."
2. **Lưới** `repeat(auto-fill, minmax(280px, 1fr))`; tiêu đề nhóm chữ thường (`h3`).
3. **Bỏ vùng cuộn lồng nhau** (`max-h-[60vh] overflow-y-auto`) trong `GemManager`/`PersonaManager` — trang chỉ còn một vùng cuộn.
4. **Dọn chữ và màu trong 2 manager**: "Global Mode" → câu mô tả có nghĩa; hộp xanh "GEM vs Persona" tiếng Anh gộp vào mô tả trang (dịch); "Reset Default" → "Gỡ Gem"/"Gỡ Persona" và chỉ hiện khi đang ở trong một đoạn chat; "Failed to load / Retry", "Editor" → bản dịch; màu `red-500`/`blue-500` thô → token.

**Out of Scope (What We're NOT Doing)**:

- Bố cục editor/preview (cột phải), form `GemEditor`/`PersonaEditor`, `GemPreview`/`PersonaPreview`.
- Hợp nhất trang Gems và Personas thành một trang có tab (canvas chỉ có một mục "Gems và Persona" trên thanh icon) — cần quyết định điều hướng riêng.
- Logic áp dụng/xóa/lưu, API.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                            | Nội dung rút ra                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Audit UX mục H3; brief mục lộ trình ("Gems/Personas lưới card")                                                                                | Các lỗi và hướng sửa ở §1                         |
| `src/app/features/gems/components/GemList.tsx`, `GemManager.tsx`; `src/app/features/personas/components/PersonaList.tsx`, `PersonaManager.tsx` | A1–A6                                             |
| `src/app/features/chat/components/MessageActions.tsx` (3B)                                                                                     | Mẫu menu "⋯" với mục Xóa `--danger` sau separator |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                        | Lý do nạp                         | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                           |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md` | Nhãn nút, mô tả trang, chuỗi cứng | Key mới ở **cả** `vi.ts`/`en.ts`; tái dùng `preview`, `editGem`, `deleteGem`, `personaEdit`, `personaDelete`, `gemRemove`, `personaRemove`, `tryAgain`, `messageMoreActions` |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                              | Bằng chứng                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Card Gem: tên `truncate`, 4 nút xếp dọc (Chọn, Xem trước, Sửa, Xóa), lưới `minmax(250px,1fr)`                                 | `[SRC]` `src/app/features/gems/components/GemList.tsx:47-108`, `src/app/features/gems/components/GemList.tsx:121`                                                                                                                              |
| A2  | Card Persona: nhãn `text-[10px]`, badge "Premade" tím chữ cứng, nút chỉ còn icon dưới `sm`, tiêu đề nhóm `uppercase`          | `[SRC]` `src/app/features/personas/components/PersonaList.tsx:63-69`, `src/app/features/personas/components/PersonaList.tsx:76-117`, `src/app/features/personas/components/PersonaList.tsx:156`                                                |
| A3  | Danh sách nằm trong khung `max-h-[60vh] overflow-y-auto` bên trong vùng cuộn của trang                                        | `[SRC]` `src/app/features/gems/components/GemManager.tsx:229-230`, `src/app/features/gems/components/GemManager.tsx:250`, `src/app/features/personas/components/PersonaManager.tsx:268`                                                        |
| A4  | Chuỗi cứng: "Global Mode", "Reset Default", "Failed to load", "Retry", "GEM vs Persona…", "Editor"; màu `red-500`, `blue-500` | `[SRC]` `src/app/features/gems/components/GemManager.tsx:186`, `src/app/features/gems/components/GemManager.tsx:259-281`, `src/app/features/gems/components/GemManager.tsx:306`, `src/app/features/personas/components/PersonaManager.tsx:215` |
| A5  | "Reset Default" gọi `applyGemToConversation(null)` — tức gỡ Gem khỏi đoạn chat                                                | `[SRC]` `src/app/features/gems/components/GemManager.tsx:109`                                                                                                                                                                                  |
| A6  | `GemList`/`PersonaList` chỉ được 2 manager dùng; chưa có test cho 2 list và 2 manager                                         | `[SRC]` `src/app/features/gems/components/GemManager.tsx:283`, `src/app/features/personas/components/PersonaManager.tsx:301`                                                                                                                   |

**Quyết định sản phẩm (đã chọn mặc định, ghi lại)**:

- **D1** Nhãn nút chính: "Dùng Gem" / "Dùng Persona" (audit); khi đang dùng: "Đang dùng" + `aria-pressed="true"`.
- **D2** Mô tả trang thay "Global Mode": Gems — "Gem định nghĩa việc AI làm: vai trò và nhiệm vụ."; Personas — "Persona định nghĩa cách AI trò chuyện: giọng điệu và định dạng." (thay luôn hộp "GEM vs Persona").
- **D3** Nút gỡ chỉ hiện khi trang đang gắn với một đoạn chat (`conversationId`), vì ngoài ngữ cảnh đó nó không có tác dụng rõ ràng.

### 4. Bảng Verified Versions

| Thư viện / Công cụ              | `package.json` | Phiên bản | Ghi chú           | Nguồn                     |
| ------------------------------- | -------------- | --------- | ----------------- | ------------------------- |
| `@radix-ui/react-dropdown-menu` | `^2.1.16`      | 2.1.x     | Menu "⋯" của card | `[SRC]` `package.json:44` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/components/ui/library-card.tsx` — primitive card (§6.1), không chứa logic nghiệp vụ.
- `[NEW]` `src/components/ui/library-card.test.tsx` — TC-01…TC-03.
- `[MODIFY]` `src/app/features/gems/components/GemList.tsx`; `[NEW]` `GemList.test.tsx` — TC-04, TC-05.
- `[MODIFY]` `src/app/features/personas/components/PersonaList.tsx`; `[NEW]` `PersonaList.test.tsx` — TC-06, TC-07.
- `[MODIFY]` `src/app/features/gems/components/GemManager.tsx`, `src/app/features/personas/components/PersonaManager.tsx` — mục 3–4 của §1; **(Revision 2)** truyền `canApply={Boolean(conversationId)}` cho list, thay chuỗi "Error: No conversation ID" bằng key `libraryOpenFromChat`.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — `gemUse` ("Dùng Gem" / "Use Gem"), `personaUse` ("Dùng Persona" / "Use Persona"), `libraryInUse` ("Đang dùng" / "In use"), `libraryBuiltIn` ("Có sẵn" / "Built-in"), `gemsPageDescription`, `personasPageDescription` (D2), `libraryLoadFailed` ("Không tải được danh sách" / "Couldn't load the list"), **(Revision 2)** `libraryOpenFromChat` ("Mở từ một đoạn chat để dùng cho đoạn chat đó." / "Open this from a chat to use it in that chat.").
- `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 `LibraryCard`**

```tsx
<LibraryCard
  icon={<DynamicIcon name={g.icon} fallback="◆" className="h-5 w-5" />}
  title={g.name}
  badges={g.isPremade ? [t("libraryBuiltIn")] : []}
  description={g.description}
  selected={selectedGemId === g.id}
  primaryLabel={selectedGemId === g.id ? t("libraryInUse") : t("gemUse")}
  onPrimary={() => onSelect(g)}
  menuLabel={`${t("messageMoreActions")}: ${g.name}`}
  menuItems={[
    { label: t("preview"), onSelect: () => onPreview(g) },
    ...(g.isPremade
      ? []
      : [
          { label: t("editGem"), onSelect: () => onEdit(g) },
          { label: t("deleteGem"), onSelect: () => onDelete(g), danger: true },
        ]),
  ]}
/>
```

```tsx
<article className={cn("flex flex-col gap-3 rounded-2xl border bg-(--surface) p-4", selected ? "border-(--accent)" : "border-(--line)")}>
  <div className="flex items-start gap-3">
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--raised) text-(--accent)">{icon}</span>
    <div className="min-w-0 flex-1">
      <h4 className="line-clamp-2 text-[15px] font-semibold text-(--text)" title={title}>{title}</h4>
      {badges.map(…<span className="text-xs text-(--muted) bg-(--raised) rounded-md px-1.5 py-0.5">)}
    </div>
    {menuItems.length > 0 && <DropdownMenu>… trigger aria-label={menuLabel} … danger items sau <DropdownMenuSeparator /></DropdownMenu>}
  </div>
  {description && <p className="line-clamp-3 text-sm text-(--muted)">{description}</p>}
  <button type="button" aria-pressed={selected} onClick={onPrimary} className={cn("mt-auto h-9 rounded-lg text-sm font-semibold …", selected ? "border border-(--accent) bg-(--soft) text-(--accent)" : "bg-(--accent) text-(--on-accent)")}>{primaryLabel}</button>
</article>
```

Mục `danger` luôn được xếp sau các mục thường và sau một separator, bất kể thứ tự truyền vào.

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-08 → **đỏ**.
- [ ] **B2 — `LibraryCard`** + i18n.
- [ ] **B3 — `GemList`, `PersonaList`**.
- [ ] **B4 — `GemManager`, `PersonaManager`**.
- [ ] **B5 — Verify** §9, e2e a11y, QA Playwright `/gems` + `/features/personas` ở 1440 và 375.
- [ ] **B6 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                                       | Input                                                     | Kỳ vọng                                                                                                                                     |
| ----- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `library-card.test.tsx`                    | `selected` false / true                                   | Nút chính có `aria-pressed` tương ứng, bấm → `onPrimary` 1 lần; `selected` → card có `border-(--accent)`; tiêu đề không có class `truncate` |
| TC-02 | `library-card.test.tsx`                    | 3 mục menu, mục danger truyền **ở giữa**                  | Mở menu: mục danger đứng **cuối**, sau một `separator`, có class `text-(--danger)`; chọn → handler tương ứng 1 lần                          |
| TC-03 | `library-card.test.tsx`                    | `menuItems = []` (Negative)                               | Không render nút menu                                                                                                                       |
| TC-04 | `GemList.test.tsx`                         | 1 Gem hệ thống + 1 Gem của tôi, `selectedGemId` = của tôi | Mỗi card đúng **1** nút chính; card đang dùng ghi "Đang dùng"; lưới có `minmax(280px,1fr)`; không còn nút "Sửa/Xóa" nằm ngoài menu          |
| TC-05 | `GemList.test.tsx`                         | mở menu của Gem hệ thống / Gem của tôi                    | Hệ thống: chỉ "Xem trước" (Negative: không có Sửa/Xóa); của tôi: Xem trước, Sửa, Xóa → `onDelete(gem)`                                      |
| TC-08 | `GemList.test.tsx`, `PersonaList.test.tsx` | **(Revision 2)** `canApply = false`                       | Nút chính ghi "Xem trước" và gọi `onPreview`, **không** gọi `onSelect`, không có `aria-pressed`; menu của mục hệ thống không render (rỗng)  |
| TC-06 | `PersonaList.test.tsx`                     | 1 có sẵn + 1 của tôi                                      | Nhãn "Có sẵn" (không còn "Premade"); không class `purple`/`text-[10px]`/`uppercase`; nút chính có chữ (không chỉ icon)                      |
| TC-07 | `PersonaList.test.tsx`                     | mở menu Persona của tôi → Xóa; danh sách rỗng (Negative)  | `onDelete(persona)` 1 lần; rỗng → hiện `personaNoPersonas`, không có card                                                                   |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có** (A6: chưa có test cho các file bị sửa; `GemModal.test.tsx`/`PersonaModal.test.tsx` mock manager). Nếu ca cũ nào đỏ, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/components/ui src/app/features/gems src/app/features/personas --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**: W1 Grep `max-h-\[60vh\]` trong 2 manager → 0. W2 Grep `Global Mode|Reset Default|GEM vs Persona|>Editor<|Retry$` trong 2 manager → 0. W3 Grep `blue-500|red-500|purple` trong 2 manager + 2 list → 0. W4 QA 1440 `/gems`: số cột ≥ 3, mỗi card 1 nút chính; QA 375: `document` chỉ có một vùng cuộn dọc chứa danh sách (card cuối cuộn tới được), không tràn ngang.

**Negative Probes** (hoàn tác sau mỗi probe): N1 bỏ sắp xếp mục danger xuống cuối → TC-02 đỏ. N2 cho Gem hệ thống có mục Sửa → TC-05 đỏ. N3 bỏ `aria-pressed` → TC-01 đỏ. N4 **(Revision 2)** bỏ nhánh `canApply` (luôn gọi `onSelect`) → TC-08 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                  | Mức        | Control                                                                              |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Bỏ khung cuộn lồng làm layout 2 cột (danh sách + editor) lệch chiều cao | Trung bình | Cột editor `lg:sticky lg:top-0 self-start`; QA mở editor ở 1440 và 375               |
| Trong modal (`inModal`) danh sách dài                                   | Thấp       | Vùng cuộn ngoài của manager vẫn là `flex-1 overflow-y-auto`; QA mở Gem modal từ chat |
| Người dùng không thấy Sửa/Xóa                                           | Thấp       | Nút "⋯" có `aria-label` + `title`; mẫu giống menu tin nhắn (3B)                      |

### Lộ Trình

| Bước | Nội dung                                                             |
| ---- | -------------------------------------------------------------------- |
| 6A   | **Plan này** — Gems/Personas lưới card (H3)                          |
| 6B   | Sign-in (H7)                                                         |
| 6C   | Thẻ ảnh Gallery dùng được bằng bàn phím; lint chặn màu thô / chữ nhỏ |

### 11. Ghi Chú Triển Khai

- Khi `canApply = false`, nút "Xem trước" dùng kiểu viền (không accent) — QA cho thấy hàng loạt nút accent "Xem trước" quá nặng; `LibraryCard` suy ra từ `selected === undefined`.
- Cấp heading: tiêu đề nhóm là `h2`, tên card là `h3` (plan ghi `h3`/`h4`) để không nhảy cấp dưới `h1` của trang.
- Kiểm tra: `tsc`, `lint` sạch; vitest 1954/1956 (2 lỗi governance có từ trước); N1–N4 đều làm test đỏ; e2e a11y 15/15; QA `/gems` và `/features/personas`: 3 cột ở 1440, một vùng cuộn và không tràn ngang ở 375, card cuối cuộn tới được.
- Chưa QA trong modal Gem/Persona mở từ chat (mock chưa có đoạn chat đang mở modal); rủi ro thấp vì modal dùng chung component.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-fable-5-2 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6a-gems-personas-cards-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A6 khớp source. Đọc thêm `applyGemToConversation`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                             | Bằng chứng                                                                                                            | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/gems/components/GemManager.tsx:64-68` | [SRC] Không có `conversationId` thì `applyGemToConversation` chỉ đặt trạng thái "Error: No conversation ID" rồi thoát | Trên trang `/gems` mở từ thanh icon (không có đoạn chat), nút chính "Dùng Gem" của **mọi** card sẽ báo lỗi tiếng Anh — hành động chính không dùng được. **Sửa**: thêm `canApply`; khi `false` nút chính là "Xem trước", có dòng hướng dẫn đã dịch, thêm ca test. |
| 2   | DEFECT         | [MINOR] | `src/app/features/gems/components/GemManager.tsx:53`    | [SRC] Thông báo lỗi tải dự phòng "Failed to load gems" (tiếng Anh)                                                    | Hộp lỗi hiển thị `libraryLoadFailed` (đã dịch) + chi tiết lỗi; giữ `message` gốc cho log.                                                                                                                                                                        |
| 3   | RISK_DISMISSED | —       | `src/app/features/gems/components/GemModal.test.tsx:14` | [SRC] Test modal mock `GemManager`                                                                                    | Đổi nội bộ manager không ảnh hưởng test modal; không có Loại C.                                                                                                                                                                                                  |

#### Kết Luận

1 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-fable-5-2 (in-session); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6a-gems-personas-cards-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §1.1 định nghĩa hành vi `canApply = false`, §5 thêm prop + key `libraryOpenFromChat`, TC-08, Negative Probe N4.
- Audit Run 1 #2 `[MINOR]` → xử lý khi code (hộp lỗi dùng `libraryLoadFailed`).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng                                                              | Lý do / Hướng xử lý khi code                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MINOR] | `src/app/features/personas/components/PersonaList.tsx:18-27` | [SRC] `TONE_BADGES` là bảng nhãn giọng điệu tiếng Anh cứng              | Giữ làm nhãn phụ (tên giọng điệu là thuật ngữ), chỉ đổi cỡ chữ/token; dịch đầy đủ để đợt i18n riêng.         |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/gems/components/GemManager.tsx:109`        | [SRC] Nút gỡ gọi `applyGemToConversation(null)`                         | Theo D3 chỉ hiện khi có `conversationId`; không còn đường nào dẫn tới lỗi "No conversation ID" từ giao diện. |
| 3   | RISK_DISMISSED | —       | `src/app/features/gems/components/GemList.tsx:121`           | [SRC] Lưới hiện `minmax(250px,1fr)` nằm trong khung 360px khi mở editor | Khi mở editor cột danh sách hẹp → lưới tự về 1 cột (auto-fill), không tràn.                                  |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-03, TC-05, TC-07, TC-08) và Negative Probe N1–N4; không có ca test cũ bị thay. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

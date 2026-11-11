# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 6B: Trang Đăng Nhập & Lỗi Đăng Nhập Theo Theme (H7, C4)

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: claude-fable-5-2]`)
- **Depends on**: Giai đoạn 6A (commit `c697bbc`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: audit **H7** ("Huy hiệu 'Encrypted end-to-end' không đúng với kiến trúc: server giữ `DATA_ENCRYPTION_KEY` và tự giải mã — đây là mã hóa khi lưu trữ … Màu vàng gold ở Sign-in khác hẳn màu trong app"; sửa: "Mã hóa dữ liệu khi lưu trữ", dùng theme mặc định/đã chọn) và **C4** ("'AUTHORIZED ACCESS' và 'ENCRYPTED END-TO-END' chữ 10px xám trên nền đen, gần như không đọc được").

1. **Sửa tuyên bố sai**: huy hiệu "MÃ HÓA ĐẦU-CUỐI" → **"Mã hóa dữ liệu khi lưu trữ"** / "Data encrypted at rest"; xóa key `encryptedE2E` để không bị dùng lại.
2. **Theo theme của app**: bỏ nền đen cứng `#0a0a0a`/`#020617`, vàng gold, đỏ thô, `text-white/NN`; dùng `--bg`, `--surface`, `--line`, `--text`, `--muted`, `--faint`, `--accent`, `--glow`, `--danger`. Người dùng thấy đúng theme họ đã chọn (mặc định Hoàng hôn).
3. **Chữ đọc được (C4)**: bỏ chữ 10px, `uppercase` + giãn chữ 0.3–0.6em, độ mờ 20–30%; mọi chữ ≥ 12px với token đạt tương phản. Giá trị dịch in hoa ("ĐĂNG NHẬP VỚI GOOGLE", "TRUY CẬP ĐƯỢC CẤP PHÉP") chuyển chữ thường.
4. **`AuthShell` dùng chung** cho `/auth/signin` và `/auth/error`: nền + quầng sáng `--glow`, nút chuyển ngôn ngữ có `aria-pressed` và nhãn nhóm, vùng nội dung `main`.
5. A11y: nút có `type="button"`, logo Google `aria-hidden`, trang lỗi dùng `role="alert"` cho thông báo.

**Out of Scope (What We're NOT Doing)**:

- Luồng đăng nhập (`actions.ts`, NextAuth, whitelist) — không đổi.
- Câu khẩu hiệu `signinTagline` ("Ít kiểm duyệt hơn. AI được mã hóa.") — là định vị sản phẩm; audit chỉ nêu huy hiệu. **Lưu ý cho PM**: vế "AI được mã hóa" cũng mơ hồ, nên cân nhắc sửa.
- Đưa chuỗi song ngữ viết thẳng trong trang lỗi vào file dịch (giữ nguyên nội dung, chỉ đổi kiểu chữ tiêu đề sang chữ thường).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                           | Nội dung rút ra                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Audit UX mục H7, C4                                           | Lỗi và hướng sửa ở §1                                       |
| `src/app/auth/signin/page.tsx`, `src/app/auth/error/page.tsx` | A1–A4                                                       |
| `src/app/features/layout/providers.tsx`                       | `ThemeProvider` bọc toàn app nên token có ở trang đăng nhập |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                        | Lý do nạp                  | Quyết định kỹ thuật chịu ảnh hưởng                                         |
| ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md` | Đổi/xóa/thêm key đăng nhập | Sửa **cả** `vi.ts`/`en.ts`; xóa `encryptedE2E` ở cả hai để giữ parity kiểu |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                    | Bằng chứng                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Sign-in: nền `#0a0a0a`, quầng vàng `rgba(212,175,55,…)`, chữ gradient vàng bằng `styled-jsx`                                                                                        | `[SRC]` `src/app/auth/signin/page.tsx:21-33`, `src/app/auth/signin/page.tsx:128-150`                                           |
| A2  | Nút ngôn ngữ `text-[10px]`, không `aria-pressed`; dòng `authorizedAccess` `uppercase tracking-[0.6em] text-white/30`; huy hiệu `encryptedE2E` `text-[10px] text-white/20 uppercase` | `[SRC]` `src/app/auth/signin/page.tsx:36-53`, `src/app/auth/signin/page.tsx:81-83`, `src/app/auth/signin/page.tsx:122-125`     |
| A3  | `encryptedE2E` và `authorizedAccess` chỉ được trang sign-in dùng                                                                                                                    | `[CMD]` grep trong `src` (ngoài `translations/`) → chỉ `src/app/auth/signin/page.tsx:82` và `src/app/auth/signin/page.tsx:124` |
| A4  | Trang lỗi: nền `#020617`, gradient đỏ `#ef4444…` bằng `styled-jsx`, cùng nút ngôn ngữ 10px, chữ `text-white/40..80`                                                                 | `[SRC]` `src/app/auth/error/page.tsx:20-27`, `src/app/auth/error/page.tsx:33-48`                                               |
| A5  | Giá trị dịch đang in hoa: `authorizedAccess`, `signInWithGoogle`, `encryptedE2E`                                                                                                    | `[SRC]` `src/lib/utils/translations/vi.ts:16-19`, `src/lib/utils/translations/en.ts:16-19`                                     |

**Quyết định sản phẩm (đã chọn mặc định, ghi lại)**:

- **D1** `authorizedAccess` → "Chỉ dành cho tài khoản được cấp phép" / "For authorized accounts only" (chữ thường, cùng ý).
- **D2** Nút Google: nền `--surface`, viền `--line`, chữ `--text` (logo Google giữ màu thương hiệu).
- **D3** Dấu thương hiệu: chữ "v" serif nghiêng trên ô `--text`/`--bg` như thanh icon của app (thay chữ "V" gradient vàng).

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                              | Nguồn                     |
| ------------------ | -------------- | --------- | ------------------------------------ | ------------------------- |
| `next`             | `^16.4.0`      | 16.4      | Trang client, không đổi routing/auth | `[SRC]` `package.json:64` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/app/features/layout/components/AuthShell.tsx` — khung chung (§6.1).
- `[NEW]` `src/app/features/layout/components/AuthShell.test.tsx` — TC-01, TC-02.
- `[MODIFY]` `src/app/auth/signin/page.tsx`; `[NEW]` `src/app/auth/signin/page.test.tsx` — TC-03, TC-04.
- `[MODIFY]` `src/app/auth/error/page.tsx`; `[NEW]` `src/app/auth/error/page.test.tsx` — TC-05, TC-06.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — đổi `authorizedAccess`, `signInWithGoogle`; xóa `encryptedE2E`; thêm `encryptedAtRest` ("Mã hóa dữ liệu khi lưu trữ" / "Data encrypted at rest"), `languageSwitcherLabel` ("Ngôn ngữ" / "Language").
- `[MODIFY]` `docs/CHANGELOG.md`.

Chỉ đổi giao diện trang trong `src/app/auth/**`; **không** chạm `actions.ts`, `*.server.ts`, proxy/middleware. Nếu `verify-plan` báo `CRITIC_REQUIRED yes` vì đường dẫn `auth`, Critic Pass được miễn theo ủy quyền của PM (ghi ở Audit).

### 6. Caller-First Design Sketch

**6.1 `AuthShell`**

```tsx
<AuthShell>{/* nội dung trang */}</AuthShell>;

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-(--bg) text-(--text)">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_60%_100%_at_50%_120%,var(--glow),transparent_70%)]"
      />
      <div
        role="group"
        aria-label={t("languageSwitcherLabel")}
        className="absolute right-4 top-4 flex rounded-full border border-(--line) bg-(--surface) p-1"
      >
        {(["vi", "en"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            aria-pressed={language === lang}
            onClick={() => setLanguage(lang)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-semibold …",
              language === lang ? "bg-(--text) text-(--bg)" : "text-(--muted) hover:text-(--text)"
            )}
          >
            {lang === "vi" ? "Tiếng Việt" : "English"}
          </button>
        ))}
      </div>
      <main className="relative z-10 w-full max-w-md space-y-8 px-6 text-center">{children}</main>
    </div>
  );
}
```

**6.2 Sign-in**

```tsx
<AuthShell>
  <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-(--text) font-serif text-4xl italic text-(--bg)">v</div>
  <h1 className="text-4xl font-semibold tracking-tight">{t("appName")}</h1>
  <p className="text-sm text-(--muted)">{t("authorizedAccess")}</p>
  <div className="rounded-3xl border border-(--line) bg-(--surface) p-8">
    <p className="mb-6 text-base text-(--muted)">{t("signinTagline")}</p>
    <button type="button" onClick={() => handleGoogleSignIn()} className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-(--line) bg-(--bg) text-sm font-semibold text-(--text) hover:bg-(--raised) …">
      <svg aria-hidden="true" …/> {t("signInWithGoogle")}
    </button>
  </div>
  <p className="text-xs text-(--faint)">{t("encryptedAtRest")}</p>
</AuthShell>
```

Giữ cổng `mounted` (tránh lệch hydrate do ngôn ngữ lưu ở client); placeholder dùng `bg-(--bg)`. Không có hook nào đứng sau lệnh `return` sớm.

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-06 → **đỏ**.
- [ ] **B2 — `AuthShell`** + i18n.
- [ ] **B3 — Sign-in, trang lỗi**.
- [ ] **B4 — Verify** §9 + QA Playwright `/auth/signin`, `/auth/error?error=blocked` (1440 + 375, Hoàng hôn tối + Mực sáng).
- [ ] **B5 — CHANGELOG**, commit, push, fast-forward `main`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                   | Input                               | Kỳ vọng                                                                                                                                                               |
| ----- | ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `AuthShell.test.tsx`   | ngôn ngữ `vi`                       | Nhóm có tên "Ngôn ngữ"; nút "Tiếng Việt" `aria-pressed="true"`, "English" `"false"`; bấm "English" → `setLanguage("en")`; có `main` chứa children                     |
| TC-02 | `AuthShell.test.tsx`   | render                              | Không class nào chứa `#`-hex, `text-white`, `bg-white`, `text-[10px]`, `uppercase`                                                                                    |
| TC-03 | `signin/page.test.tsx` | render (sau mount)                  | Có chữ `encryptedAtRest`; **không** gọi `t("encryptedE2E")` (Negative); một `h1`; bấm nút Google → `handleGoogleSignIn` 1 lần                                         |
| TC-04 | `signin/page.test.tsx` | render                              | Không class thô như TC-02; không còn thẻ `<style>` của styled-jsx                                                                                                     |
| TC-05 | `error/page.test.tsx`  | `?error=blocked` / không có tham số | Tiêu đề tương ứng ("Tài khoản đã bị khóa" / "Truy cập bị từ chối"); thông báo nằm trong `role="alert"`; bấm nút quay lại → `signOut({ callbackUrl: "/auth/signin" })` |
| TC-06 | `error/page.test.tsx`  | render                              | Không class thô như TC-02 (cho phép token `--danger`)                                                                                                                 |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có** (chưa có test cho 2 trang). Nếu test i18n parity nào đỏ vì xóa key, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/auth src/app/features/layout --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
```

**Wiring Probes**: W1 Grep `encryptedE2E` trong `src` → 0. W2 Grep `#0a0a0a|#020617|#d4af37|text-white|text-\[10px\]|uppercase|style jsx` trong `src/app/auth` → 0. W3 QA: ở theme Mực sáng nền trang sáng (`--bg`), chữ đạt tương phản (đo `getComputedStyle` màu chữ huy hiệu khác nền, cỡ ≥ 12px).

**Negative Probes** (hoàn tác sau mỗi probe): N1 trả `t("encryptedE2E")` vào trang → TC-03 đỏ (và `tsc` báo key không tồn tại). N2 bỏ `aria-pressed` trong `AuthShell` → TC-01 đỏ. N3 bỏ `role="alert"` → TC-05 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                | Mức        | Control                                                                                      |
| --------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Token chưa có ở trang đăng nhập (theme class chưa gắn khi chưa mount) | Trung bình | `ThemeProvider` gắn class trước khi paint; trang đã có cổng `mounted`; QA đo màu nền thực tế |
| Xóa key dịch làm vỡ chỗ khác                                          | Thấp       | A3 (grep) + `tsc` (kiểu key)                                                                 |
| Trang lỗi mất cảm giác "cảnh báo" khi bỏ nền đỏ chuyển động           | Thấp       | Giữ icon + khung `--danger`; nền theo theme                                                  |

### Lộ Trình

| Bước | Nội dung                                                               |
| ---- | ---------------------------------------------------------------------- |
| 6B   | **Plan này** — Sign-in & lỗi đăng nhập theo theme, sửa tuyên bố mã hóa |
| 6C   | Thẻ ảnh Gallery dùng được bằng bàn phím; lint chặn màu thô / chữ nhỏ   |

### 11. Ghi Chú Triển Khai

- Test viết trước code, **không chạy bước "đỏ" riêng**; N1–N3 đều làm test đỏ.
- Trang lỗi: đổi thêm câu "whitelist" thành "danh sách được cấp phép" / "allowlist" (dễ hiểu hơn), icon SVG tay → Lucide `Lock` / `TriangleAlert`.
- Kiểm tra: `tsc`, `lint` sạch; vitest 1961/1963 (2 lỗi governance có từ trước); QA `/auth/signin` ở Hoàng hôn tối (nền `rgb(12,10,9)`, huy hiệu 12px `rgb(143,130,120)`) và Mực sáng (nền `rgb(246,245,241)`); không còn chữ "end-to-end"; 375px nút ngôn ngữ không chồng tiêu đề, không tràn ngang; `/auth/error?error=blocked` hiện thông báo trong `main`.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-fable-5-2 (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6); Critic Pass miễn theo ủy quyền của PM (`CRITIC_REQUIRED no`; plan chỉ đổi giao diện trang trong `src/app/auth`, không chạm luồng xác thực)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6b-signin-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A5 khớp source; grep `src` + `tests`: 3 key chỉ được `src/app/auth/signin/page.tsx` dùng.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                          | Bằng chứng                                                                       | Lý do / Hướng xử lý khi code                                                                                                                  |
| --- | -------------- | ------- | ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/app/auth/error/page.tsx:18`     | [SRC] `return` sớm khi chưa mount; sau đó chỉ có hàm thường `handleBackToSignIn` | Không có hook sau `return` sớm; khi chuyển sang `AuthShell` giữ nguyên thứ tự hook (repo không có rule react-hooks).                          |
| 2   | DEFECT         | [MINOR] | `src/app/auth/signin/page.tsx:35-36` | [SRC] Nút ngôn ngữ `fixed top-8 right-8`                                         | Nhãn mới dài hơn ("Tiếng Việt"/"English"); ở 320–375px có thể chạm nội dung. Dùng `absolute right-4 top-4` + QA 375px không chồng lên `main`. |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/auth/signin/page.tsx:89-91` | [SRC] `signinTagline` vẫn có vế "AI được mã hóa"                                 | Ngoài phạm vi (định vị sản phẩm); đã nêu ở §1 để PM quyết.                                                                                    |

#### Kết Luận

Không có `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-03) và Negative Probe N1–N3; không có ca test cũ bị thay. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]

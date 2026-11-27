---
trigger: model_decision
description: Mandatory bilingual translation for all user-facing text.
---

# Bilingual Translation Rule

## The Rule: No Hardcoded Text

Every piece of user-visible text MUST use the translation system. Do NOT hardcode English or Vietnamese strings directly in components.

## Implementation

**Config location**: `src/lib/utils/translations/` (`vi.ts`, `en.ts`, `index.ts`)

```typescript
export const translations = {
  vi: { greeting: "Xin chao" },
  en: { greeting: "Hello" },
};
```

**Usage in components** — Use the `useLanguage()` hook exclusively:

```tsx
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export function Welcome() {
  const { t } = useLanguage();
  return <h1>{t("greeting")}</h1>;
}
```

## Anti-Patterns (BANNED)

<important>
The following patterns are BANNED. Only `useLanguage()` + `t("key")` is allowed.

- ❌ Inline ternaries: `language === "vi" ? "Xin chào" : "Hello"`
- ❌ Direct dict access: `t.greeting` (use `t("greeting")` instead)
- ❌ Prop drilling translations: passing `t` as a Record<string, string> prop from parent to child
- ❌ Direct store import: `useLanguageStore()` + `translations[language]`

REQUIRED: `const { t, language } = useLanguage();` then `t("key")`.
</important>

## Class Components Exception

Class components cannot use hooks. Pass `t` as a prop typed as `(key: string) => string`, and
the parent (a function component) calls `useLanguage()` and passes `t` down.

## Enforcement

- Both `translations.vi` and `translations.en` MUST have matching keys.
- When adding new UI text, read `.agents/skills/add-translation/SKILL.md` for the full workflow.
- Type safety ensures missing keys cause compile errors.

## STE-Lite Microcopy Guidelines (VI & EN)

Apply adapted ASD-STE100 ("STE-lite") principles to all new or modified UI strings in `src/lib/utils/translations/vi.ts` and `en.ts`:

- **Buttons & CTAs**: Start with one direct imperative verb, 1–3 words (`Lưu`, `Xóa`, `Tạo ảnh`, `Thử lại` / `Save`, `Delete`, `Generate`, `Retry`).
- **Empty States**: State 1 concrete fact (what is empty) + 1 clear next action (`"Chưa có ảnh nào"` + `"Nhập prompt và nhấn Tạo ảnh để bắt đầu."`).
- **Toast & Error Messages**: Follow `[What failed] + [Next step]` in active voice (`"Không thể tải lên ảnh tham chiếu. Vui lòng thử lại."` / `"Failed to upload reference image. Please try again."`). Avoid empty apologies or internal jargon.
- **Natural Phrasing (No Literal Translation)**: Translate intent naturally for each language instead of word-for-word rendering (`"Branch in new chat"` → `"Tách sang chat mới"`, not `"Phân nhánh trong trò chuyện mới"`).
- **Untouchables & Scope**: Keep product/provider names (`Vikini`, `Gemini`, `Claude`, `DeepSeek`, `Grok`, `Strata`, `Gem`, `Persona`, `Image Studio`, `Novelcrafter`, `Prompt Studio`), keyboard shortcuts (`Ctrl+K`, `Esc`), file extensions (`.md`, `.txt`, `.pdf`), and interpolation variables (`{count}`, `{{limit}}`) verbatim. Apply to new and edited keys only; do not mass-rewrite unrelated legacy keys.

## Fixed Bilingual UI Glossary (Bảng thuật ngữ cố định Anh–Việt)

Use 1 canonical term per UI concept across all new and edited keys:

| EN                                        | Canonical VI                                    | Usage                                                        |
| :---------------------------------------- | :---------------------------------------------- | :----------------------------------------------------------- |
| `Conversation`                            | `Cuộc trò chuyện`                               | Prefer over `Cuộc hội thoại`; use `Chat` for compact buttons |
| `Message`                                 | `Tin nhắn`                                      | App-wide standard                                            |
| `Project`                                 | `Dự án`                                         | App-wide standard                                            |
| `Knowledge Base`                          | `Kho kiến thức`                                 | Avoid `cơ sở kiến thức` / `cơ sở tri thức`                   |
| `Document`                                | `Tài liệu`                                      | RAG & Google Docs items                                      |
| `File` / `Attachments`                    | `Tệp` / `Tệp đính kèm`                          | Avoid raw `file` in new Vietnamese copy                      |
| `Model`                                   | `Model`                                         | Keep verbatim (`model` mid-sentence); avoid `Mô hình`        |
| `Thinking` / `Reasoning`                  | `Suy luận`                                      | Reasoning level picker & stream state                        |
| `Context`                                 | `Ngữ cảnh`                                      | Context window & token usage                                 |
| `Web Search`                              | `Tìm kiếm web`                                  | Compact toolbar label: `Tìm web`                             |
| `Gem` / `Persona`                         | `Gem` / `Persona`                               | Keep feature names verbatim                                  |
| `Prompt`                                  | `Prompt`                                        | Keep verbatim                                                |
| `Image Studio` / `Gallery`                | `Image Studio` / `Thư viện`                     | Use `Thư viện` for gallery tab/heading                       |
| `Reference Image`                         | `Ảnh tham chiếu`                                | Image Studio standard                                        |
| `Aspect Ratio` / `Resolution`             | `Tỷ lệ khung hình` / `Độ phân giải`             | Compact label: `Tỷ lệ`                                       |
| `Story Bible` / `Outline` / `Scene Beats` | `Hồ sơ Truyện` / `Dàn ý` / `Phân cảnh`          | Novelcrafter Studio (`Chương` / `Hồi` for Chapter / Act)     |
| `Settings` / `Theme`                      | `Cài đặt` / `Giao diện`                         | Navigation & header standard                                 |
| `Delete` vs `Remove`                      | `Xóa` vs `Gỡ`                                   | `Xóa` = permanent delete; `Gỡ` = detach/unlink               |
| `Cancel`                                  | `Hủy`                                           | Standard tone mark `Hủy` (avoid `Huỷ`)                       |
| `Copy` / `Retry`                          | `Sao chép` / `Thử lại`                          | Action & error recovery buttons                              |
| `Upload` / `Download`                     | `Tải lên` / `Tải xuống`                         | Files & images                                               |
| `Sign in` / `Sign out` / `Rank` / `Block` | `Đăng nhập` / `Đăng xuất` / `Xếp hạng` / `Khóa` | Auth & Admin (`Mở khóa` = `Unblock`, `Máy cục bộ` = `Local`) |

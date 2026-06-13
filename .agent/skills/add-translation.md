---
description: Step-by-step guide for adding bilingual translations (VN/EN).
---

# Adding Bilingual Translations

Read this skill when adding new user-visible text to any component.

## Translation Files

Location: `lib/utils/translations/` — separate files for each language:

- `vi.ts` — Vietnamese translations
- `en.ts` — English translations
- `index.ts` — Exports `translations` object with compile-time key parity check

## Steps

1. **Choose a key name** using camelCase (e.g., `newFeatureName`)

2. **Add to BOTH `vi.ts` and `en.ts`** — always add to both simultaneously:

```typescript
// In lib/utils/translations/vi.ts
export const vi = {
  // ... existing keys
  newFeatureKey: "Văn bản tiếng Việt",
};

// In lib/utils/translations/en.ts
export const en = {
  // ... existing keys
  newFeatureKey: "English text",
};
```

3. **Verify keys match** — `index.ts` has compile-time type assertions. Run `npm run type-check` to catch mismatches.

## Usage in Components (REQUIRED Pattern)

<important>
Only `useLanguage()` + `t("key")` is allowed. See `rules/04-bilingual.md` for the full ban list.
</important>

```tsx
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export function MyComponent() {
  const { t, language } = useLanguage();
  return <button>{t("save")}</button>;
}
```

## Anti-Patterns (BANNED)

- ❌ `language === "vi" ? translations.vi : translations.en` — direct dict selection
- ❌ `t.save` — direct property access
- ❌ `import { translations } from "@/lib/utils/config"` — old location, use `useLanguage()` hook
- ❌ Passing `t` as `Record<string, string>` prop — use `useLanguage()` in each component

## Common Patterns

| Type        | VI Example            | EN Example            |
| ----------- | --------------------- | --------------------- |
| Button      | `"Lưu"`               | `"Save"`              |
| Title       | `"Quản lý Gems"`      | `"Manage Gems"`       |
| Placeholder | `"Nhập câu hỏi..."`   | `"Type a message..."` |
| Confirm     | `"Bạn có chắc chắn?"` | `"Are you sure?"`     |

## Validation Checklist

- Key exists in `translations/vi.ts`
- Key exists in `translations/en.ts`
- Key names match exactly (case-sensitive)
- Run `npm run type-check` to confirm key parity
- Component uses `useLanguage()` hook, not direct imports

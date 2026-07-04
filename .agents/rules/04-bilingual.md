---
trigger: model_decision
description: Mandatory bilingual translation for all user-facing text.
---

# Bilingual Translation Rule

## The Rule: No Hardcoded Text

Every piece of user-visible text MUST use the translation system. Do NOT hardcode English or Vietnamese strings directly in components.

## Implementation

**Config location**: `lib/utils/translations/` (`vi.ts`, `en.ts`, `index.ts`)

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
- When adding new UI text, read `skills/add-translation.md` for the full workflow.
- Type safety ensures missing keys cause compile errors.

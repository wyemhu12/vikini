---
trigger: model_decision
description: Mandatory bilingual translation for all user-facing text.
---

# Bilingual Translation Rule

## The Rule: No Hardcoded Text

Every piece of user-visible text MUST use the translation system. Do NOT hardcode English or Vietnamese strings directly in components.

## Implementation

**Config location**: `lib/utils/config.ts`

```typescript
export const translations = {
  vi: { greeting: "Xin chao" },
  en: { greeting: "Hello" },
};
```

**Usage in components**:

```tsx
import { translations } from "@/lib/utils/config";

export function Welcome({ lang }: { lang: "vi" | "en" }) {
  const t = translations[lang];
  return <h1>{t.greeting}</h1>;
}
```

## Enforcement

- Both `translations.vi` and `translations.en` MUST have matching keys.
- When adding new UI text, read `skills/add-translation.md` for the full workflow.
- Type safety ensures missing keys cause compile errors.

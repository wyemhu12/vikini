---
trigger: always_on
---

# Bilingual Translation Rule (Vikini)

## 1. The Rule: "No Hardcoded English"

Every piece of text shown to the user must be translatable.

## 2. Implementation

**Config Location**: `lib/utils/config.ts`

**Structure**:

```typescript
export const translations = {
  vi: { hello: "Xin chào" },
  en: { hello: "Hello" },
};
```

**Usage in Component**:

```tsx
import { useLanguage } from "@/lib/store/useLanguage"; // Example hook
import { translations } from "@/lib/utils/config";

export function Welcome() {
  const { lang } = useLanguage(); // or typically passed via props/context
  const t = translations[lang];

  return <h1>{t.hello}</h1>;
}
```

## 3. Enforcement

- **Type Check**: Ensure `translations.vi` and `translations.en` have matching keys.
- **Review**: Reject PRs with hardcoded strings like `<button>Submit</button>`.

---
description: Step-by-step guide for adding bilingual translations (VN/EN) to config.ts.
---

# Adding Bilingual Translations

Read this skill when adding new user-visible text to any component.

## Translation File

Location: `lib/utils/config.ts` -- contains `translations` object with `vi` and `en` keys.

## Steps

1. **Choose a key name** using camelCase (e.g., `newFeatureName`)

2. **Add to BOTH `vi` and `en` objects** -- always add to both simultaneously:

```typescript
// In translations.vi
newFeatureKey: "Van ban tieng Viet",

// In translations.en
newFeatureKey: "English text",
```

3. **Verify keys match** -- both objects must have identical key sets. TypeScript will catch mismatches at compile time.

## Common Patterns

| Type        | VI Example          | EN Example          |
| ----------- | ------------------- | ------------------- |
| Button      | "Luu"               | "Save"              |
| Title       | "Quan ly Gems"      | "Manage Gems"       |
| Placeholder | "Nhap cau hoi..."   | "Type a message..." |
| Confirm     | "Ban co chac chan?" | "Are you sure?"     |

## Usage in Components

```tsx
import { translations } from "@/lib/utils/config";

const t = language === "vi" ? translations.vi : translations.en;

<button>{t.save}</button>;
```

## Validation Checklist

- Key exists in `translations.vi`
- Key exists in `translations.en`
- Key names match exactly (case-sensitive)
- No trailing commas missing
- Run `npm run type-check` to confirm

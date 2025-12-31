---
description: How to add bilingual translations (VN/EN) to config.ts
---

# Bilingual Translation Workflow

This workflow ensures all UI text is properly translated in both Vietnamese and English.

## Translation File Location

`lib/utils/config.ts` - contains `translations` object with `vi` and `en` keys.

## Steps to Add New Translation

1. **Identify the new text key** - use camelCase naming (e.g., `newFeatureName`)

2. **Add to BOTH `vi` and `en` objects** - CRITICAL: Always add to both!

```typescript
// In translations.vi
newFeatureKey: "Văn bản tiếng Việt",

// In translations.en
newFeatureKey: "English text",
```

3. **Verify key exists in both objects** - Run this check:

```bash
# Quick check: count keys in each language
grep -c ":" lib/utils/config.ts
```

## Validation Checklist

Before committing, verify:

- [ ] Key exists in `translations.vi`
- [ ] Key exists in `translations.en`
- [ ] Key names match exactly (case-sensitive)
- [ ] No trailing commas missing

## Common Patterns

| Type        | VI Example            | EN Example            |
| ----------- | --------------------- | --------------------- |
| Button      | `"Lưu"`               | `"Save"`              |
| Title       | `"Quản lý Gems"`      | `"Manage Gems"`       |
| Placeholder | `"Nhập câu hỏi..."`   | `"Type a message..."` |
| Confirm     | `"Bạn có chắc chắn?"` | `"Are you sure?"`     |

## Usage in Components

```tsx
import { translations } from "@/lib/utils/config";

// Get based on user language preference
const t = language === "vi" ? translations.vi : translations.en;

// Use translation
<button>{t.save}</button>;
```

---
trigger: always_on
---

# Bilingual Translation Rule (Vikini)

## CRITICAL: All UI text MUST be bilingual

When adding or modifying ANY user-facing text in the codebase:

1. **Check if text needs translation** - Any string shown to users (buttons, labels, messages, placeholders, titles, errors)

2. **Add to BOTH languages** in `lib/utils/config.ts`:
   - `translations.vi`: Vietnamese text
   - `translations.en`: English text

3. **Use translation in component** - Never hardcode UI text:
   `	sx
const t = language === "vi" ? translations.vi : translations.en;
<button>{t.save}</button>
`

## Enforcement

- TypeScript will error if keys don't match between vi and en
- Run `npm run type-check` to verify

## When This Applies

- Adding new features with UI
- Creating new components with text
- Adding error messages, placeholders, labels, buttons
- Modifying existing text

---
description: Ensures no hardcoded English; mandates use of translations via config.ts.
trigger: model_decision
---

# Bilingual Translation Rule (Vikini)

## 1. The Rule: "No Hardcoded English"

Every piece of text shown to the user must be translatable.

## 2. Implementation

**Config Location**: lib/utils/config.ts

**Structure**:

`	ypescript
export const translations = {
  vi: { hello: "Xin chào" },
  en: { hello: "Hello" },
};
`

**Usage in Component**:

` sx
import { useLanguage } from "@/lib/store/useLanguage"; // Example hook
import { translations } from "@/lib/utils/config";

export function Welcome() {
const { lang } = useLanguage(); // or typically passed via props/context
const t = translations[lang];

return <h1>{t.hello}</h1>;
}
`

## 3. Enforcement

- **Type Check**: Ensure ranslations.vi and ranslations.en have matching keys.
- **Review**: Reject PRs with hardcoded strings like <button>Submit</button>.

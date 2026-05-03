---
description: Step-by-step guide for adding new AI models to Vikini.
---

# Adding New Models to Vikini

Read this skill when adding a new AI model to the system.

## Step 1: Update Model Registry

File: `lib/core/modelRegistry.ts`

Find the `SELECTABLE_MODELS` array and add a new entry:

```typescript
{
  id: "model-unique-id",          // The ID sent to the API
  descKey: "translationKey",      // Key for description in translations
  name: "Display Name",          // Shown in UI
  tokenLimit: 128000,
  contextWindow: 128000,
  category: "reasoning" | "low-latency",
  providerId: "gemini" | "grok" | "deepseek" | "openai" | "anthropic" | "groq" | "openrouter-free" | "openrouter-pay"
}
```

> **Note**: Always verify the `providerId` and `category` values against `lib/core/modelRegistry.ts` for the latest list.

### Field Guide

- **category**: `reasoning` for high intelligence/thinking models, `low-latency` for fast/cheap models
- **providerId**: Determines which Provider tab the model appears under in the UI

## Step 2: Add Translations

Add a description key for the new model in `lib/utils/config.ts`:

```typescript
// In translations.vi
modelDescKey: "Mo ta tieng Viet",

// In translations.en
modelDescKey: "English description",
```

See `skills/add-translation.md` for the full translation workflow.

## Step 3: Update Rank Configs (if needed)

If the model should be restricted by rank, update the `allowed_models` in the `rank_configs` table or admin dashboard.

## Step 4: Verify

- Restart the dev server
- Check the **Service** tab for the correct category
- Check the **Providers** tab for the correct filter
- Update `docs/models.md` with the new model details

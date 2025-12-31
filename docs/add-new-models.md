# Adding New Models to Vikini

Use this guide when adding new models to ensure they appear correctly in the Model Selector.

## 1. Update `lib/core/modelRegistry.ts`

Find the `SELECTABLE_MODELS` array. Add a new object following this interface:

```typescript
{
  id: "model-unique-id",          // The ID sent to the API
  descKey: "translationKey",      // Key for description in translations
  name: "Display Name",           // Shown in UI
  tokenLimit: 128000,
  contextWindow: 128000,
  category: "reasoning" | "low-latency",
  providerId: "gemini" | "grok" | "deepseek" | "openai" | "anthropic" | "groq" | "openrouter-free" | "openrouter-pay"
}
```

### Fields Guide

- **category**:
  - `reasoning`: High intelligence, thinking models (e.g., Gemini Pro, Claude Sonnet).
  - `low-latency`: Fast responses, cheaper/free (e.g., Flash, Haiku, Llama Instant).
- **providerId**:
  - determines which "Provider" tab the model appears under.

## 2. Update Translations (Optional)

If adding a new `descKey`, make sure to update `translations.en` and `translations.vi` in `lib/utils/config.ts`.

## 3. Verify

- Restart the dev server if needed.
- Check the **Service** tab to see your model in the correct category.
- Check the **Providers** tab to see your model under the correct filter.

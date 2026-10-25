// /lib/utils/translations/requiredKeys.test.ts
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

const REQUIRED_KEYS = [
  // 7 UI audit missing keys
  "manageGems",
  "startListening",
  "stopListening",
  "readAloud",
  "skipToMainContent",
  "openMenu",
  "yourStories",
  // Chat P3 keys
  "webSearchLabel",
  "tokenUsageAria",
  "personaNoneFound",
  "personaRemove",
  "personaApplyFailed",
  "personaLoadFailed",
  // Novelcrafter P1 & P2 keys
  "novelcrafterFormatH1",
  "novelcrafterFormatH2",
  "novelcrafterFormatBold",
  "novelcrafterFormatItalic",
  "novelcrafterFormatStrike",
  "novelcrafterFormatSceneBreak",
  "novelcrafterFormatBulletList",
  "novelcrafterFormatNumberedList",
  "novelcrafterTypographyBtn",
  "novelcrafterTypographyTitle",
  "novelcrafterTypographyFontLabel",
  "novelcrafterTypographyFontSerif",
  "novelcrafterTypographyFontSans",
  "novelcrafterTypographyFontMono",
  "novelcrafterTypographySizeLabel",
  "novelcrafterTypographyLineHeightLabel",
  "novelcrafterTypographyLineCompact",
  "novelcrafterTypographyLineNormal",
  "novelcrafterTypographyLineRelaxed",
  "novelcrafterTypographyIndentLabel",
  "novelcrafterBubbleDescribeBtn",
  "novelcrafterBubbleExpandBtn",
  "novelcrafterBubbleFeedbackBtn",
  "novelcrafterQuickEditBtn",
  "novelcrafterQuickEditSubmitBtn",
  "novelcrafterCodexPreviewCharacter",
  "novelcrafterCodexPreviewWorld",
  "novelcrafterCodexJumpToBible",
  "novelcrafterCodexAliasesLabel",
  "novelcrafterMoreToolsBtn",
  "novelcrafterNavigatorSheetDesc",
  "novelcrafterHistorySheetDesc",
  "novelcrafterFeedbackSheetDesc",
  "novelcrafterFeedbackPrevItem",
  "novelcrafterFeedbackNextItem",
  "novelcrafterFeedbackMoreActions",
  "novelcrafterFeedbackRateUp",
  "novelcrafterFeedbackRateDown",
  "novelcrafterOutlinePovLabel",
  "novelcrafterOutlineTenseLabel",
] as const;

describe("translations requiredKeys (TC-I18N)", () => {
  it("I18-1 & I18-3: defines all required audit, Chat P3, and Novelcrafter P1/P2 keys in both vi and en with non-empty values not equal to key names", () => {
    const viRecord = vi as Record<string, unknown>;
    const enRecord = en as Record<string, unknown>;

    for (const key of REQUIRED_KEYS) {
      const viVal = viRecord[key];
      const enVal = enRecord[key];

      expect(typeof viVal, `vi.${key} should be string`).toBe("string");
      expect(typeof enVal, `en.${key} should be string`).toBe("string");
      expect((viVal as string).trim().length, `vi.${key} non-empty`).toBeGreaterThan(0);
      expect((enVal as string).trim().length, `en.${key} non-empty`).toBeGreaterThan(0);
      expect(viVal, `vi.${key} must not equal raw key name`).not.toBe(key);
      expect(enVal, `en.${key} must not equal raw key name`).not.toBe(key);
    }
  });

  it("I18-2 (Negative): contains zero 'Sudowrite' brand strings in en or vi translation values", () => {
    for (const [k, val] of Object.entries(en)) {
      if (typeof val === "string") {
        expect(val, `en.${k} should not mention Sudowrite`).not.toMatch(/sudowrite/i);
      }
    }
    for (const [k, val] of Object.entries(vi)) {
      if (typeof val === "string") {
        expect(val, `vi.${k} should not mention Sudowrite`).not.toMatch(/sudowrite/i);
      }
    }
  });
});

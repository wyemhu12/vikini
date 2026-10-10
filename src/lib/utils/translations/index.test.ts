import { describe, it, expect } from "vitest";
import { vi as viDict } from "./vi";
import { en as enDict } from "./en";
import { translations, tVi, tEn, type TranslationKey } from "./index";

describe("Translations Core Parity & Quality (TC-I18N-01)", () => {
  it("should have 100% exact key parity between vi and en dictionaries", () => {
    const viKeys = Object.keys(viDict).sort();
    const enKeys = Object.keys(enDict).sort();

    expect(viKeys.length).toBeGreaterThan(0);
    expect(enKeys.length).toBeGreaterThan(0);
    expect(viKeys).toEqual(enKeys);
  });

  it("should not contain any undefined, null, or empty string values in vi dictionary", () => {
    for (const [key, value] of Object.entries(viDict)) {
      expect(value, `vi key '${key}' should be a non-empty string`).toBeDefined();
      expect(typeof value).toBe("string");
      expect(value.trim().length, `vi key '${key}' must not be empty`).toBeGreaterThan(0);
    }
  });

  it("should not contain any undefined, null, or empty string values in en dictionary", () => {
    for (const [key, value] of Object.entries(enDict)) {
      expect(value, `en key '${key}' should be a non-empty string`).toBeDefined();
      expect(typeof value).toBe("string");
      expect(value.trim().length, `en key '${key}' must not be empty`).toBeGreaterThan(0);
    }
  });

  it("should contain all critical keys added during Phase 4 audit remediation", () => {
    const criticalKeys: readonly TranslationKey[] = [
      "language",
      "themes",
      "loadingConfigs",
      "adminManagement",
      "clearIcon",
      "failedUpdateUser",
      "icon",
      "dismissNotification",
      "notifications",
      "chat",
      "imageStudio",
      "gallery",
    ] as const;

    for (const key of criticalKeys) {
      expect(viDict[key]).toBeDefined();
      expect(enDict[key]).toBeDefined();
    }
  });

  it("should properly export translations, tVi and tEn objects matching the dictionaries", () => {
    expect(translations.vi).toBe(viDict);
    expect(translations.en).toBe(enDict);
    expect(tVi).toBe(viDict);
    expect(tEn).toBe(enDict);
  });

  it("should verify 100% of referenced UI translation keys exist and are non-empty", () => {
    const referencedKeys: readonly TranslationKey[] = [
      "adminManagement",
      "signOut",
      "navigation",
      "closeSidebar",
      "chat",
      "imageStudio",
      "gallery",
      "noProjects",
      "createProjectHint",
      "startChatHint",
      "gemsDesc",
      "renameFallbackToast",
      "deleteFallbackToast",
      "downloadComplete",
      "downloadFailed",
      "conversationOptions",
      "optionsFor",
      "exportTxt",
      "downloading",
      "rename",
      "delete",
      "icon",
      "clearIcon",
      "selectIcon",
      "theme",
      "themeFocus",
      "themeGlassmorphism",
      "themeRa2",
      "refresh",
      "kbDeleteConfirm",
      "kbDeleteConfirmDesc",
      "uploadFailed",
      "deleteFailed",
      "failedFetchUsers",
      "failedLoadUsers",
      "failedUpdateUser",
      "failedUpdateUsers",
      "userDetailAria",
      "toneDefault",
      "toneDefaultDesc",
      "toneProfessional",
      "toneProfessionalDesc",
      "toneFriendly",
      "toneFriendlyDesc",
      "toneCandid",
      "toneCandidDesc",
      "toneQuirky",
      "toneQuirkyDesc",
      "toneEfficient",
      "toneEfficientDesc",
      "toneCynical",
      "toneCynicalDesc",
      "toneLawyer",
      "toneLawyerDesc",
      "close",
      "expand",
      "collapse",
      "dismissNotification",
      "notifications",
    ] as const;

    expect(referencedKeys.length).toBe(59);

    for (const key of referencedKeys) {
      expect(viDict[key], `Referenced key '${key}' missing in vi.ts`).toBeDefined();
      expect(
        viDict[key].trim().length,
        `Referenced key '${key}' is empty in vi.ts`
      ).toBeGreaterThan(0);
      expect(enDict[key], `Referenced key '${key}' missing in en.ts`).toBeDefined();
      expect(
        enDict[key].trim().length,
        `Referenced key '${key}' is empty in en.ts`
      ).toBeGreaterThan(0);
    }
  });
});

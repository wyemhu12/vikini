// /lib/features/novelcrafter/manuscriptTypography.test.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MANUSCRIPT_TYPOGRAPHY,
  sanitizeManuscriptTypography,
} from "./manuscriptTypography";

describe("manuscriptTypography (TC-TYPO)", () => {
  it("TY-1: returns DEFAULT_MANUSCRIPT_TYPOGRAPHY for undefined, null, primitives, or arrays", () => {
    for (const invalid of [undefined, null, 42, "x", true, []]) {
      expect(sanitizeManuscriptTypography(invalid)).toEqual(DEFAULT_MANUSCRIPT_TYPOGRAPHY);
    }
  });

  it("TY-2 (Negative): falls back to default values for out-of-range enum fields", () => {
    const corrupted = {
      fontFamily: "comic",
      fontSize: "xxl",
      lineHeight: "tight",
      paragraphIndent: "yes",
    };
    expect(sanitizeManuscriptTypography(corrupted)).toEqual(DEFAULT_MANUSCRIPT_TYPOGRAPHY);
  });

  it("TY-3: preserves valid fields and strips unknown/extra keys (exact 4 keys)", () => {
    const raw = {
      fontFamily: "mono",
      fontSize: "xl",
      lineHeight: "relaxed",
      paragraphIndent: true,
      evil: "payload",
    };
    const sanitized = sanitizeManuscriptTypography(raw);
    expect(sanitized).toEqual({
      fontFamily: "mono",
      fontSize: "xl",
      lineHeight: "relaxed",
      paragraphIndent: true,
    });
    expect(Object.keys(sanitized).sort()).toEqual([
      "fontFamily",
      "fontSize",
      "lineHeight",
      "paragraphIndent",
    ]);
  });
});

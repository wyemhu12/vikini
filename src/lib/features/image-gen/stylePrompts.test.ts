import { describe, it, expect } from "vitest";
import { STYLE_PROMPTS, getStyleInstruction } from "./stylePrompts";
import { IMAGE_TEMPLATES } from "./templates";

describe("Style Prompts Advanced System (TC-IMG-02)", () => {
  const expectedStyles = [
    "photorealistic",
    "anime",
    "digital-art",
    "cinematic",
    "3d-render",
    "watercolor",
    "oil-painting",
    "sketch-pencil",
    "pop-art",
    "minimalist",
    "surrealist",
    "pixel-art",
    "isometric",
    "low-poly",
    "steampunk",
    "cyberpunk",
    "fantasy-art",
    "art-nouveau",
  ] as const;

  it("should contain exactly all 18 defined styles including art-nouveau", () => {
    const keys = Object.keys(STYLE_PROMPTS);
    expect(keys.length).toBe(18);

    for (const style of expectedStyles) {
      expect(STYLE_PROMPTS[style], `Style '${style}' should exist in STYLE_PROMPTS`).toBeDefined();
    }
  });

  it("should have comprehensive system instruction (>50 chars) and non-empty shortAppend for every style", () => {
    for (const [styleId, config] of Object.entries(STYLE_PROMPTS)) {
      expect(config.instruction, `instruction for ${styleId} is required`).toBeTruthy();
      expect(
        config.instruction.length,
        `instruction for ${styleId} should be > 50 characters`
      ).toBeGreaterThan(50);
      expect(config.shortAppend, `shortAppend for ${styleId} is required`).toBeTruthy();
      expect(
        config.shortAppend.trim().length,
        `shortAppend for ${styleId} should not be empty`
      ).toBeGreaterThan(0);
    }
  });

  describe("getStyleInstruction", () => {
    it("should return the correct StylePromptConfig for a valid style ID (happy path)", () => {
      const config = getStyleInstruction("cinematic");
      expect(config).toBeDefined();
      expect(config?.shortAppend).toContain("cinematic");
      expect(config?.instruction).toBe(STYLE_PROMPTS["cinematic"].instruction);
    });

    it("should return undefined for 'none', empty string, or unknown style ID (edge cases)", () => {
      expect(getStyleInstruction("none")).toBeUndefined();
      expect(getStyleInstruction("")).toBeUndefined();
      expect(getStyleInstruction("non-existent-style")).toBeUndefined();
      expect(getStyleInstruction("random123")).toBeUndefined();
    });
  });

  it("should ensure every template.style in IMAGE_TEMPLATES exists in STYLE_PROMPTS (cross-consistency)", () => {
    for (const template of IMAGE_TEMPLATES) {
      const styleConfig = STYLE_PROMPTS[template.style];
      expect(
        styleConfig,
        `Template '${template.id}' references style '${template.style}' which does not exist in STYLE_PROMPTS`
      ).toBeDefined();
    }
  });
});

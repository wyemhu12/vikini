import { describe, it, expect } from "vitest";
import { IMAGE_TEMPLATES } from "./templates";

describe("Image Generation Templates (TC-IMG-01)", () => {
  it("should contain exactly 18 curated templates", () => {
    expect(Array.isArray(IMAGE_TEMPLATES)).toBe(true);
    expect(IMAGE_TEMPLATES.length).toBe(18);
  });

  it("should have valid bilingual structure and required fields for each template", () => {
    for (const template of IMAGE_TEMPLATES) {
      expect(template.id, "template id is required").toBeTruthy();
      expect(typeof template.id).toBe("string");

      // Name bilingual
      expect(template.name).toBeDefined();
      expect(template.name.en, `name.en is required for ${template.id}`).toBeTruthy();
      expect(template.name.vi, `name.vi is required for ${template.id}`).toBeTruthy();

      // Description bilingual
      expect(template.description).toBeDefined();
      expect(template.description.en, `description.en is required for ${template.id}`).toBeTruthy();
      expect(template.description.vi, `description.vi is required for ${template.id}`).toBeTruthy();

      // Prompt and properties
      expect(template.prompt, `prompt is required for ${template.id}`).toBeTruthy();
      expect(template.prompt.trim().length).toBeGreaterThan(10);
      expect(template.previewUrl, `previewUrl is required for ${template.id}`).toBeTruthy();
      expect(typeof template.requiresPhoto).toBe("boolean");
      expect(template.style, `style is required for ${template.id}`).toBeTruthy();
    }
  });

  it("should have unique IDs across all templates", () => {
    const ids = IMAGE_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(18);
  });

  it("should have exact IDs for the first 6 featured templates shown by default", () => {
    const firstSixIds = IMAGE_TEMPLATES.slice(0, 6).map((t) => t.id);
    expect(firstSixIds).toEqual(["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]);
  });
});

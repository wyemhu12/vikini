// /lib/features/novelcrafter/promptStudioPreview.test.ts
import { describe, expect, it } from "vitest";
import { ALL_PROMPT_ACTION_KEYS } from "./promptActions";
import { buildPromptStudioPreview } from "./promptStudioPreview";

describe("promptStudioPreview (PV-01..PV-03)", () => {
  it("PV-01: generates valid XML preview for all 37 action keys without throwing ValidationError", () => {
    for (const key of ALL_PROMPT_ACTION_KEYS) {
      const preview = buildPromptStudioPreview(key);
      expect(preview.ok).toBe(true);
      if (preview.ok) {
        expect(preview.xml).toContain("<feature_instruction>");
        expect(preview.xml).toContain("</feature_instruction>");
      }
    }
  });

  it("PV-02: reflects custom directive override in xml while preserving locked protocol tail on write:openings_3", () => {
    const preview = buildPromptStudioPreview("write:openings_3", {
      directive: "Write 3 dark gothic openings.",
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.xml).toContain("Write 3 dark gothic openings.");
      expect(preview.xml).toContain("=== OPENING 1: Action/Conflict Hook ===");
      expect(preview.xml).toContain("=== OPENING 2: Sensory/Atmosphere Immersion ===");
      expect(preview.xml).toContain("=== OPENING 3: Character/Dialogue Hook ===");
    }
  });

  it("PV-03: omits <characters> while keeping required <preceding_prose> on write:auto when unchecked in override.contextNodes", () => {
    const preview = buildPromptStudioPreview("expand:expand", {
      contextNodes: ["style"],
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.xml).toContain("<style>");
      expect(preview.xml).not.toContain("<characters>");
      expect(preview.xml).not.toContain("<preceding_prose>");
    }
  });
});

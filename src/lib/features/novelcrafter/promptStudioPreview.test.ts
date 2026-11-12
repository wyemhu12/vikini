// /lib/features/novelcrafter/promptStudioPreview.test.ts
import { describe, expect, it } from "vitest";
import { ALL_PROMPT_ACTION_KEYS } from "./promptActions";
import { buildPromptStudioPreview, type PromptStudioPreviewSource } from "./promptStudioPreview";
import { createDefaultStoryState, type StoryBible } from "./types";

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

  const emptyBible = createDefaultStoryState().storyBible;
  const source = (bible: Partial<StoryBible>, extra: Partial<PromptStudioPreviewSource> = {}) => ({
    storyBible: { ...emptyBible, ...bible },
    chapter: { title: "Chương 1", content: "", scenes: "", summary: "" },
    ...extra,
  });

  it("TC-U12: uses the real story's sections instead of sample data", () => {
    const preview = buildPromptStudioPreview(
      "bible:outline",
      undefined,
      source({ genre: "Cozy mystery", characters: "## Lan (Lead)", synopsis: "Real synopsis" })
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.xml).toContain("Cozy mystery");
    expect(preview.xml).toContain("Lan (Lead)");
    expect(preview.xml).toContain("Real synopsis");
    expect(preview.xml).not.toContain("Arcane Steampunk");
    expect(preview.xml).not.toContain("Lyra Vance");

    const withoutSource = buildPromptStudioPreview("bible:outline");
    expect(withoutSource.ok && withoutSource.xml).toContain("Arcane Steampunk");
  });

  it("TC-U13: the real story's hidden-from-AI flags apply, even when a section falls back to sample", () => {
    const hiddenReal = buildPromptStudioPreview(
      "bible:outline",
      undefined,
      source({ characters: "Secret cast", charactersVisibleToAI: false, synopsis: "S" })
    );
    expect(hiddenReal.ok && hiddenReal.xml).not.toContain("Secret cast");

    const hiddenEmpty = buildPromptStudioPreview(
      "bible:outline",
      undefined,
      source({ characters: "", characterCards: [], charactersVisibleToAI: false, synopsis: "S" })
    );
    expect(hiddenEmpty.ok).toBe(true);
    if (!hiddenEmpty.ok) return;
    expect(hiddenEmpty.xml).not.toContain("Lyra Vance");
    expect(hiddenEmpty.sampleSections).toContain("characters");
  });

  it("TC-U14: empty real chapters use the sample chapter; broken data falls back to the full sample", () => {
    const emptyChapter = buildPromptStudioPreview(
      "bible:chapter_summary",
      undefined,
      source({ synopsis: "S" })
    );
    expect(emptyChapter.ok).toBe(true);
    expect(emptyChapter.ok && emptyChapter.usedSample).toBeFalsy();

    const broken = buildPromptStudioPreview("bible:outline", undefined, {
      storyBible: { ...emptyBible, characterCards: "x" } as unknown as StoryBible,
    });
    expect(broken.ok).toBe(true);
    expect(broken.ok && broken.usedSample).toBe(true);
  });

  it("TC-U19: a section with structured cards but no text is not mixed with sample text", () => {
    const preview = buildPromptStudioPreview(
      "bible:outline",
      undefined,
      source({
        synopsis: "S",
        characters: "",
        characterCards: [
          { id: "c1", name: "Lan", role: "Lead", traits: "brave", visibleToAI: true },
        ],
      })
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.xml).toContain("Lan");
    expect(preview.xml).not.toContain("Lyra Vance");
  });
});

// /lib/features/novelcrafter/pruneStoryBibleForStream.test.ts
import { describe, expect, it } from "vitest";
import { needsBraindumpForStream, pruneStoryBibleForStream } from "./pruneStoryBibleForStream";
import { createDefaultStoryState, type StoryBible } from "./types";

describe("pruneStoryBibleForStream", () => {
  const sampleBible: StoryBible = {
    ...createDefaultStoryState().storyBible,
    braindump: "Raw braindump notes",
    synopsis: "Main synopsis",
    characters: "Freeform character notes",
    charactersVisibleToAI: true,
    characterCards: [
      { id: "c1", name: "Visible Hero", role: "Lead", traits: "Brave", visibleToAI: true },
      { id: "c2", name: "Hidden NPC", role: "Side", traits: "Secret", visibleToAI: false },
    ],
    worldbuilding: "Freeform world lore",
    worldbuildingVisibleToAI: true,
    worldElements: [
      {
        id: "w1",
        name: "Citadel",
        category: "Location",
        description: "High tower",
        visibleToAI: true,
      },
      {
        id: "w2",
        name: "Hidden Vault",
        category: "Secret",
        description: "Locked",
        visibleToAI: false,
      },
    ],
  };

  it("retains braindump only when feature is bible and target is synopsis or outline", () => {
    const forSynopsis = pruneStoryBibleForStream(sampleBible, "bible", "synopsis");
    const forOutline = pruneStoryBibleForStream(sampleBible, "bible", "outline");
    const forWrite = pruneStoryBibleForStream(sampleBible, "write");

    expect(forSynopsis.braindump).toBe("Raw braindump notes");
    expect(forOutline.braindump).toBe("Raw braindump notes");
    expect(forWrite.braindump).toBe("");
  });

  it("TC-B1-04 & TC-B1-05: retains braindump fallback only when synopsis is empty for writeMode='first_draft_rough'", () => {
    const emptySynopsisBible: StoryBible = {
      ...sampleBible,
      synopsis: "   ",
      braindump: "Seed idea",
    };

    // TC-B1-04: first_draft_rough with empty synopsis keeps braindump
    const roughEmptySynopsis = pruneStoryBibleForStream(
      emptySynopsisBible,
      "write",
      undefined,
      "",
      "first_draft_rough"
    );
    expect(roughEmptySynopsis.braindump).toBe("Seed idea");
    expect(needsBraindumpForStream("write", undefined, "first_draft_rough", "   ")).toBe(true);

    // TC-B1-05 (negative): first_draft_rough with non-empty synopsis, auto mode, or rewrite strips braindump
    const roughWithSynopsis = pruneStoryBibleForStream(
      sampleBible,
      "write",
      undefined,
      "",
      "first_draft_rough"
    );
    expect(roughWithSynopsis.braindump).toBe("");

    const autoEmptySynopsis = pruneStoryBibleForStream(
      emptySynopsisBible,
      "write",
      undefined,
      "",
      "auto"
    );
    expect(autoEmptySynopsis.braindump).toBe("");

    const rewriteEmptySynopsis = pruneStoryBibleForStream(emptySynopsisBible, "rewrite");
    expect(rewriteEmptySynopsis.braindump).toBe("");
  });

  it("filters out individual cards with visibleToAI === false while keeping visible ones", () => {
    const pruned = pruneStoryBibleForStream(sampleBible, "write");

    expect(pruned.characters).toBe("Freeform character notes");
    expect(pruned.characterCards).toHaveLength(1);
    expect(pruned.characterCards[0]?.name).toBe("Visible Hero");
    expect(pruned.worldbuilding).toBe("Freeform world lore");
    expect(pruned.worldElements).toHaveLength(1);
    expect(pruned.worldElements[0]?.name).toBe("Citadel");
  });

  it("strips all characters and worldbuilding when section visibility toggles are false", () => {
    const hiddenSectionsBible: StoryBible = {
      ...sampleBible,
      charactersVisibleToAI: false,
      worldbuildingVisibleToAI: false,
    };

    const pruned = pruneStoryBibleForStream(hiddenSectionsBible, "write");

    expect(pruned.characters).toBe("");
    expect(pruned.characterCards).toEqual([]);
    expect(pruned.worldbuilding).toBe("");
    expect(pruned.worldElements).toEqual([]);
  });

  it("PR-02..PR-05: respects bible:draft braindump fallback, custom contextNodes pruning, and preserves target field during bible rewrite", () => {
    const emptySynopsisBible: StoryBible = {
      ...sampleBible,
      synopsis: "   ",
      braindump: "Draft fallback seed",
      outline: "Full outline",
    };

    // PR-02: bibleTarget='draft' retains braindump when synopsis is empty
    const draftPruned = pruneStoryBibleForStream(emptySynopsisBible, "bible", "draft");
    expect(draftPruned.braindump).toBe("Draft fallback seed");

    // PR-03: write with contextNodes=['synopsis','outline'] retains braindump when synopsis is empty
    const writeWithSynopsisNode = pruneStoryBibleForStream(
      emptySynopsisBible,
      "write",
      undefined,
      "",
      "auto",
      ["synopsis", "outline"]
    );
    expect(writeWithSynopsisNode.braindump).toBe("Draft fallback seed");
    expect(writeWithSynopsisNode.outline).toBe("Full outline");
    expect(writeWithSynopsisNode.characters).toBe("");
    expect(writeWithSynopsisNode.characterCards).toEqual([]);

    // PR-04: write with contextNodes=['style','scenes'] strips characters, worldbuilding, synopsis, outline
    const leanPruned = pruneStoryBibleForStream(sampleBible, "write", undefined, "", "auto", [
      "style",
      "scenes",
    ]);
    expect(leanPruned.characters).toBe("");
    expect(leanPruned.characterCards).toEqual([]);
    expect(leanPruned.worldbuilding).toBe("");
    expect(leanPruned.worldElements).toEqual([]);
    expect(leanPruned.synopsis).toBe("");

    // PR-05: bible rewrite target field is preserved even when omitted from contextNodes
    const rewriteCharactersPruned = pruneStoryBibleForStream(
      sampleBible,
      "bible",
      "characters",
      "",
      undefined,
      ["synopsis"]
    );
    expect(rewriteCharactersPruned.characters).toBe("Freeform character notes");
    expect(rewriteCharactersPruned.characterCards).toHaveLength(1);
  });
});

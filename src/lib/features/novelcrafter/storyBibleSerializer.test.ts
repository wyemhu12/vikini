// /lib/features/novelcrafter/storyBibleSerializer.test.ts
import { describe, expect, it } from "vitest";
import { createDefaultStoryState } from "./types";
import {
  escapeXmlPromptText,
  serializeStoryBibleWithStructuredCards,
} from "./storyBibleSerializer";
import { parseThreeOpenings } from "./openingsParser";
import { parseCharacterCardsFromMarkdown } from "./characterParser";
import { pruneStoryBibleForStream } from "./pruneStoryBibleForStream";
import { NovelcrafterStreamRunRegistry } from "./streamRunRegistry";

describe("storyBibleSerializer and domain helpers", () => {
  it("serializes structured character, worldbuilding, and outline cards alongside free-form notes", () => {
    const bible = createDefaultStoryState("gemini-2.5-flash").storyBible;
    bible.characters = "General notes on cast.";
    bible.characterCards = [
      {
        id: "char-1",
        name: "Linh",
        role: "Protagonist",
        traits: "Observant, stubborn",
        visibleToAI: true,
      },
    ];
    bible.worldElements = [
      {
        id: "world-1",
        name: "Sunken Archive",
        category: "Location",
        description: "Submerged library beneath the citadel",
        visibleToAI: true,
      },
    ];
    bible.outlineItems = [
      {
        id: "out-1",
        type: "chapter",
        title: "Chapter 1: Low Tide",
        summary: "- Linh enters the archive\n- Finds the broken seal",
      },
    ];

    const serialized = serializeStoryBibleWithStructuredCards(bible);
    expect(serialized.charactersText).toContain("### Linh (Protagonist)");
    expect(serialized.charactersText).toContain("General notes on cast.");
    expect(serialized.worldbuildingText).toContain("### Sunken Archive [Location]");
    expect(serialized.outlineText).toContain("### Chapter 1: Low Tide");
  });

  it("parses 3 distinct openings and character cards from markdown", () => {
    const rawOpenings = [
      "### Opening 1: Action Hook",
      "The lantern shattered against the wet stone.",
      "### Opening 2: Dialogue Hook",
      '"You\'re late," she whispered.',
      "### Opening 3: Atmospheric Hook",
      "Fog curled over the harbor like a sleeping beast.",
    ].join("\n");

    const parsedOpenings = parseThreeOpenings(rawOpenings);
    expect(parsedOpenings).toHaveLength(3);
    expect(parsedOpenings[0].label).toContain("Action Hook");
    expect(parsedOpenings[1].content).toContain("You're late");

    const rawChars = [
      "### Kael (Antagonist)",
      "Cold, calculating warrior who fears the ancient curse.",
    ].join("\n");
    const parsedChars = parseCharacterCardsFromMarkdown(rawChars);
    expect(parsedChars).toHaveLength(1);
    expect(parsedChars[0].name).toBe("Kael");
    expect(parsedChars[0].role).toBe("Antagonist");
    expect(parsedChars[0].traits).toContain("Cold");
  });

  it("prunes non-essential Story Bible fields for rewrite and expand features and manages stream run registry", () => {
    const bible = createDefaultStoryState("gemini-2.5-flash").storyBible;
    bible.braindump = "Huge braindump";
    bible.characters = "Hidden characters";
    bible.charactersVisibleToAI = false;
    bible.style = "Noir style";

    const pruned = pruneStoryBibleForStream(bible, "rewrite");
    expect(pruned.braindump).toBe("");
    expect(pruned.characters).toBe("");
    expect(pruned.characterCards).toHaveLength(0);
    expect(pruned.style).toBe("Noir style");

    const registry = new NovelcrafterStreamRunRegistry();
    const firstId = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    });
    expect(firstId).not.toBeNull();
    // Second run while busy returns null
    const secondWhileBusy = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    });
    expect(secondWhileBusy).toBeNull();
    expect(registry.isBusy()).toBe(true);
    if (firstId) {
      expect(registry.endRun(firstId)).toBe(true);
    }
    expect(registry.isBusy()).toBe(false);
  });

  it("omits cards with visibleToAI === false from serialized Story Bible text", () => {
    const bible = createDefaultStoryState("gemini-2.5-flash").storyBible;
    bible.characterCards = [
      { id: "c1", name: "Visible Hero", role: "Lead", traits: "Kind", visibleToAI: true },
      { id: "c2", name: "Hidden Villain", role: "Boss", traits: "Secret", visibleToAI: false },
    ];
    const serialized = serializeStoryBibleWithStructuredCards(bible);
    expect(serialized.charactersText).toContain("Visible Hero");
    expect(serialized.charactersText).not.toContain("Hidden Villain");
  });

  it("TC-302: serializes Codex aliases, filters by activeContextText, and escapes XML prompt delimiters", () => {
    expect(escapeXmlPromptText("Tag <story_so_far> & </story_bible>")).toBe(
      "Tag &lt;story_so_far&gt; &amp; &lt;/story_bible&gt;"
    );

    const bible = createDefaultStoryState("gemini-2.5-flash").storyBible;
    bible.characterCards = [
      {
        id: "c1",
        name: "Lâm Hàn",
        aliases: ["Tiểu Hàn", "Kiếm Đế"],
        role: "Main",
        traits: "Kiếm đạo vô song",
        visibleToAI: true,
        alwaysInclude: false,
      },
      {
        id: "c2",
        name: "Tô Tuyết",
        aliases: ["Tuyết Nhi"],
        role: "Heroine",
        traits: "Băng tâm",
        visibleToAI: true,
        alwaysInclude: true,
      },
      {
        id: "c3",
        name: "Trương Ba",
        role: "Side",
        traits: "Thợ rèn",
        visibleToAI: true,
        alwaysInclude: false,
      },
    ];

    const filtered = serializeStoryBibleWithStructuredCards(bible, {
      activeContextText: "Tiểu Hàn bước lên đài chiến.",
    });
    expect(filtered.charactersText).toContain("### Lâm Hàn (Main)");
    expect(filtered.charactersText).toContain("Aliases: Tiểu Hàn, Kiếm Đế");
    expect(filtered.charactersText).toContain("### Tô Tuyết (Heroine)");
    expect(filtered.charactersText).not.toContain("Trương Ba");

    const pruned = pruneStoryBibleForStream(
      bible,
      "write",
      undefined,
      "Tiểu Hàn bước lên đài chiến."
    );
    expect(pruned.characterCards.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

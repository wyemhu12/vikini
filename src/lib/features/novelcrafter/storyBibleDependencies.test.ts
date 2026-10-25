// /lib/features/novelcrafter/storyBibleDependencies.test.ts
import { describe, expect, it } from "vitest";
import { selectStoryBibleDependencies } from "./storyBibleDependencies";
import { createDefaultStoryState, type StoryBible } from "./types";

const SAMPLE_BIBLE: StoryBible = {
  ...createDefaultStoryState().storyBible,
  braindump: "Seed idea from braindump",
  genre: "Dark Fantasy",
  style: "Gritty third-person",
  synopsis: "Full story synopsis",
  characters: "Hero notes",
  charactersVisibleToAI: true,
  worldbuilding: "World lore",
  worldbuildingVisibleToAI: true,
  outline: "Act I, Act II, Act III",
};

describe("storyBibleDependencies (PB-02..PB-05)", () => {
  it("PB-02: bibleTarget='draft' includes synopsis (or braindump fallback) and outline by default", () => {
    const deps = selectStoryBibleDependencies("bible", SAMPLE_BIBLE, "draft");
    expect(deps.synopsis).toBe("Full story synopsis");
    expect(deps.outline).toBe("Act I, Act II, Act III");
    expect(deps.style).toBe("Gritty third-person");
    expect(deps.genre).toBe("Dark Fantasy");
    expect(deps.characters).toBe("Hero notes");
    expect(deps.worldbuilding).toBe("World lore");

    const emptySynopsisBible: StoryBible = { ...SAMPLE_BIBLE, synopsis: "   " };
    const fallbackDeps = selectStoryBibleDependencies("bible", emptySynopsisBible, "draft");
    expect(fallbackDeps.synopsis).toBe("Seed idea from braindump");
    expect(fallbackDeps.synopsisIsBraindumpFallback).toBe(true);
  });

  it("PB-03 & PB-04: custom contextNodes overrides default Story Bible node selection", () => {
    const writeWithOutline = selectStoryBibleDependencies(
      "write",
      SAMPLE_BIBLE,
      undefined,
      "",
      "auto",
      ["outline", "synopsis"]
    );
    expect(writeWithOutline.outline).toBe("Act I, Act II, Act III");
    expect(writeWithOutline.synopsis).toBe("Full story synopsis");
    expect(writeWithOutline.characters).toBeUndefined();
    expect(writeWithOutline.worldbuilding).toBeUndefined();
    expect(writeWithOutline.style).toBeUndefined();
    expect(writeWithOutline.genre).toBeUndefined();
  });

  it("PB-05: charactersVisibleToAI=false and worldbuildingVisibleToAI=false take precedence over contextNodes", () => {
    const hiddenBible: StoryBible = {
      ...SAMPLE_BIBLE,
      charactersVisibleToAI: false,
      worldbuildingVisibleToAI: false,
    };
    const deps = selectStoryBibleDependencies("write", hiddenBible, undefined, "", "auto", [
      "characters",
      "worldbuilding",
      "style",
    ]);
    expect(deps.characters).toBeUndefined();
    expect(deps.worldbuilding).toBeUndefined();
    expect(deps.style).toBe("Gritty third-person");
  });
});

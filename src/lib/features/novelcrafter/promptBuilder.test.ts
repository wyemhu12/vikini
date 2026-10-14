import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import {
  buildNovelcrafterSystemInstruction,
  buildNovelcrafterUserPrompt,
  DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS,
  resolveEffectivePersonaId,
  sanitizeStoryState,
  selectStoryBibleDependencies,
} from "./promptBuilder";
import { createDefaultStoryState, type NovelcrafterRoutingConfig, type StoryBible } from "./types";

const FULL_STORY_BIBLE: StoryBible = {
  braindump: "Braindump raw seed idea about an astral lighthouse keeper.",
  genre: "Cosmic Mystery / Sci-Fi",
  style: "Lyrical third-person limited, rich sensory metaphors.",
  synopsis: "Elara guards the edge of a collapsing star-reef and discovers a living signal.",
  characters: "Elara Vance: Stoic keeper. Kaelen: Rogue cartographer.",
  charactersVisibleToAI: true,
  worldbuilding: "The Star-Reef: A graveyard of ancient Dyson shards.",
  worldbuildingVisibleToAI: true,
  outline: "Act I: The Signal. Act II: The Descent. Act III: The Ignition.",
};

describe("Novelcrafter promptBuilder (TC-02, TC-03, TC-04)", () => {
  describe("resolveEffectivePersonaId (TC-02)", () => {
    const baseRouting: NovelcrafterRoutingConfig = {
      masterGemId: "gem-master",
      masterPersonaId: "p-master",
      featurePersonas: {
        bible: "inherit",
        write: "none",
        rewrite: "p-custom-editor",
        expand: "inherit",
        brainstorm: "inherit",
      },
    };

    it("resolves inherit to masterPersonaId (Case A)", () => {
      expect(resolveEffectivePersonaId("bible", baseRouting)).toBe("p-master");
    });

    it("resolves none to null even when masterPersonaId is present (Case B)", () => {
      expect(resolveEffectivePersonaId("write", baseRouting)).toBeNull();
    });

    it("resolves explicit slot persona ID when set (Case C)", () => {
      expect(resolveEffectivePersonaId("rewrite", baseRouting)).toBe("p-custom-editor");
    });

    it("returns null when slot is inherit but masterPersonaId is null or empty", () => {
      expect(
        resolveEffectivePersonaId("bible", {
          ...baseRouting,
          masterPersonaId: null,
        })
      ).toBeNull();
      expect(
        resolveEffectivePersonaId("bible", {
          ...baseRouting,
          masterPersonaId: "   ",
        })
      ).toBeNull();
    });
  });

  describe("buildNovelcrafterSystemInstruction — Layered Mode & No 12K Truncation (TC-03)", () => {
    it("places <task_instructions> first and <style_preferences> second without 12,000-char truncation", () => {
      const longMasterGem = "MASTER_GEM_RULE_".repeat(1000); // 16,000 chars (> 15,000)
      const result = buildNovelcrafterSystemInstruction({
        masterGemInstructions: longMasterGem,
        persona: {
          tone: "candid",
          useEmojis: false,
          useHeadersLists: true,
          userContext: "Sci-fi novelist",
          customInstructions: "Use vivid sensory verbs",
        },
      });

      expect(result.length).toBeGreaterThan(15_000);
      const taskIdx = result.indexOf("<task_instructions>");
      const styleIdx = result.indexOf("<style_preferences>");
      expect(taskIdx).toBe(0);
      expect(styleIdx).toBeGreaterThan(taskIdx);
      expect(result).toContain(longMasterGem);
      expect(result).toContain("NEVER override or contradict <task_instructions>");
      expect(result).toContain("Use vivid sensory verbs");
      expect(result).toContain("Sci-fi novelist");
    });

    it("omits <style_preferences> when persona is null and uses default instructions when masterGemInstructions is empty", () => {
      const result = buildNovelcrafterSystemInstruction({
        masterGemInstructions: "",
        persona: null,
      });
      expect(result).toContain("<task_instructions>");
      expect(result).toContain(DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS);
      expect(result).not.toContain("<style_preferences>");
    });
  });

  describe("Sudowrite 8-Node Dependency Graph & Visibility Settings (TC-04)", () => {
    it("Case 4A: bibleTarget='synopsis' includes ONLY braindump and genre", () => {
      const deps = selectStoryBibleDependencies("bible", FULL_STORY_BIBLE, "synopsis");
      expect(deps).toEqual({
        braindump: FULL_STORY_BIBLE.braindump,
        genre: FULL_STORY_BIBLE.genre,
      });

      const prompt = buildNovelcrafterUserPrompt({
        feature: "bible",
        bibleTarget: "synopsis",
        actionMode: "generate",
        storyBible: FULL_STORY_BIBLE,
      });
      expect(prompt).toContain("<braindump>");
      expect(prompt).toContain("<genre>");
      expect(prompt).not.toContain("<characters>");
      expect(prompt).not.toContain("<worldbuilding>");
      expect(prompt).not.toContain("<outline>");
    });

    it("Case 4B: falls back to braindump when synopsis is empty for steps requiring synopsis", () => {
      const bibleWithoutSynopsis: StoryBible = {
        ...FULL_STORY_BIBLE,
        synopsis: "   ",
        braindump: "Seed idea from braindump",
      };

      const deps = selectStoryBibleDependencies("bible", bibleWithoutSynopsis, "characters");
      expect(deps.synopsis).toBe("Seed idea from braindump");
      expect(deps.synopsisIsBraindumpFallback).toBe(true);

      const prompt = buildNovelcrafterUserPrompt({
        feature: "bible",
        bibleTarget: "characters",
        actionMode: "generate",
        storyBible: bibleWithoutSynopsis,
      });
      expect(prompt).toContain('<synopsis fallback="braindump">');
      expect(prompt).toContain("Seed idea from braindump");
    });

    it("Case 4C: respects charactersVisibleToAI=false and worldbuildingVisibleToAI=false", () => {
      const hiddenCharactersBible: StoryBible = {
        ...FULL_STORY_BIBLE,
        charactersVisibleToAI: false,
      };

      const prompt = buildNovelcrafterUserPrompt({
        feature: "bible",
        bibleTarget: "outline",
        actionMode: "generate",
        storyBible: hiddenCharactersBible,
      });

      expect(prompt).toContain("<genre>");
      expect(prompt).toContain("<synopsis>");
      expect(prompt).toContain("<worldbuilding>");
      expect(prompt).not.toContain("<characters>");
    });

    it("Case 4D: bibleTarget='draft' includes style, genre, characters, worldbuilding, and chapter scenes (no braindump/outline)", () => {
      const prompt = buildNovelcrafterUserPrompt({
        feature: "bible",
        bibleTarget: "draft",
        actionMode: "generate",
        storyBible: FULL_STORY_BIBLE,
        chapterTitle: "Chapter 1: The Signal",
        chapterScenes: "Beat 1: Elara hears the hum.\nBeat 2: She opens the hatch.",
      });

      expect(prompt).toContain("<style>");
      expect(prompt).toContain("<genre>");
      expect(prompt).toContain("<characters>");
      expect(prompt).toContain("<worldbuilding>");
      expect(prompt).toContain("<scenes>");
      expect(prompt).not.toContain("<braindump>");
      expect(prompt).not.toContain("<outline>");
    });

    it("Case 4E: rewrite & expand include <selected_text>, <chapter_context> capped at 8,000 chars, and throw ValidationError when selectedText is missing", () => {
      const longProse = "A".repeat(10_000);
      const prompt = buildNovelcrafterUserPrompt({
        feature: "rewrite",
        rewriteMode: "show_dont_tell",
        storyBible: FULL_STORY_BIBLE,
        chapterTitle: "Chapter 2",
        chapterProse: longProse,
        selectedText: "She was very afraid.",
      });

      expect(prompt).toContain("<selected_text>\nShe was very afraid.\n</selected_text>");
      expect(prompt).toContain("<preceding_prose>");
      expect(prompt).not.toContain("A".repeat(8_500));

      expect(() =>
        buildNovelcrafterUserPrompt({
          feature: "rewrite",
          storyBible: FULL_STORY_BIBLE,
          selectedText: "   ",
        })
      ).toThrowError(ValidationError);

      expect(() =>
        buildNovelcrafterUserPrompt({
          feature: "expand",
          storyBible: FULL_STORY_BIBLE,
          selectedText: "",
        })
      ).toThrowError(ValidationError);
    });

    it("throws ValidationError when rewriting an empty Story Bible section without customInstruction", () => {
      const emptySynopsisBible: StoryBible = {
        ...FULL_STORY_BIBLE,
        synopsis: "",
      };
      expect(() =>
        buildNovelcrafterUserPrompt({
          feature: "bible",
          bibleTarget: "synopsis",
          actionMode: "rewrite",
          storyBible: emptySynopsisBible,
          customInstruction: "",
        })
      ).toThrowError(ValidationError);
    });
  });

  describe("sanitizeStoryState", () => {
    it("repairs invalid activeChapterId or falls back to default state on malformed input", () => {
      const valid = createDefaultStoryState("Chương 1");
      const repaired = sanitizeStoryState({
        ...valid,
        activeChapterId: "non-existent-id",
      });
      expect(repaired.activeChapterId).toBe(valid.chapters[0].id);

      const fallback = sanitizeStoryState({ broken: true }, "Chương Mở Đầu");
      expect(fallback.chapters[0].title).toBe("Chương Mở Đầu");
    });
  });
});

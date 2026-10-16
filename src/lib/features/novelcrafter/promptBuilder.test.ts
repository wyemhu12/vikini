import { describe, expect, it } from "vitest";
import { z } from "zod";
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
  styleMode: "custom",
  pov: "third_person_limited",
  tense: "past",
  synopsis: "Elara guards the edge of a collapsing star-reef and discovers a living signal.",
  characters: "Elara Vance: Stoic keeper. Kaelen: Rogue cartographer.",
  charactersVisibleToAI: true,
  characterCards: [],
  worldbuilding: "The Star-Reef: A graveyard of ancient Dyson shards.",
  worldbuildingVisibleToAI: true,
  worldElements: [],
  outline: "Act I: The Signal. Act II: The Descent. Act III: The Ignition.",
  outlineItems: [],
};

describe("Novelcrafter promptBuilder (TC-02, TC-03, TC-04, TC-05)", () => {
  describe("resolveEffectivePersonaId (TC-02)", () => {
    const baseRouting: NovelcrafterRoutingConfig = {
      masterGemId: "gem-master",
      masterPersonaId: "p-master",
      featurePersonas: {
        bible: "inherit",
        write: "none",
        rewrite: "p-custom-editor",
        feedback: "inherit",
        expand: "inherit",
        brainstorm: "inherit",
      },
    };

    it("resolves inherit to masterPersonaId (Case A)", () => {
      expect(resolveEffectivePersonaId("bible", baseRouting)).toBe("p-master");
      expect(resolveEffectivePersonaId("feedback", baseRouting)).toBe("p-master");
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
      expect(result).toContain("<studio_context>");
      expect(result).not.toContain("<style_preferences>");

      const withCustomGem = buildNovelcrafterSystemInstruction({
        masterGemInstructions: "Custom chat GEM prompt",
        persona: null,
      });
      expect(withCustomGem).toContain("Custom chat GEM prompt");
      expect(withCustomGem).toContain("<studio_context>");
    });
  });

  describe("Sudowrite 8-Node Dependency Graph & Visibility Settings (TC-04 & TC-05)", () => {
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

    it("Case 4D: bibleTarget='draft' includes style, genre, characters, worldbuilding, POV/Tense, and chapter scenes (no braindump/outline)", () => {
      const prompt = buildNovelcrafterUserPrompt({
        feature: "bible",
        bibleTarget: "draft",
        actionMode: "generate",
        storyBible: FULL_STORY_BIBLE,
        chapterTitle: "Chapter 1: The Signal",
        chapterScenes: "Beat 1: Elara hears the hum.\nBeat 2: She opens the hatch.",
        chapterExtraInstructions: "Keep the pacing tense.",
      });

      expect(prompt).toContain("<style>");
      expect(prompt).toContain("<genre>");
      expect(prompt).toContain("<narrative_pov_and_tense>");
      expect(prompt).toContain("<characters>");
      expect(prompt).toContain("<worldbuilding>");
      expect(prompt).toContain("<scenes>");
      expect(prompt).toContain("Keep the pacing tense.");
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

    it("TC-05 Case 5A & 5B: builds Feedback and Write Tone Shift user prompts with <narrative_pov_and_tense> and <key_details>", () => {
      const feedbackPrompt = buildNovelcrafterUserPrompt({
        feature: "feedback",
        feedbackMode: "developmental",
        feedbackCriteria: ["consistency", "pacing"],
        storyBible: { ...FULL_STORY_BIBLE, pov: "first_person", tense: "present" },
        chapterTitle: "Chapter 1",
        chapterProse: "I opened the hatch and looked out at the stars.",
      });

      expect(feedbackPrompt).toContain("POV: 1st Person (I/We) | Tense: Present Tense");
      expect(feedbackPrompt).toContain("<preceding_prose>");
      expect(feedbackPrompt).toContain("<feedback_item>");

      const writePrompt = buildNovelcrafterUserPrompt({
        feature: "write",
        writeMode: "tone_shift",
        toneShift: "ominous",
        writeLengthWords: 600,
        keyDetails: "Elara's lantern is running out of oil.",
        storyBible: FULL_STORY_BIBLE,
        chapterProse: "The corridor darkened.",
      });

      expect(writePrompt).toContain(
        "<key_details>\nElara's lantern is running out of oil.\n  </key_details>"
      );
      expect(writePrompt).toContain("600 words");
      expect(writePrompt).toContain("Ominous");
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

  describe("sanitizeStoryState & 2-Way Rollback Compatibility (TC-05 Cases 5C & 5D — M21, M22)", () => {
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

    it("TC-05 Case 5C & 5D (M21, M22): preserves v42 across legacy 1d78761 fixtures, malformed single cards, and instant rollback to strict 1d78761 schema", () => {
      // (1) Legacy 1d78761 fixture (missing feedback slot, missing pov/tense/styleMode/feedbackItems/extraInstructions)
      const legacyV42Fixture = {
        version: 42,
        selectedModel: "gemini-3-flash-preview",
        isStoryBibleOpen: false,
        activeChapterId: "ch-1",
        storyBible: {
          braindump: "Legacy braindump",
          genre: "Sci-Fi",
          style: "Crisp",
          synopsis: "Legacy synopsis",
          characters: "Hero",
          charactersVisibleToAI: true,
          worldbuilding: "World",
          worldbuildingVisibleToAI: true,
          outline: "Act 1",
        },
        chapters: [
          {
            id: "ch-1",
            title: "Chapter 1",
            scenes: "Scene 1",
            content: "Preserved chapter content v42",
            updatedAt: 99_000,
          },
        ],
        routing: {
          masterGemId: null,
          masterPersonaId: null,
          featurePersonas: {
            bible: "inherit",
            write: "inherit",
            rewrite: "inherit",
            expand: "inherit",
            brainstorm: "inherit",
          },
        },
        historyCards: [],
        updatedAt: 99_000,
      };

      const forwardParsed = sanitizeStoryState(legacyV42Fixture);
      expect(forwardParsed.version).toBe(42);
      expect(forwardParsed.chapters[0].content).toBe("Preserved chapter content v42");
      expect(forwardParsed.routing.featurePersonas.feedback).toBe("inherit");
      expect(forwardParsed.storyBible.pov).toBe("third_person_limited");

      // (2) Single malformed historyCard or feedbackItem is filtered without resetting v42 to v1
      const withMalformedCard = sanitizeStoryState({
        ...forwardParsed,
        historyCards: [
          {
            id: "bad-card",
            feature: "unknown_invalid_slot",
            content: "x",
            model: "m",
            createdAt: 1,
          },
          {
            id: "good-card",
            feature: "rewrite",
            subSlot: "feedback",
            subLabel: "Feedback · Developmental",
            content: "Valid summary",
            model: "gemini-3-flash-preview",
            createdAt: 2,
          },
        ],
      });
      expect(withMalformedCard.version).toBe(42);
      expect(withMalformedCard.historyCards).toHaveLength(1);
      expect(withMalformedCard.historyCards[0].id).toBe("good-card");

      // (3) Instant Rollback to strict 1d78761 production schema after user ran Feedback (M22)
      const Strict1d78761Schema = z.object({
        version: z.number().int().nonnegative(),
        selectedModel: z.string().min(1).max(100),
        isStoryBibleOpen: z.boolean().default(true),
        activeChapterId: z.string().min(1).max(100),
        storyBible: z.object({
          braindump: z.string().max(50_000).default(""),
          genre: z.string().max(2_000).default(""),
          style: z.string().max(10_000).default(""),
          synopsis: z.string().max(30_000).default(""),
          characters: z.string().max(50_000).default(""),
          charactersVisibleToAI: z.boolean().default(true),
          worldbuilding: z.string().max(50_000).default(""),
          worldbuildingVisibleToAI: z.boolean().default(true),
          outline: z.string().max(50_000).default(""),
        }),
        chapters: z
          .array(
            z.object({
              id: z.string().min(1).max(100),
              title: z.string().min(1).max(200),
              scenes: z.string().max(30_000).default(""),
              content: z.string().max(150_000).default(""),
              updatedAt: z.number().int().nonnegative(),
            })
          )
          .min(1),
        routing: z.object({
          masterGemId: z.string().max(100).nullable().default(null),
          masterPersonaId: z.string().max(100).nullable().default(null),
          featurePersonas: z.object({
            bible: z.string().min(1).max(100).default("inherit"),
            write: z.string().min(1).max(100).default("inherit"),
            rewrite: z.string().min(1).max(100).default("inherit"),
            expand: z.string().min(1).max(100).default("inherit"),
            brainstorm: z.string().min(1).max(100).default("inherit"),
          }),
        }),
        historyCards: z.array(
          z.object({
            id: z.string().min(1).max(100),
            feature: z.enum(["bible", "write", "rewrite", "expand", "brainstorm"]),
            subLabel: z.string().max(200).optional(),
            content: z.string().max(150_000),
            model: z.string().max(100),
            createdAt: z.number().int().nonnegative(),
          })
        ),
        updatedAt: z.number().int().nonnegative(),
      });

      const stateAfterFeedback = {
        ...withMalformedCard,
        chapters: [
          {
            ...withMalformedCard.chapters[0],
            extraInstructions: "Extra chapter instruction",
            feedbackItems: [
              {
                id: "fb-1",
                category: "CONSISTENCY",
                quote: "Preserved chapter",
                comment: "Check consistency",
                suggestion: "Updated chapter",
                status: "open" as const,
                createdAt: 100,
              },
            ],
          },
        ],
      };

      const rollbackParsed = Strict1d78761Schema.safeParse(stateAfterFeedback);
      expect(rollbackParsed.success).toBe(true);
      if (rollbackParsed.success) {
        expect(rollbackParsed.data.version).toBe(42);
        expect(rollbackParsed.data.chapters[0].content).toBe("Preserved chapter content v42");
      }
    });
  });
});

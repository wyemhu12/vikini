// /lib/features/novelcrafter/streamRequestBody.test.ts
import { describe, expect, it } from "vitest";
import { createDefaultPromptStudioSettings, setActionOverride } from "./promptStudioSettings";
import { buildNovelcrafterStreamRequestBody } from "./streamRequestBody";
import { createDefaultStoryState } from "./types";

describe("streamRequestBody (RB-01..RB-05)", () => {
  const baseStory = createDefaultStoryState();
  baseStory.storyBible.synopsis = "Main synopsis";
  baseStory.storyBible.outline = "Main outline";
  const activeChapter = baseStory.chapters[0];

  const baseOptions = {
    selectedModel: baseStory.selectedModel,
    routing: baseStory.routing,
    storyBible: baseStory.storyBible,
    chapterTitle: activeChapter.title,
    chapterScenes: activeChapter.scenes,
    chapterProse: activeChapter.content,
    previousChapterProseTail: "",
    previousChapterSummaries: "",
  };

  it("RB-01: omits promptDirectiveOverride and contextNodes when action uses default settings", () => {
    const body = buildNovelcrafterStreamRequestBody({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      options: baseOptions,
      params: { feature: "write", writeMode: "auto" },
      promptSettings: createDefaultPromptStudioSettings(),
    });

    expect(body.promptDirectiveOverride).toBeUndefined();
    expect(body.contextNodes).toBeUndefined();
  });

  it("RB-02 & RB-03: attaches promptDirectiveOverride and contextNodes from Prompt Studio settings and preserves synopsis/outline in pruned storyBible", () => {
    let settings = createDefaultPromptStudioSettings();
    settings = setActionOverride(settings, "write:auto", {
      directive: "Custom Auto Directive",
      contextNodes: ["synopsis", "outline", "preceding_prose"],
    });

    const body = buildNovelcrafterStreamRequestBody({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      options: baseOptions,
      params: { feature: "write", writeMode: "auto" },
      promptSettings: settings,
    });

    expect(body.promptDirectiveOverride).toBe("Custom Auto Directive");
    expect(body.contextNodes).toEqual(["synopsis", "outline", "preceding_prose"]);
    expect(body.storyBible.synopsis).toBe("Main synopsis");
    expect(body.storyBible.outline).toBe("Main outline");
  });

  it("RB-04: passes custom writeLengthWords (e.g., 1850) into stream request body", () => {
    const body = buildNovelcrafterStreamRequestBody({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      options: baseOptions,
      params: { feature: "write", writeMode: "auto", writeLengthWords: 1850 },
      promptSettings: createDefaultPromptStudioSettings(),
    });

    expect(body.writeLengthWords).toBe(1850);
  });

  it("TC-03: sends per-feature overridden model when featureModels specifies one, while inherit keeps selectedModel", () => {
    const routingWithModels = {
      ...baseOptions.routing,
      featureModels: {
        bible: "inherit",
        write: "inherit",
        rewrite: "inherit",
        feedback: "gemini-3.8-flash",
        expand: "inherit",
        brainstorm: "inherit",
      },
    };

    const feedbackBody = buildNovelcrafterStreamRequestBody({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      options: { ...baseOptions, routing: routingWithModels },
      params: { feature: "feedback", feedbackMode: "developmental" },
      promptSettings: createDefaultPromptStudioSettings(),
    });
    expect(feedbackBody.model).toBe("gemini-3.8-flash");

    const writeBody = buildNovelcrafterStreamRequestBody({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      options: { ...baseOptions, routing: routingWithModels },
      params: { feature: "write", writeMode: "auto" },
      promptSettings: createDefaultPromptStudioSettings(),
    });
    expect(writeBody.model).toBe(baseStory.selectedModel);
  });
});

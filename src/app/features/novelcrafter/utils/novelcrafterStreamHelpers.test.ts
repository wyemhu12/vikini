import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import { NovelcrafterStreamRunRegistry } from "@/lib/features/novelcrafter/streamRunRegistry";
import { createRafStreamBatcher } from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import { toast } from "@/lib/store/toastStore";
import {
  createInitialStreamingMeta,
  applyMetaSseEvent,
  parseStreamHttpError,
  createNovelcrafterHistoryCard,
  resolveNovelcrafterTargetStory,
  runNovelcrafterSseStream,
  finalizeNovelcrafterStreamRun,
} from "./novelcrafterStreamHelpers";
import type {
  TriggerNovelcrafterStreamParams,
  UseNovelcrafterStreamOptions,
} from "./novelcrafterStreamTypes";

function makeStreamBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

function makeBaseOptions(
  overrides: Partial<UseNovelcrafterStreamOptions> = {}
): UseNovelcrafterStreamOptions {
  const story = createDefaultStoryState("Chapter 1");
  return {
    selectedConversationId: "story-1",
    ensureStoryConversation: vi.fn().mockResolvedValue("story-new"),
    selectedModel: "gemini-2.5-flash",
    routing: story.routing,
    storyBible: story.storyBible,
    activeChapterId: story.activeChapterId,
    chapterTitle: "Chapter 1",
    chapterScenes: "Beat 1",
    chapterProse: "",
    previousChapterProseTail: "",
    streamCutoffWarning: "Stream cut off",
    onCardCompleted: vi.fn(),
    ...overrides,
  };
}

describe("novelcrafterStreamHelpers (CT-6C-03)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("createInitialStreamingMeta & applyMetaSseEvent build and update metadata safely", () => {
    const trigger: TriggerNovelcrafterStreamParams = {
      feature: "write",
      subLabel: "Continue",
      bibleTarget: "synopsis",
    };
    const initial = createInitialStreamingMeta("gemini-2.5-flash", trigger);
    expect(initial).toEqual({
      model: "gemini-2.5-flash",
      gemName: null,
      personaName: null,
      feature: "write",
      subLabel: "Continue",
      bibleTarget: "synopsis",
    });

    const applied = applyMetaSseEvent(
      {
        model: "claude-sonnet",
        routedModel: "  openrouter/x  ",
        gemName: "Editor",
        personaName: "Narrator",
      },
      "fallback-model",
      trigger
    );
    expect(applied.resolvedModel).toBe("claude-sonnet");
    expect(applied.routedModel).toBe("openrouter/x");
    expect(applied.resolvedGemName).toBe("Editor");
    expect(applied.resolvedPersonaName).toBe("Narrator");
    expect(applied.nextMeta.routedModel).toBe("openrouter/x");
  });

  it("parseStreamHttpError prefers JSON error.message and falls back to HTTP status", async () => {
    const jsonRes = new Response(JSON.stringify({ error: { message: "Quota reached" } }), {
      status: 429,
    });
    expect(await parseStreamHttpError(jsonRes)).toBe("Quota reached");

    const textRes = new Response("Bad Gateway", { status: 502 });
    expect(await parseStreamHttpError(textRes)).toBe("HTTP 502");
  });

  it("createNovelcrafterHistoryCard maps feedback feature to rewrite + subSlot feedback", () => {
    const card = createNovelcrafterHistoryCard({
      triggerParams: { feature: "feedback", subLabel: "Critique" },
      activeChapterId: "ch-1",
      content: "  Great pacing!  ",
      thinking: "  Checking pacing ",
      model: "gemini-2.5-flash",
      routedModel: "gemini-2.5-pro",
      finishReason: "stop",
      gemName: null,
      personaName: "Coach",
      nowMs: 12345,
    });
    expect(card.feature).toBe("rewrite");
    expect(card.subSlot).toBe("feedback");
    expect(card.content).toBe("Great pacing!");
    expect(card.thinking).toBe("Checking pacing");
    expect(card.routedModel).toBe("gemini-2.5-pro");
    expect(card.createdAt).toBe(12345);
  });

  it("resolveNovelcrafterTargetStory promotes pending run story and resets isPromotingStoryRef on failure", async () => {
    const registry = new NovelcrafterStreamRunRegistry();
    const runId = registry.startRun({
      targetStoryId: null,
      targetChapterId: "ch-1",
      feature: "write",
    })!;
    const isPromotingStoryRef = { current: false };

    const ensured = await resolveNovelcrafterTargetStory({
      runId,
      initialStoryId: null,
      ensureStoryConversation: vi.fn().mockResolvedValue("story-42"),
      registry,
      isPromotingStoryRef,
    });
    expect(ensured).toBe("story-42");
    expect(isPromotingStoryRef.current).toBe(false);
    expect(registry.getTarget(runId)?.targetStoryId).toBe("story-42");

    const failed = await resolveNovelcrafterTargetStory({
      runId,
      initialStoryId: null,
      ensureStoryConversation: vi.fn().mockRejectedValue(new Error("DB error")),
      registry,
      isPromotingStoryRef,
    });
    expect(failed).toBeNull();
    expect(isPromotingStoryRef.current).toBe(false);
  });

  it("runNovelcrafterSseStream processes meta/thinking/token/done and flags cutoff without done", async () => {
    const registry = new NovelcrafterStreamRunRegistry();
    const runId = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    })!;
    const controller = new AbortController();
    const options = makeBaseOptions();
    const onMetaUpdated = vi.fn();
    const batcher = createRafStreamBatcher(runId, vi.fn());

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            makeStreamBody([
              'event: meta\ndata: {"model":"gemini-2.5-pro","gemName":"Prose"}\n\n',
              'event: thinking\ndata: {"t":"Plan"}\n\n',
              'event: token\ndata: {"t":"Once upon a time."}\n\n',
            ]),
            { status: 200 }
          )
        )
    );

    const res = await runNovelcrafterSseStream({
      runId,
      targetConversationId: "story-1",
      effectiveSlotModel: "gemini-2.5-flash",
      controller,
      options,
      triggerParams: { feature: "write" },
      registry,
      batcher,
      onMetaUpdated,
    });

    expect(res.resolvedModel).toBe("gemini-2.5-pro");
    expect(res.resolvedGemName).toBe("Prose");
    expect(res.fullThinking).toBe("Plan");
    expect(res.fullContent).toBe("Once upon a time.");
    expect(res.pendingWarningToast).toBe("Stream cut off");
    expect(onMetaUpdated).toHaveBeenCalledTimes(1);
  });

  it("runNovelcrafterSseStream records error on non-OK HTTP and stopped on abort", async () => {
    const registry = new NovelcrafterStreamRunRegistry();
    const runId = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    })!;
    const options = makeBaseOptions();
    const batcher = createRafStreamBatcher(runId, vi.fn());

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "Rate limited" } }), { status: 429 })
        )
    );
    const errRes = await runNovelcrafterSseStream({
      runId,
      targetConversationId: "story-1",
      effectiveSlotModel: "gemini-2.5-flash",
      controller: new AbortController(),
      options,
      triggerParams: { feature: "write" },
      registry,
      batcher,
      onMetaUpdated: vi.fn(),
    });
    expect(errRes.terminationReason).toBe("error");
    expect(errRes.pendingErrorToast).toBe("Rate limited");

    const abortedController = new AbortController();
    abortedController.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new DOMException("Aborted", "AbortError"))
    );
    const abortRes = await runNovelcrafterSseStream({
      runId,
      targetConversationId: "story-1",
      effectiveSlotModel: "gemini-2.5-flash",
      controller: abortedController,
      options,
      triggerParams: { feature: "write" },
      registry,
      batcher,
      onMetaUpdated: vi.fn(),
    });
    expect(abortRes.terminationReason).toBe("stopped");
    expect(abortRes.finishReason).toBe("aborted");
  });

  it("finalizeNovelcrafterStreamRun skips card/toasts on refusal and emits card on valid output", () => {
    const registry = new NovelcrafterStreamRunRegistry();
    const runId = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    })!;
    const onCardCompleted = vi.fn();
    const onStreamTerminated = vi.fn().mockReturnValue({ handledRefusal: false });
    const setIsStreaming = vi.fn();
    const toastWarn = vi.spyOn(toast, "warning").mockImplementation(() => "w");

    finalizeNovelcrafterStreamRun({
      runId,
      targetConversationId: "story-1",
      controller: new AbortController(),
      registry,
      batcher: createRafStreamBatcher(runId, vi.fn()),
      options: makeBaseOptions({ onCardCompleted, onStreamTerminated }),
      triggerParams: { feature: "write", subLabel: "Draft" },
      result: {
        fullContent: "The lantern flickered in the rain.",
        fullThinking: "",
        resolvedModel: "gemini-2.5-flash",
        resolvedGemName: null,
        resolvedPersonaName: null,
        finishReason: "stop",
        terminationReason: "completed",
        pendingErrorToast: null,
        pendingWarningToast: "Cutoff warning",
      },
      setIsStreaming,
    });

    expect(setIsStreaming).toHaveBeenCalledWith(false);
    expect(onStreamTerminated).toHaveBeenCalledTimes(1);
    expect(toastWarn).toHaveBeenCalledWith("Cutoff warning");
    expect(onCardCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "The lantern flickered in the rain.",
        feature: "write",
      })
    );

    // Refusal handled by onStreamTerminated suppresses error toast and card creation
    const runId2 = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "write",
    })!;
    onCardCompleted.mockClear();
    const toastErr = vi.spyOn(toast, "error").mockImplementation(() => "e");
    finalizeNovelcrafterStreamRun({
      runId: runId2,
      targetConversationId: "story-1",
      controller: new AbortController(),
      registry,
      batcher: createRafStreamBatcher(runId2, vi.fn()),
      options: makeBaseOptions({
        onCardCompleted,
        onStreamTerminated: vi.fn().mockReturnValue({ handledRefusal: true }),
      }),
      triggerParams: { feature: "write" },
      result: {
        fullContent: "I cannot fulfill this request.",
        fullThinking: "",
        resolvedModel: "gemini-2.5-flash",
        resolvedGemName: null,
        resolvedPersonaName: null,
        finishReason: "stop",
        terminationReason: "completed",
        pendingErrorToast: "Blocked",
        pendingWarningToast: null,
      },
      setIsStreaming,
    });
    expect(toastErr).not.toHaveBeenCalled();
    expect(onCardCompleted).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPostStream } from "./post-processing";
import type { ChatStreamParams } from "./types";

describe("processPostStream (M-1, M-9, m-16)", () => {
  let appendToContext: ChatStreamParams["appendToContext"];
  let upsertAssistantMessage: ChatStreamParams["upsertAssistantMessage"];
  let setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  let generateFinalTitle: ChatStreamParams["generateFinalTitle"];
  let controller: ReadableStreamDefaultController<Uint8Array>;

  beforeEach(() => {
    appendToContext = vi.fn().mockResolvedValue(undefined);
    upsertAssistantMessage = vi.fn().mockResolvedValue({});
    setConversationAutoTitle = vi.fn().mockResolvedValue(undefined);
    generateFinalTitle = vi.fn().mockResolvedValue("New Title");
    controller = {
      enqueue: vi.fn(),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
  });

  const baseParams = {
    isActuallyBlocked: false,
    shouldGenerateTitle: true,
    conversationId: "conv-1",
    userId: "user-1",
    contextMessages: [],
    content: "user query",
    model: "gemini-3-flash-preview",
  };

  it("persists normal response and triggers title generation", async () => {
    await processPostStream(controller, {
      ...baseParams,
      full: "Hello world response",
      appendToContext,
      upsertAssistantMessage,
      setConversationAutoTitle,
      generateFinalTitle,
    });

    expect(upsertAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Hello world response",
      })
    );
    expect(appendToContext).toHaveBeenCalledTimes(1);
    expect(generateFinalTitle).toHaveBeenCalledTimes(1);
    expect(setConversationAutoTitle).toHaveBeenCalledWith("user-1", "conv-1", "New Title");
  });

  it("persists empty content with meta.reasoning when content is empty (M-1, M-9, m-16)", async () => {
    await processPostStream(controller, {
      ...baseParams,
      full: "",
      reasoning: "Thought for a while but hit token limit",
      emptyAnswerReason: "length",
      appendToContext,
      upsertAssistantMessage,
      setConversationAutoTitle,
      generateFinalTitle,
    });

    expect(upsertAssistantMessage).toHaveBeenCalledWith({
      conversationId: "conv-1",
      userId: "user-1",
      role: "assistant",
      content: "",
      meta: {
        reasoning: "Thought for a while but hit token limit",
        model: "gemini-3-flash-preview",
        emptyAnswerReason: "length",
      },
    });

    // Invariant: Do NOT append to context when content is empty (m-16)
    expect(appendToContext).not.toHaveBeenCalled();
    // Invariant: Do NOT generate title when content is empty
    expect(generateFinalTitle).not.toHaveBeenCalled();
    expect(setConversationAutoTitle).not.toHaveBeenCalled();
  });

  it("returns early without saving message when both content and reasoning are empty", async () => {
    await processPostStream(controller, {
      ...baseParams,
      full: "   ",
      reasoning: "   ",
      appendToContext,
      upsertAssistantMessage,
      setConversationAutoTitle,
      generateFinalTitle,
    });

    expect(upsertAssistantMessage).not.toHaveBeenCalled();
    expect(appendToContext).not.toHaveBeenCalled();
  });

  it("merges extraMeta (thinkingStats) into persisted assistant message meta (TC-40)", async () => {
    const thinkingStats = {
      tokens: 128,
      durationMs: 4200,
      effort: "low" as const,
      truncated: false,
    };

    await processPostStream(controller, {
      ...baseParams,
      model: "strata-local",
      full: "Final local answer",
      reasoning: "Step by step reasoning",
      extraMeta: { thinkingStats },
      appendToContext,
      upsertAssistantMessage,
      setConversationAutoTitle,
      generateFinalTitle,
    });

    expect(upsertAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Final local answer",
        meta: expect.objectContaining({
          reasoning: "Step by step reasoning",
          model: "strata-local",
          thinkingStats,
        }),
      })
    );
  });
});

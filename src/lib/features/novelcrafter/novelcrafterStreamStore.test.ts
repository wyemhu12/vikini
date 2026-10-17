// /lib/features/novelcrafter/novelcrafterStreamStore.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { createRafStreamBatcher, useNovelcrafterStreamStore } from "./novelcrafterStreamStore";

describe("useNovelcrafterStreamStore & createRafStreamBatcher", () => {
  beforeEach(() => {
    useNovelcrafterStreamStore.getState().resetStreamStore();
  });

  it("manages stream lifecycle and flushes batched tokens via createRafStreamBatcher (TC-09)", () => {
    const store = useNovelcrafterStreamStore.getState();
    store.beginStreamRun("run-1", {
      feature: "write",
      subLabel: "Auto Write",
      model: "gemini-2.5-flash",
      gemName: null,
      personaName: null,
    });

    expect(useNovelcrafterStreamStore.getState().isStreaming).toBe(true);
    expect(useNovelcrafterStreamStore.getState().activeRunId).toBe("run-1");

    const batcher = createRafStreamBatcher("run-1", (runId, text, thinking) => {
      useNovelcrafterStreamStore.getState().flushStreamSnapshot(runId, text, thinking);
    });

    batcher.scheduleUpdate("Hello world", "Thinking step 1");
    batcher.flushNow();

    expect(useNovelcrafterStreamStore.getState().streamingText).toBe("Hello world");
    expect(useNovelcrafterStreamStore.getState().streamingThinking).toBe("Thinking step 1");

    useNovelcrafterStreamStore.getState().updateStreamMeta("run-1", {
      gemName: "Storyteller Gem",
    });
    expect(useNovelcrafterStreamStore.getState().streamingMeta?.gemName).toBe("Storyteller Gem");

    // Ignores updates from a mismatched runId
    useNovelcrafterStreamStore.getState().flushStreamSnapshot("run-stale", "Ignored", "");
    expect(useNovelcrafterStreamStore.getState().streamingText).toBe("Hello world");

    useNovelcrafterStreamStore.getState().finishStreamRun("run-1");
    expect(useNovelcrafterStreamStore.getState().isStreaming).toBe(false);
    expect(useNovelcrafterStreamStore.getState().activeRunId).toBeNull();
  });

  it("resets store state cleanly on resetStreamStore()", () => {
    useNovelcrafterStreamStore.getState().beginStreamRun("run-2", {
      feature: "brainstorm",
      model: "gemini-2.5-flash",
      gemName: null,
      personaName: null,
    });
    useNovelcrafterStreamStore.getState().flushStreamSnapshot("run-2", "Partial", "Thought");

    useNovelcrafterStreamStore.getState().resetStreamStore();

    const after = useNovelcrafterStreamStore.getState();
    expect(after.isStreaming).toBe(false);
    expect(after.activeRunId).toBeNull();
    expect(after.streamingText).toBe("");
    expect(after.streamingThinking).toBe("");
    expect(after.streamingMeta).toBeNull();
  });
});

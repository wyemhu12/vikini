// /lib/features/novelcrafter/streamRunRegistry.test.ts
import { describe, expect, it } from "vitest";
import {
  NovelcrafterStreamRunRegistry,
  shouldAbortStreamOnConversationChange,
} from "./streamRunRegistry";

describe("NovelcrafterStreamRunRegistry", () => {
  it("starts a run, promotes pending story ID, and ends the run cleanly (TC-09)", () => {
    const registry = new NovelcrafterStreamRunRegistry();
    expect(registry.isBusy()).toBe(false);

    const runId = registry.startRun({
      targetStoryId: null,
      targetChapterId: "ch-1",
      feature: "write",
      subLabel: "Auto Write",
    });

    expect(runId).not.toBeNull();
    expect(registry.isBusy()).toBe(true);
    expect(registry.getActiveRunId()).toBe(runId);

    // Rejects concurrent startRun while busy
    expect(
      registry.startRun({
        targetStoryId: "story-2",
        targetChapterId: "ch-1",
        feature: "rewrite",
      })
    ).toBeNull();

    const promoted = registry.promotePendingRunStory(runId!, "story-99");
    expect(promoted).toBe(true);
    expect(registry.getTarget(runId!)?.targetStoryId).toBe("story-99");

    const endedCurrent = registry.endRun(runId!);
    expect(endedCurrent).toBe(true);
    expect(registry.isBusy()).toBe(false);
    expect(registry.getTarget(runId!)).toBeNull();
  });

  it("resets active run state completely on reset()", () => {
    const registry = new NovelcrafterStreamRunRegistry();
    const runId = registry.startRun({
      targetStoryId: "story-1",
      targetChapterId: "ch-1",
      feature: "bible",
      bibleTarget: "synopsis",
    });
    expect(runId).not.toBeNull();

    registry.reset();
    expect(registry.isBusy()).toBe(false);
    expect(registry.getActiveRunId()).toBeNull();
    expect(registry.endRun(runId!)).toBe(false);
  });
});

describe("shouldAbortStreamOnConversationChange", () => {
  it("does not abort when promoting a newly created story from null -> newStoryId (TC-04)", () => {
    // Case 4A: activeTargetStoryId already promoted to story-1
    expect(
      shouldAbortStreamOnConversationChange({
        prevStoryId: null,
        nextStoryId: "story-1",
        activeTargetStoryId: "story-1",
        isPromotingPendingStory: false,
      })
    ).toBe(false);

    // Case 4B: React commits selectedConversationId while ensureStoryConversation is still promoting
    expect(
      shouldAbortStreamOnConversationChange({
        prevStoryId: null,
        nextStoryId: "story-1",
        activeTargetStoryId: null,
        isPromotingPendingStory: true,
      })
    ).toBe(false);
  });

  it("aborts when user manually switches to another story without pending promotion (TC-04)", () => {
    // Case 4C: user selects an unrelated story from null when not promoting
    expect(
      shouldAbortStreamOnConversationChange({
        prevStoryId: null,
        nextStoryId: "story-other",
        activeTargetStoryId: null,
        isPromotingPendingStory: false,
      })
    ).toBe(true);

    // Switching between two distinct non-null stories always aborts
    expect(
      shouldAbortStreamOnConversationChange({
        prevStoryId: "story-1",
        nextStoryId: "story-2",
        activeTargetStoryId: "story-1",
        isPromotingPendingStory: false,
      })
    ).toBe(true);
  });

  it("returns false when prevStoryId and nextStoryId are identical", () => {
    expect(
      shouldAbortStreamOnConversationChange({
        prevStoryId: "story-1",
        nextStoryId: "story-1",
        activeTargetStoryId: "story-1",
      })
    ).toBe(false);
  });
});

// /lib/features/novelcrafter/storySyncCoordinator.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  isStaleStoryStateErrorResponse,
  NovelcrafterSyncCoordinator,
  resolveSaveFailurePresentation,
  shouldApplyRemoteStoryLoad,
} from "./storySyncCoordinator";
import { createDefaultStoryState, STALE_STORY_STATE_MESSAGE } from "./types";

describe("NovelcrafterSyncCoordinator & Save Helpers (TC-01 & TC-06)", () => {
  it("TC-01 Case 1A: isolates per-story single-flight queues so switching stories never leaks version", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    coordinator.seedServerMeta("story-A", { version: 2, updatedAt: 1000 });
    coordinator.seedServerMeta("story-B", { version: 5, updatedAt: 5000 });

    const stateA = { ...createDefaultStoryState(), version: 2, updatedAt: 1100 };
    const stateB = { ...createDefaultStoryState(), version: 5, updatedAt: 5100 };

    let resolvePutA!: () => void;
    const putAPromise = new Promise<void>((res) => {
      resolvePutA = res;
    });

    const sendPutA = vi.fn(async (_id: string, prepared) => {
      await putAPromise;
      return {
        status: "saved" as const,
        savedState: { ...prepared, version: prepared.version + 1, updatedAt: 1200 },
      };
    });

    const sendPutB = vi.fn(async (_id: string, prepared) => ({
      status: "saved" as const,
      savedState: { ...prepared, version: prepared.version + 1, updatedAt: 5200 },
    }));

    const flightA = coordinator.enqueueSave("story-A", stateA, sendPutA);
    const outcomeB = await coordinator.enqueueSave("story-B", stateB, sendPutB);

    expect(sendPutB).toHaveBeenCalledTimes(1);
    expect(sendPutB.mock.calls[0]?.[1].version).toBe(5);
    expect(outcomeB).toEqual({
      status: "saved",
      version: 6,
      updatedAt: 5200,
      ackedSnapshotUpdatedAt: 5100,
    });

    resolvePutA();
    const outcomeA = await flightA;
    expect(outcomeA.status).toBe("saved");
    expect(coordinator.getServerMeta("story-A")?.version).toBe(3);
    expect(coordinator.getServerMeta("story-B")?.version).toBe(6);
  });

  it("TC-01 Case 1B: deduplicates concurrent ensureStory calls onto a single shared promise", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    const createFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "new-story-uuid";
    });

    const [id1, id2] = await Promise.all([
      coordinator.ensureStory(["existing-1"], createFn),
      coordinator.ensureStory(["existing-1"], createFn),
    ]);

    expect(createFn).toHaveBeenCalledTimes(1);
    expect(id1).toBe("new-story-uuid");
    expect(id2).toBe("new-story-uuid");
    expect(coordinator.isCreatingStory()).toBe(false);
  });

  it("TC-01 Case 1C: converts 429 rate_limited into retryAfterMs", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    const state = createDefaultStoryState();

    const outcome = await coordinator.enqueueSave("story-1", state, async () => ({
      status: "rate_limited",
      retryAfterSeconds: 4,
    }));

    expect(outcome).toEqual({
      status: "rate_limited",
      retryAfterMs: 4000,
    });
  });

  it("TC-01 Case 1D (M10): stamps BOTH version AND updatedAt on queued PUT when server clock is ahead", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    coordinator.seedServerMeta("story-1", { version: 1, updatedAt: 1000 });

    const s1 = { ...createDefaultStoryState(), version: 1, updatedAt: 1100 };
    const s2 = { ...createDefaultStoryState(), version: 1, updatedAt: 1200 };

    let releaseFirstPut!: () => void;
    const firstPutGate = new Promise<void>((res) => {
      releaseFirstPut = res;
    });

    const receivedStates: Array<{ version: number; updatedAt: number }> = [];
    const sendPut = vi.fn(async (_id: string, prepared) => {
      receivedStates.push({ version: prepared.version, updatedAt: prepared.updatedAt });
      if (receivedStates.length === 1) {
        await firstPutGate;
        // Server clock is ahead at 1300 (> s2.updatedAt = 1200)
        return {
          status: "saved" as const,
          savedState: { ...prepared, version: 2, updatedAt: 1300 },
        };
      }
      return {
        status: "saved" as const,
        savedState: { ...prepared, version: 3, updatedAt: 1400 },
      };
    });

    const p1 = coordinator.enqueueSave("story-1", s1, sendPut);
    const p2 = coordinator.enqueueSave("story-1", s2, sendPut);
    releaseFirstPut();

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.status).toBe("saved");
    expect(res2.status).toBe("saved");
    expect(receivedStates).toEqual([
      { version: 1, updatedAt: 1100 },
      { version: 2, updatedAt: 1301 },
    ]);
  });

  it("TC-01 Case 1E & 1H (M12, M17, M20, m23): guards epochs across conflict recovery and releases recovery lock before recovery PUT", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    coordinator.seedServerMeta("story-X", { version: 1, updatedAt: 1000 });

    const sOld = { ...createDefaultStoryState(), version: 1, updatedAt: 1100 };
    const conflictOutcome = await coordinator.enqueueSave(
      "story-X",
      sOld,
      async () => ({ status: "conflict" }),
      { epoch: 0 }
    );

    expect(conflictOutcome).toEqual({
      status: "conflict",
      unsavedState: sOld,
      newEpoch: 1,
      canAutoRecover: true,
    });

    // Old pre-conflict timer with epoch 0 is immediately superseded
    const staleTimerOutcome = await coordinator.enqueueSave(
      "story-X",
      sOld,
      async () => ({ status: "saved", savedState: sOld }),
      { epoch: 0 }
    );
    expect(staleTimerOutcome).toEqual({ status: "superseded" });

    // Start conflict recovery lock (simulating GET in-flight)
    let finishGet!: () => void;
    const getGate = new Promise<void>((res) => {
      finishGet = res;
    });

    let postGetEpoch = 0;
    const recoveryPromise = coordinator.runConflictRecovery("story-X", async () => {
      await getGate;
      // Bump epoch a 2nd time right after GET finishes (M20)
      postGetEpoch = coordinator.bumpEpoch("story-X");
      coordinator.seedServerMeta("story-X", { version: 2, updatedAt: 2000 });
      return postGetEpoch;
    });

    expect(coordinator.isRecovering("story-X")).toBe(true);

    // While GET is in flight, any immediate enqueueSave is superseded (no 2nd recovery opened)
    const duringGetSave = await coordinator.enqueueSave(
      "story-X",
      { ...sOld, updatedAt: 1500 },
      async () => ({ status: "saved", savedState: sOld }),
      { epoch: 1 }
    );
    expect(duringGetSave).toEqual({ status: "superseded" });

    finishGet();
    const resolvedEpoch = await recoveryPromise;
    expect(resolvedEpoch).toBe(2);
    expect(coordinator.isRecovering("story-X")).toBe(false);

    // Snapshot typed during GET with epoch 1 is also superseded after the 2nd bump
    const typedDuringGetOutcome = await coordinator.enqueueSave(
      "story-X",
      { ...sOld, updatedAt: 1600 },
      async () => ({ status: "saved", savedState: sOld }),
      { epoch: 1 }
    );
    expect(typedDuringGetOutcome).toEqual({ status: "superseded" });

    // Recovery PUT runs outside the lock with epoch 2 (m23a: zero deadlock)
    const mergedState = { ...sOld, version: 2, updatedAt: 2001 };
    const recoveryPutOutcome = await coordinator.enqueueSave(
      "story-X",
      mergedState,
      async (_id, prepared) => ({
        status: "saved",
        savedState: { ...prepared, version: 3, updatedAt: 2100 },
      }),
      { epoch: 2 }
    );
    expect(recoveryPutOutcome.status).toBe("saved");

    // Verify MAX_CONSECUTIVE_CONFLICT_RECOVERIES = 2 cap
    const c1 = await coordinator.enqueueSave("story-X", mergedState, async () => ({
      status: "conflict",
    }));
    const c2 = await coordinator.enqueueSave("story-X", mergedState, async () => ({
      status: "conflict",
    }));
    const c3 = await coordinator.enqueueSave("story-X", mergedState, async () => ({
      status: "conflict",
    }));

    expect(c1.status === "conflict" && c1.canAutoRecover).toBe(true);
    expect(c2.status === "conflict" && c2.canAutoRecover).toBe(true);
    expect(c3.status === "conflict" && c3.canAutoRecover).toBe(false);

    // Manual retry resets consecutive recoveries counter (m27)
    coordinator.resetConsecutiveRecoveries("story-X");
    const cAfterReset = await coordinator.enqueueSave("story-X", mergedState, async () => ({
      status: "conflict",
    }));
    expect(cAfterReset.status === "conflict" && cAfterReset.canAutoRecover).toBe(true);
  });

  it("TC-01 Case 1F & 1I (M19a, M19b): consumes skipInitialGet atomically once and distinguishes candidate new story IDs", async () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    coordinator.markSkipInitialGet("S1");

    // 1st visit to S1 consumes the flag and skips GET
    const firstVisit = shouldApplyRemoteStoryLoad({
      storyId: "S1",
      coordinator,
      currentOwnerStoryId: "S1",
    });
    expect(firstVisit).toEqual({ shouldFetch: false, shouldPromoteUnsaved: false });

    // 2nd visit to S1 after switching to S2 fetches normally (Timeline L)
    const secondVisit = shouldApplyRemoteStoryLoad({
      storyId: "S1",
      coordinator,
      currentOwnerStoryId: "S2",
    });
    expect(secondVisit).toEqual({ shouldFetch: true, shouldPromoteUnsaved: false });

    // Candidate new story ID check while ensureStory is in flight (Timeline N)
    let finishCreate!: () => void;
    const createGate = new Promise<void>((res) => {
      finishCreate = res;
    });

    const createPromise = coordinator.ensureStory(["OLD"], async () => {
      await createGate;
      return "NEW";
    });

    expect(coordinator.isCandidateNewStoryId("OLD")).toBe(false);
    expect(coordinator.isCandidateNewStoryId("NEW")).toBe(true);

    finishCreate();
    await createPromise;
    expect(coordinator.isCandidateNewStoryId("NEW")).toBe(false);
  });

  it("TC-06 Case 6A & 6C (m2, m22): distinguishes Stale 400 from Zod 400 and suppresses toast on background auto-save errors", () => {
    expect(
      isStaleStoryStateErrorResponse(400, {
        error: { message: STALE_STORY_STATE_MESSAGE, code: "VALIDATION_ERROR" },
      })
    ).toBe(true);
    expect(
      isStaleStoryStateErrorResponse(400, {
        error: { message: "Invalid conversationId", code: "VALIDATION_ERROR" },
      })
    ).toBe(false);
    expect(
      isStaleStoryStateErrorResponse(500, { error: { message: STALE_STORY_STATE_MESSAGE } })
    ).toBe(false);

    const autoError = resolveSaveFailurePresentation(
      { status: "error", message: "Network error" },
      false
    );
    expect(autoError.shouldShowErrorToast).toBe(false);
    expect(autoError.nextSaveStatus).toBe("error");

    const manualError = resolveSaveFailurePresentation(
      { status: "error", message: "Network error" },
      true
    );
    expect(manualError.shouldShowErrorToast).toBe(true);

    const payloadError = resolveSaveFailurePresentation({ status: "payload_too_large" }, false);
    expect(payloadError.shouldTrimPayloadAndRetry).toBe(true);
  });
});

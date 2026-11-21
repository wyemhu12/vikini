// /app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.test.ts
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NovelcrafterSyncCoordinator } from "@/lib/features/novelcrafter/storySyncCoordinator";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import { useStoryPersistenceLifecycle } from "./useStoryPersistenceLifecycle";

const mockWriteLocalStoryDraft = vi.fn((..._args: unknown[]) => true);
const mockPutStoryStateOnServer = vi.fn();

vi.mock("@/lib/features/novelcrafter/draftStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/novelcrafter/draftStorage")>();
  return {
    ...actual,
    writeLocalStoryDraft: (...args: unknown[]) => mockWriteLocalStoryDraft(...args),
  };
});

vi.mock("./useNovelcrafterCatalog", () => ({
  putStoryStateOnServer: (...args: unknown[]) => mockPutStoryStateOnServer(...args),
  fetchStoryStateFromServer: vi.fn(),
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useStoryPersistenceLifecycle — unmount cleanup & post-await 429 guard (TC-W2B-13 / NP-3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteLocalStoryDraft.mockReset().mockReturnValue(true);
    mockPutStoryStateOnServer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createParams(storyId = "story-1") {
    const coordinator = new NovelcrafterSyncCoordinator();
    coordinator.seedServerMeta(storyId, { version: 1, updatedAt: 1000 });
    const initialState = { ...createDefaultStoryState(), version: 1, updatedAt: 1100 };
    const latestStateRef: React.MutableRefObject<StoryScopedState> = {
      current: { ownerStoryId: storyId, state: initialState },
    };
    const loadErrorStoryIdRef: React.MutableRefObject<string | null> = { current: null };
    const setStoryState = vi.fn();
    const setSaveStatus = vi.fn();
    const ensureActiveStory = vi.fn(async () => storyId);

    return {
      coordinator,
      initialState,
      latestStateRef,
      loadErrorStoryIdRef,
      setStoryState,
      setSaveStatus,
      ensureActiveStory,
      t: (key: string) => key,
    };
  }

  it("clears draftThrottleTimerRef and saveTimerRef on unmount so no callbacks fire afterward", () => {
    const params = createParams();
    const { result, unmount } = renderHook(() =>
      useStoryPersistenceLifecycle({
        isAuthed: true,
        validStoryId: "story-1",
        coordinator: params.coordinator,
        latestStateRef: params.latestStateRef,
        loadErrorStoryIdRef: params.loadErrorStoryIdRef,
        setStoryState: params.setStoryState,
        setSaveStatus: params.setSaveStatus,
        ensureActiveStory: params.ensureActiveStory,
        t: params.t,
      })
    );

    act(() => {
      result.current.scheduleSave(params.initialState);
    });

    params.setSaveStatus.mockClear();
    mockWriteLocalStoryDraft.mockClear();
    mockPutStoryStateOnServer.mockClear();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockWriteLocalStoryDraft).not.toHaveBeenCalled();
    expect(mockPutStoryStateOnServer).not.toHaveBeenCalled();
    expect(params.setSaveStatus).not.toHaveBeenCalled();
  });

  it("guards post-await 429 rate_limited after unmount so zero zombie retryTimerRef or state updates occur", async () => {
    const params = createParams();
    let resolvePut!: (val: { status: "rate_limited"; retryAfterSeconds: number }) => void;
    mockPutStoryStateOnServer.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        })
    );

    const { result, unmount } = renderHook(() =>
      useStoryPersistenceLifecycle({
        isAuthed: true,
        validStoryId: "story-1",
        coordinator: params.coordinator,
        latestStateRef: params.latestStateRef,
        loadErrorStoryIdRef: params.loadErrorStoryIdRef,
        setStoryState: params.setStoryState,
        setSaveStatus: params.setSaveStatus,
        ensureActiveStory: params.ensureActiveStory,
        t: params.t,
      })
    );

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.saveNow({ isManual: true });
    });

    expect(mockPutStoryStateOnServer).toHaveBeenCalledTimes(1);
    params.setSaveStatus.mockClear();

    unmount();

    await act(async () => {
      resolvePut({ status: "rate_limited", retryAfterSeconds: 4 });
      await savePromise;
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(params.setSaveStatus).not.toHaveBeenCalledWith("unsaved");
    expect(params.setSaveStatus).not.toHaveBeenCalled();
    expect(mockPutStoryStateOnServer).toHaveBeenCalledTimes(1);
  });

  it("remains functional under React 19 Strict Mode double-mount/unmount", async () => {
    const params = createParams();
    mockPutStoryStateOnServer.mockResolvedValue({
      status: "saved",
      savedState: { ...params.initialState, version: 2, updatedAt: 1200 },
    });

    const StrictWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.StrictMode, null, children);

    const { result } = renderHook(
      () =>
        useStoryPersistenceLifecycle({
          isAuthed: true,
          validStoryId: "story-1",
          coordinator: params.coordinator,
          latestStateRef: params.latestStateRef,
          loadErrorStoryIdRef: params.loadErrorStoryIdRef,
          setStoryState: params.setStoryState,
          setSaveStatus: params.setSaveStatus,
          ensureActiveStory: params.ensureActiveStory,
          t: params.t,
        }),
      { wrapper: StrictWrapper }
    );

    await act(async () => {
      await result.current.saveNow({ isManual: true });
    });

    expect(mockPutStoryStateOnServer).toHaveBeenCalledTimes(1);
    expect(params.setSaveStatus).toHaveBeenCalledWith("saved");
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "./useSpeechRecognition";

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  start() {
    this.started = true;
    this.onstart?.();
  }

  stop() {
    this.stopped = true;
    this.onend?.();
  }

  abort() {
    this.aborted = true;
  }
}

function makeFinalResultEvent(text: string): SpeechRecognitionEvent {
  return {
    resultIndex: 0,
    results: {
      length: 1,
      0: {
        isFinal: true,
        length: 1,
        0: { transcript: text, confidence: 0.95 },
      },
    },
  } as unknown as SpeechRecognitionEvent;
}

describe("useSpeechRecognition (TC-W2B-09 / NP-6)", () => {
  const stopTrackMock = vi.fn();
  const getUserMediaMock = vi.fn();

  beforeEach(() => {
    MockSpeechRecognition.instances = [];
    stopTrackMock.mockReset();
    getUserMediaMock.mockReset();
    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: stopTrackMock }],
    });

    Object.defineProperty(window, "SpeechRecognition", {
      value: MockSpeechRecognition,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses latest onFinalResult callback ref across continuous results without restarting recognition", async () => {
    const firstCb = vi.fn();
    const secondCb = vi.fn();

    const { result, rerender } = renderHook(
      ({ cb }) =>
        useSpeechRecognition({
          continuous: true,
          onFinalResult: cb,
        }),
      { initialProps: { cb: firstCb } }
    );

    await act(async () => {
      await result.current.startListening();
    });

    expect(MockSpeechRecognition.instances).toHaveLength(1);
    const rec = MockSpeechRecognition.instances[0];

    act(() => {
      rec.onresult?.(makeFinalResultEvent("Xin chào"));
    });
    expect(firstCb).toHaveBeenCalledWith("Xin chào");

    // Parent re-renders with new callback identity
    rerender({ cb: secondCb });

    act(() => {
      rec.onresult?.(makeFinalResultEvent("thế giới"));
    });
    expect(secondCb).toHaveBeenCalledWith("thế giới");
    expect(MockSpeechRecognition.instances).toHaveLength(1);
  });

  it("NP-6: ignores late R1.onerror('aborted') and R1.onend() after restarting into R2", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({
        silenceTimeout: 3000,
        onError,
      })
    );

    await act(async () => {
      await result.current.startListening();
    });
    const r1 = MockSpeechRecognition.instances[0];
    expect(result.current.status).toBe("listening");

    // Restart into R2 -> R1 is detached & aborted
    await act(async () => {
      await result.current.startListening();
    });
    const r2 = MockSpeechRecognition.instances[1];
    expect(r1.aborted).toBe(true);
    expect(result.current.status).toBe("listening");

    // Late async events from R1 must NOT clobber R2's listening status or silence timer
    act(() => {
      r1.onerror?.({ error: "aborted" } as SpeechRecognitionErrorEvent);
      r1.onend?.();
    });

    expect(result.current.status).toBe("listening");
    expect(onError).not.toHaveBeenCalled();

    // R2's silence timer must still fire after 3000ms
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(r2.stopped).toBe(true);
    expect(result.current.status).toBe("idle");
  });

  it("prevents duplicate SpeechRecognition instances on double-click getUserMedia and unmount mid-getUserMedia", async () => {
    let resolveMic1!: (stream: { getTracks: () => Array<{ stop: () => void }> }) => void;
    let resolveMic2!: (stream: { getTracks: () => Array<{ stop: () => void }> }) => void;
    getUserMediaMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMic1 = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMic2 = resolve;
        })
      );

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      void result.current.startListening();
      void result.current.startListening();
    });

    await act(async () => {
      resolveMic1({ getTracks: () => [{ stop: stopTrackMock }] });
      await Promise.resolve();
    });
    // First stale getUserMedia must NOT create a SpeechRecognition instance
    expect(MockSpeechRecognition.instances).toHaveLength(0);

    await act(async () => {
      resolveMic2({ getTracks: () => [{ stop: stopTrackMock }] });
      await Promise.resolve();
    });
    // Only the latest session creates a single instance
    expect(MockSpeechRecognition.instances).toHaveLength(1);

    // Unmount mid-getUserMedia creates 0 new instances
    let resolveMic3!: (stream: { getTracks: () => Array<{ stop: () => void }> }) => void;
    getUserMediaMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMic3 = resolve;
      })
    );
    const { result: unmountRes, unmount } = renderHook(() => useSpeechRecognition());
    act(() => {
      void unmountRes.current.startListening();
    });
    unmount();
    await act(async () => {
      resolveMic3({ getTracks: () => [{ stop: stopTrackMock }] });
      await Promise.resolve();
    });
    expect(MockSpeechRecognition.instances).toHaveLength(1);
  });

  it("maps error codes cleanly (not-allowed, no-speech, network) and exposes errorCode", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    await act(async () => {
      await result.current.startListening();
    });
    const rec = MockSpeechRecognition.instances[0];

    act(() => {
      rec.onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);
    });

    expect(result.current.errorCode).toBe("not-allowed");
    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalledWith(expect.any(String), "not-allowed");
  });
});

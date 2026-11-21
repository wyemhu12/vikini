import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/utils/logger";
import { useFileStore } from "./store";
import { useFileUpload } from "./useFileUpload";
import type { FileUploadError } from "./fileUploadHelpers";

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

class MockXHR {
  static instances: MockXHR[] = [];
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  timeout = 0;
  status = 0;
  responseText = "";
  aborted = false;
  method = "";
  url = "";
  body: FormData | null = null;

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.body = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe("useFileUpload (TC-W2B-07 / NP-2)", () => {
  beforeEach(() => {
    MockXHR.instances = [];
    useFileStore.setState({
      uploadQueue: [],
      sentFileIds: [],
      renderKeyByFileId: {},
      localPreviewByFileId: {},
      recentlyCompletedAt: {},
    });
    vi.clearAllMocks();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("attaches global drop listener ONLY ONCE even when inline onUploadComplete changes across 10 rerenders", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { rerender, unmount } = renderHook(
      ({ tick }) =>
        useFileUpload({
          conversationId: "conv-1",
          onUploadComplete: () => {
            void tick;
          },
        }),
      { initialProps: { tick: 0 } }
    );

    for (let i = 1; i <= 10; i += 1) {
      rerender({ tick: i });
    }

    const dropAdds = addSpy.mock.calls.filter(([evt]) => evt === "drop");
    expect(dropAdds).toHaveLength(1);
    unmount();
    addSpy.mockRestore();
  });

  it("extracts nested error.message cleanly (never '[object Object]'), logs error, and invokes onError", async () => {
    const onError = vi.fn<(err: FileUploadError) => void>();
    const { result } = renderHook(() =>
      useFileUpload({
        conversationId: "conv-1",
        onError,
      })
    );

    const file = new File(["hello"], "doc.pdf", { type: "application/pdf" });
    let uploadPromise!: Promise<void>;
    act(() => {
      uploadPromise = result.current.uploadFiles([file]);
    });

    expect(MockXHR.instances).toHaveLength(1);
    const xhr = MockXHR.instances[0];
    xhr.status = 400;
    xhr.responseText = JSON.stringify({
      success: false,
      error: { code: "LIMIT", message: "File quá lớn" },
    });

    await act(async () => {
      xhr.onload?.();
      await uploadPromise;
    });

    expect(logger.error).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({
      code: "UPLOAD_FAILED",
      filename: "doc.pdf",
      detail: "File quá lớn",
    });
    expect(onError.mock.calls[0][0].detail).not.toContain("[object Object]");
  });

  it("NP-2: preserves self-initiated New Chat upload (null -> conv-new) while aborting XHR and stopping multi-file/retry loop on real conversation switch", async () => {
    // Part A: Self-initiated New Chat promotion (null -> conv-new) must NOT self-abort XHR
    const onUploadComplete = vi.fn();
    const isSelfInitiatedRef = { current: false };
    let resolveConv!: (id: string) => void;

    const { result: newChatResult, rerender: rerenderNewChat } = renderHook(
      ({ convId }) =>
        useFileUpload({
          conversationId: convId,
          isSelfInitiatedUploadRef: isSelfInitiatedRef,
          ensureConversationId: () =>
            new Promise<string>((resolve) => {
              resolveConv = resolve;
            }),
          onUploadComplete,
        }),
      { initialProps: { convId: null as string | null } }
    );

    const fNew = new File(["img"], "photo.png", { type: "image/png" });
    let newChatUpload!: Promise<void>;
    act(() => {
      newChatUpload = newChatResult.current.uploadFiles([fNew]);
    });

    await act(async () => {
      resolveConv("conv-new");
      await Promise.resolve();
    });

    // React commits prop conversationId null -> "conv-new" while XHR is active
    rerenderNewChat({ convId: "conv-new" });
    expect(MockXHR.instances).toHaveLength(1);
    expect(MockXHR.instances[0].aborted).toBe(false);

    // Complete upload cleanly
    MockXHR.instances[0].status = 200;
    MockXHR.instances[0].responseText = JSON.stringify({
      data: { file: { id: "f-1", filename: "photo.png" } },
    });
    await act(async () => {
      MockXHR.instances[0].onload?.();
      await newChatUpload;
    });
    expect(onUploadComplete).toHaveBeenCalledWith(expect.objectContaining({ id: "f-1" }));

    // Part B: Real conversation switch ("conv-1" -> "conv-2") mid multi-file upload aborts XHR and stops file #2
    MockXHR.instances = [];
    const onError = vi.fn();
    const { result: switchResult, rerender: rerenderSwitch } = renderHook(
      ({ convId }) =>
        useFileUpload({
          conversationId: convId,
          onError,
        }),
      { initialProps: { convId: "conv-1" as string | null } }
    );

    const f1 = new File(["1"], "one.txt", { type: "text/plain" });
    const f2 = new File(["2"], "two.txt", { type: "text/plain" });
    let multiPromise!: Promise<void>;
    act(() => {
      multiPromise = switchResult.current.uploadFiles([f1, f2]);
    });

    expect(MockXHR.instances).toHaveLength(1);
    // Switch to conv-2 while file #1 XHR is still in-flight (separate act flushes conversation-change effect)
    act(() => {
      rerenderSwitch({ convId: "conv-2" });
    });
    await act(async () => {
      await multiPromise;
    });

    expect(MockXHR.instances[0].aborted).toBe(true);
    // File #2 must NEVER start an XHR after conversation switch
    expect(MockXHR.instances).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("cancels pending retry sleep and active XHR immediately on unmount", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const { result, unmount } = renderHook(() =>
      useFileUpload({
        conversationId: "conv-retry",
        onError,
      })
    );

    const file = new File(["retry"], "retry.txt", { type: "text/plain" });
    let uploadPromise!: Promise<void>;
    act(() => {
      uploadPromise = result.current.uploadFiles([file]);
    });

    // Trigger retryable network error -> enters 1000ms abortable retry sleep
    act(() => {
      MockXHR.instances[0].onerror?.();
    });
    await Promise.resolve();

    // Unmount during retry sleep -> must wake up immediately and NEVER open a 2nd XHR
    unmount();
    await act(async () => {
      await uploadPromise;
      vi.advanceTimersByTime(5000);
    });

    expect(MockXHR.instances).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("TC-SU-05 & NP-3: queues all files upfront, hydrates CSP-safe data previews, transitions uploading -> processing -> 0ms atomic completeUpload + 1400ms recentlyCompleted cleanup, and per-file cancel continues remaining queued files", async () => {
    vi.useFakeTimers();
    class SyncFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      readAsDataURL(file: Blob) {
        const name = (file as File).name || "img";
        this.result = `data:image/png;base64,${name}`;
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", SyncFileReader);
    const onUploadComplete = vi.fn();

    const { result, unmount } = renderHook(() =>
      useFileUpload({
        conversationId: "conv-multi",
        onUploadComplete,
      })
    );

    const fA = new File(["a"], "a.png", { type: "image/png" });
    const fB = new File(["b"], "b.png", { type: "image/png" });
    const fC = new File(["c"], "c.png", { type: "image/png" });

    let multiPromise!: Promise<void>;
    await act(async () => {
      multiPromise = result.current.uploadFiles([fA, fB, fC]);
      await Promise.resolve();
    });

    // All 3 files queued immediately upfront with CSP-safe data URL image previews
    const initialQueue = useFileStore.getState().uploadQueue;
    expect(initialQueue).toHaveLength(3);
    expect(initialQueue.map((q) => q.status)).toEqual(["uploading", "queued", "queued"]);
    expect(initialQueue.map((q) => q.previewUrl)).toEqual([
      "data:image/png;base64,a.png",
      "data:image/png;base64,b.png",
      "data:image/png;base64,c.png",
    ]);
    expect(result.current.isUploading).toBe(true);

    const [itemA, itemB, itemC] = initialQueue;

    // Cancel C while still queued AND cancel A while uploading -> loop MUST continue to upload B!
    act(() => {
      result.current.cancelUpload(itemC.tempId);
      result.current.cancelUpload(itemA.tempId);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // File B should now be uploading on XHR #2
    expect(MockXHR.instances).toHaveLength(2);
    expect(MockXHR.instances[0].aborted).toBe(true);
    expect(useFileStore.getState().uploadQueue.map((q) => q.tempId)).toEqual([itemB.tempId]);

    // Trigger 100% upload bytes -> processing state
    act(() => {
      MockXHR.instances[1].upload.onprogress?.({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      } as ProgressEvent);
    });
    expect(useFileStore.getState().uploadQueue[0].status).toBe("processing");

    // Complete B -> 0ms atomic handoff (zero 800ms ghost!), normalized conversation_id, renderKey + previewUrl preserved
    MockXHR.instances[1].status = 200;
    MockXHR.instances[1].responseText = JSON.stringify({
      data: { file: { id: "db-b", filename: "b.png" } },
    });
    await act(async () => {
      MockXHR.instances[1].onload?.();
      await multiPromise;
    });

    expect(useFileStore.getState().uploadQueue).toHaveLength(0);
    expect(useFileStore.getState().renderKeyByFileId["db-b"]).toBe(itemB.tempId);
    expect(useFileStore.getState().localPreviewByFileId["db-b"]).toBe(
      "data:image/png;base64,b.png"
    );
    expect(useFileStore.getState().recentlyCompletedAt["db-b"]).toBeDefined();
    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "db-b", conversation_id: "conv-multi" })
    );
    // C was cancelled while queued -> never opened XHR #3
    expect(MockXHR.instances).toHaveLength(2);

    // After 1400ms, transient recentlyCompleted highlight clears cleanly
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(useFileStore.getState().recentlyCompletedAt["db-b"]).toBeUndefined();

    // Unmount clears store metadata cleanly
    unmount();
    expect(useFileStore.getState().localPreviewByFileId["db-b"]).toBeUndefined();
  });
});

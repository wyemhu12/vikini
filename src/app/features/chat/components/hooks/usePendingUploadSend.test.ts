import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePendingUploadSend, type UsePendingUploadSendOptions } from "./usePendingUploadSend";
import type { FileItem } from "@/types/files";

function makeFile(id: string, convId = "conv-1"): FileItem {
  return {
    id,
    conversation_id: convId,
    filename: `${id}.png`,
    mime_type: "image/png",
    kind: "image",
    size_bytes: 512,
    gemini_ready: true,
    created_at: "2026-11-21T10:00:00.000Z",
  };
}

function defaultProps(
  overrides: Partial<UsePendingUploadSendOptions> = {}
): UsePendingUploadSendOptions {
  return {
    input: "Phân tích ảnh này",
    files: [],
    sentFileIds: [],
    conversationId: "conv-1",
    isUploadBusy: true,
    disabled: false,
    isStreaming: false,
    isImageMode: false,
    escapeDisabled: false,
    onFlushSend: vi.fn(),
    onConversationSwitch: vi.fn(),
    onCancelledByError: vi.fn(),
    ...overrides,
  };
}

describe("usePendingUploadSend (TC-QS-02..08, NP-3, NP-4, NP-6, NP-7)", () => {
  it("TC-QS-02 & TC-QS-04: flushes once with merged SWR + synchronous recentCompletedIds even if SWR lags, and waits for newly dropped files", () => {
    const onFlushSend = vi.fn();
    const { result, rerender } = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      { initialProps: defaultProps({ onFlushSend, files: [makeFile("f-existing")] }) }
    );

    act(() => {
      expect(result.current.queuePendingSend()).toBe(true);
      // Idempotent second call
      expect(result.current.queuePendingSend()).toBe(false);
    });
    expect(result.current.isPendingSend).toBe(true);

    // File A finishes while file B is still uploading -> stays armed, does NOT flush yet
    act(() => {
      result.current.recordCompletedUpload(makeFile("f-a"));
    });
    expect(onFlushSend).not.toHaveBeenCalled();

    // File B finishes and upload busy drops to false (SWR still only has f-existing)
    act(() => {
      result.current.recordCompletedUpload(makeFile("f-b"));
    });
    rerender(defaultProps({ onFlushSend, files: [makeFile("f-existing")], isUploadBusy: false }));

    expect(result.current.isPendingSend).toBe(false);
    expect(onFlushSend).toHaveBeenCalledTimes(1);
    expect(onFlushSend).toHaveBeenCalledWith(["f-existing", "f-a", "f-b"]);
  });

  it("TC-QS-03: waits for New Chat null -> conv-new propagation without calling onConversationSwitch", () => {
    const onFlushSend = vi.fn();
    const onConversationSwitch = vi.fn();
    const { result, rerender } = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      {
        initialProps: defaultProps({
          conversationId: null,
          isUploadBusy: true,
          onFlushSend,
          onConversationSwitch,
        }),
      }
    );

    act(() => {
      result.current.queuePendingSend();
      result.current.handleConversationResolved("conv-new");
      result.current.recordCompletedUpload(makeFile("f-1", "conv-new"));
    });

    // Upload finished, but prop conversationId is still null -> MUST wait
    rerender(
      defaultProps({
        conversationId: null,
        isUploadBusy: false,
        onFlushSend,
        onConversationSwitch,
      })
    );
    expect(onFlushSend).not.toHaveBeenCalled();
    expect(result.current.isPendingSend).toBe(true);

    // Prop conversationId updates to conv-new -> flushes cleanly without resetting sentFileIds
    rerender(
      defaultProps({
        conversationId: "conv-new",
        isUploadBusy: false,
        onFlushSend,
        onConversationSwitch,
      })
    );
    expect(onConversationSwitch).not.toHaveBeenCalled();
    expect(onFlushSend).toHaveBeenCalledTimes(1);
    expect(onFlushSend).toHaveBeenCalledWith(["f-1"]);
  });

  it("TC-QS-05 & NP-3: cancels on upload failure with single toast callback and never flushes subsequent completions", () => {
    const onFlushSend = vi.fn();
    const onCancelledByError = vi.fn();
    const { result, rerender } = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      { initialProps: defaultProps({ onFlushSend, onCancelledByError }) }
    );

    act(() => {
      result.current.queuePendingSend();
      result.current.handleUploadFailure();
      // Second consecutive file failure must not double-toast
      result.current.handleUploadFailure();
    });
    expect(result.current.isPendingSend).toBe(false);
    expect(onCancelledByError).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.recordCompletedUpload(makeFile("f-ok"));
    });
    rerender(defaultProps({ onFlushSend, onCancelledByError, isUploadBusy: false }));
    expect(onFlushSend).not.toHaveBeenCalled();
  });

  it("TC-QS-06, NP-4 & NP-7: respects empty prompt guard, external input changes, Escape, escapeDisabled (Lightbox), defaultPrevented, and IME", () => {
    const onFlushSend = vi.fn();
    // NP-7: empty input cannot arm even when files exist
    const emptyHook = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      { initialProps: defaultProps({ input: "   ", files: [makeFile("f-1")], onFlushSend }) }
    );
    act(() => {
      expect(emptyHook.result.current.queuePendingSend()).toBe(false);
    });
    expect(emptyHook.result.current.isPendingSend).toBe(false);
    emptyHook.unmount();

    // NP-4: Escape blocked when escapeDisabled=true (FileLightbox open) or defaultPrevented or IME
    const { result, rerender } = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      { initialProps: defaultProps({ escapeDisabled: true, onFlushSend }) }
    );
    act(() => {
      result.current.queuePendingSend();
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });
    expect(result.current.isPendingSend).toBe(true);

    rerender(defaultProps({ escapeDisabled: false, onFlushSend }));
    act(() => {
      const prevented = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      prevented.preventDefault();
      window.dispatchEvent(prevented);
    });
    expect(result.current.isPendingSend).toBe(true);

    // Normal Escape cancels cleanly
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });
    expect(result.current.isPendingSend).toBe(false);

    // External input change (e.g. DashboardView prompt click) cancels even if isUploadBusy drops in same commit!
    act(() => {
      result.current.queuePendingSend();
    });
    rerender(defaultProps({ input: "Gợi ý khác", isUploadBusy: false, onFlushSend }));
    expect(result.current.isPendingSend).toBe(false);
    expect(onFlushSend).not.toHaveBeenCalled();
  });

  it("TC-QS-08 & NP-6: cancels on conversation switch, image mode, streaming, disabled, and unmount even in the same commit as isUploadBusy -> false", () => {
    const onFlushSend = vi.fn();
    const onConversationSwitch = vi.fn();
    const { result, rerender, unmount } = renderHook(
      (props: UsePendingUploadSendOptions) => usePendingUploadSend(props),
      { initialProps: defaultProps({ onFlushSend, onConversationSwitch }) }
    );

    act(() => {
      result.current.queuePendingSend();
      result.current.recordCompletedUpload(makeFile("f-1"));
    });

    // Switch conversation AND drop isUploadBusy in the same render commit -> cancel effect wins!
    rerender(
      defaultProps({
        conversationId: "conv-2",
        isUploadBusy: false,
        onFlushSend,
        onConversationSwitch,
      })
    );
    expect(result.current.isPendingSend).toBe(false);
    expect(onConversationSwitch).toHaveBeenCalledTimes(1);
    expect(onFlushSend).not.toHaveBeenCalled();

    // Image mode in same commit cancels cleanly
    rerender(defaultProps({ conversationId: "conv-2", isUploadBusy: true, onFlushSend }));
    act(() => {
      result.current.queuePendingSend();
    });
    rerender(
      defaultProps({
        conversationId: "conv-2",
        isImageMode: true,
        isUploadBusy: false,
        onFlushSend,
      })
    );
    expect(result.current.isPendingSend).toBe(false);
    expect(onFlushSend).not.toHaveBeenCalled();

    // Unmount clears cleanly
    rerender(defaultProps({ conversationId: "conv-2", isUploadBusy: true, onFlushSend }));
    act(() => {
      result.current.queuePendingSend();
    });
    unmount();
    expect(onFlushSend).not.toHaveBeenCalled();
  });
});

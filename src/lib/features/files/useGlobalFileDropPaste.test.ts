import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGlobalFileDropPaste } from "./useGlobalFileDropPaste";

describe("useGlobalFileDropPaste (TC-QS-09)", () => {
  it("tracks nested dragenter/dragleave counter, invokes onFiles on drop, and cleans up on unmount", () => {
    const onFiles = vi.fn();
    const { result, unmount } = renderHook(() => useGlobalFileDropPaste({ onFiles }));

    const file = new File(["img"], "shot.png", { type: "image/png" });

    act(() => {
      const enter1 = new Event("dragenter", { cancelable: true }) as DragEvent;
      Object.defineProperty(enter1, "dataTransfer", { value: { types: ["Files"] } });
      window.dispatchEvent(enter1);
      const enter2 = new Event("dragenter", { cancelable: true }) as DragEvent;
      Object.defineProperty(enter2, "dataTransfer", { value: { types: ["Files"] } });
      window.dispatchEvent(enter2);
    });
    expect(result.current.isDragging).toBe(true);

    // One leave should keep isDragging true because depth is still 1
    act(() => {
      window.dispatchEvent(new Event("dragleave", { cancelable: true }));
    });
    expect(result.current.isDragging).toBe(true);

    // Drop resets depth and delivers files
    act(() => {
      const drop = new Event("drop", { cancelable: true }) as DragEvent;
      Object.defineProperty(drop, "dataTransfer", { value: { files: [file], types: ["Files"] } });
      window.dispatchEvent(drop);
    });
    expect(result.current.isDragging).toBe(false);
    expect(onFiles).toHaveBeenCalledTimes(1);

    // After unmount, events no longer invoke onFiles
    unmount();
    act(() => {
      const dropAfter = new Event("drop", { cancelable: true }) as DragEvent;
      Object.defineProperty(dropAfter, "dataTransfer", {
        value: { files: [file], types: ["Files"] },
      });
      window.dispatchEvent(dropAfter);
    });
    expect(onFiles).toHaveBeenCalledTimes(1);
  });

  it("handles pasted files and respects disabled mode", () => {
    const onFiles = vi.fn();
    const { rerender } = renderHook(
      ({ disabled }) => useGlobalFileDropPaste({ disabled, onFiles }),
      { initialProps: { disabled: false } }
    );

    const img = new File(["png"], "image.png", { type: "image/png" });
    const pasteEvent = new Event("paste", { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { items: [{ kind: "file", getAsFile: () => img }] },
    });

    act(() => {
      window.dispatchEvent(pasteEvent);
    });
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledTimes(1);

    rerender({ disabled: true });
    const pasteDisabled = new Event("paste", { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(pasteDisabled, "clipboardData", {
      value: { items: [{ kind: "file", getAsFile: () => img }] },
    });
    act(() => {
      window.dispatchEvent(pasteDisabled);
    });
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});

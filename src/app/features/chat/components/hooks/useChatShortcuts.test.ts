import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatShortcuts } from "./useChatShortcuts";

function press(init: KeyboardEventInit, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

describe("useChatShortcuts", () => {
  it("toggles the command palette with Cmd/Ctrl+K", () => {
    const { result } = renderHook(() => useChatShortcuts({ onNewChat: vi.fn() }));

    press({ key: "k", metaKey: true });
    expect(result.current.isCommandPaletteOpen).toBe(true);

    press({ key: "K", ctrlKey: true });
    expect(result.current.isCommandPaletteOpen).toBe(false);
  });

  it("starts a new chat with Cmd/Ctrl+Shift+O", () => {
    const onNewChat = vi.fn();
    renderHook(() => useChatShortcuts({ onNewChat }));

    press({ key: "O", ctrlKey: true, shiftKey: true });
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("opens the shortcuts modal with ? unless the user is typing", () => {
    const { result } = renderHook(() => useChatShortcuts({ onNewChat: vi.fn() }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    press({ key: "?" }, textarea);
    expect(result.current.isShortcutsModalOpen).toBe(false);
    textarea.remove();

    press({ key: "?" });
    expect(result.current.isShortcutsModalOpen).toBe(true);

    act(() => result.current.closeShortcutsModal());
    expect(result.current.isShortcutsModalOpen).toBe(false);
  });

  it("removes the listener on unmount", () => {
    const onNewChat = vi.fn();
    const { unmount } = renderHook(() => useChatShortcuts({ onNewChat }));
    unmount();

    press({ key: "o", metaKey: true, shiftKey: true });
    expect(onNewChat).not.toHaveBeenCalled();
  });
});

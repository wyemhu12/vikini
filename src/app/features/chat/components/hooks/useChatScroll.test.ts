import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useChatScroll } from "./useChatScroll";

describe("useChatScroll (TC-03d)", () => {
  const createMockContainer = (scrollTop = 1000, scrollHeight = 1600, clientHeight = 600) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
    el.scrollTop = scrollTop;
    el.scrollTo = vi.fn((opts) => {
      if (typeof opts === "object" && opts.top !== undefined) {
        el.scrollTop = opts.top;
      }
    });
    return el;
  };

  it("manages isAtBottom, unread counter and scrollToBottom correctly", () => {
    const { result, rerender } = renderHook(
      ({ length, isStreaming }) =>
        useChatScroll({
          isStreaming,
          streamingAssistant: null,
          renderedMessagesLength: length,
          lastGeneratedImage: null,
        }),
      {
        initialProps: { length: 10, isStreaming: false },
      }
    );

    // Attach mock element
    const container = createMockContainer(1000, 1600, 600); // 1600 - 600 = 1000 -> at bottom
    (result.current.scrollRef as { current: HTMLDivElement | null }).current = container;

    // (1) Container starts at bottom
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.unreadCount).toBe(0);

    // (2) User scrolls up to middle (scrollTop = 500)
    container.scrollTop = 500;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAtBottom).toBe(false);

    // (3) Add new messages while scrolled up
    rerender({ length: 12, isStreaming: false });
    expect(result.current.isAtBottom).toBe(false);
    expect(result.current.unreadCount).toBe(2);

    // (4) Call scrollToBottom()
    act(() => {
      result.current.scrollToBottom();
    });
    expect(container.scrollTo).toHaveBeenCalled();
    expect(result.current.isAtBottom).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });
});

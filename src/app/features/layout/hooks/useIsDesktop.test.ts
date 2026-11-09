import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsDesktop } from "./useIsDesktop";

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const media = {
    matches: initial,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media)
  );
  return {
    set(value: boolean) {
      media.matches = value;
      listeners.forEach((cb) => cb());
    },
    listeners,
  };
}

describe("useIsDesktop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("TC-15: follows the md breakpoint and cleans up its listener", () => {
    const media = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
    act(() => media.set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("TC-15: defaults to desktop when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });
});

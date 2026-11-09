import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppFrameState } from "./useAppFrameState";
import { DEFAULT_PANEL_COLLAPSED, useLayoutStore } from "@/lib/store/layoutStore";

vi.mock("next/navigation", () => ({ usePathname: () => "/features/gems" }));

let mockConversations: Array<{ id: string; model?: string }> | undefined;

vi.mock("../../chat/hooks/useConversation", () => ({
  useConversation: () => ({ conversations: mockConversations }),
}));

describe("useAppFrameState", () => {
  it("TC-07: keeps only real chats in mainChats", () => {
    mockConversations = [
      { id: "a", model: "gemini-3.5-flash-lite" },
      { id: "b", model: "vikini-image-studio" },
      { id: "c", model: "user_templates_store" },
      { id: "d" },
    ];
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mainChats.map((c) => c.id)).toEqual(["a", "d"]);
    expect(result.current.allConversations).toHaveLength(4);
  });

  it("TC-07: handles missing conversations", () => {
    mockConversations = undefined;
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mainChats).toEqual([]);
    expect(result.current.allConversations).toEqual([]);
  });

  it("TC-07: opens/closes the mobile drawer and toggles collapse", () => {
    useLayoutStore.setState({ panelCollapsedBySection: { ...DEFAULT_PANEL_COLLAPSED } });
    mockConversations = [];
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mobileOpen).toBe(false);
    act(() => result.current.openMobile());
    expect(result.current.mobileOpen).toBe(true);
    act(() => result.current.closeMobile());
    expect(result.current.mobileOpen).toBe(false);

    expect(result.current.sidebarCollapsed).toBe(false);
    act(() => result.current.toggleCollapsed());
    expect(result.current.sidebarCollapsed).toBe(true);
    // collapse is stored for the "pages" section only
    expect(useLayoutStore.getState().panelCollapsedBySection).toEqual({
      ...DEFAULT_PANEL_COLLAPSED,
      pages: true,
    });
    act(() => result.current.toggleCollapsed());
    expect(result.current.sidebarCollapsed).toBe(false);
  });
});

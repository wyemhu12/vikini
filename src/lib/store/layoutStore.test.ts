import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_PANEL_COLLAPSED, mergeLayoutState, useLayoutStore } from "./layoutStore";

function resetStore() {
  useLayoutStore.setState({ panelCollapsedBySection: { ...DEFAULT_PANEL_COLLAPSED } });
}

describe("layoutStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it("TC-03: defaults to focus mode for Novelcrafter only", () => {
    expect(useLayoutStore.getState().panelCollapsedBySection).toEqual({
      chat: false,
      images: false,
      novelcrafter: true,
      pages: false,
    });
  });

  it("TC-04: toggles and sets one section without touching others", () => {
    const { togglePanel, setPanelCollapsed } = useLayoutStore.getState();
    togglePanel("chat");
    expect(useLayoutStore.getState().panelCollapsedBySection.chat).toBe(true);
    togglePanel("chat");
    expect(useLayoutStore.getState().panelCollapsedBySection.chat).toBe(false);

    setPanelCollapsed("images", true);
    expect(useLayoutStore.getState().panelCollapsedBySection).toEqual({
      ...DEFAULT_PANEL_COLLAPSED,
      images: true,
    });
  });

  it("TC-05: merge keeps defaults for wrong types and ignores unknown keys", () => {
    const current = useLayoutStore.getState();
    const merged = mergeLayoutState(
      JSON.parse('{"panelCollapsedBySection":{"chat":"yes","images":true,"__proto__":true,"x":1}}'),
      current
    );
    expect(merged.panelCollapsedBySection).toEqual({ ...DEFAULT_PANEL_COLLAPSED, images: true });
    expect(Object.keys(merged.panelCollapsedBySection).sort()).toEqual([
      "chat",
      "images",
      "novelcrafter",
      "pages",
    ]);
    expect(mergeLayoutState(null, current).panelCollapsedBySection).toEqual(
      DEFAULT_PANEL_COLLAPSED
    );
    expect(mergeLayoutState("garbage", current).panelCollapsedBySection).toEqual(
      DEFAULT_PANEL_COLLAPSED
    );
  });

  it("TC-12: keeps defaults until rehydrate, then loads the persisted value", async () => {
    window.localStorage.setItem(
      "vikini-layout",
      JSON.stringify({ state: { panelCollapsedBySection: { chat: true } }, version: 1 })
    );
    expect(useLayoutStore.getState().panelCollapsedBySection.chat).toBe(false);
    await useLayoutStore.persist.rehydrate();
    expect(useLayoutStore.getState().panelCollapsedBySection.chat).toBe(true);
  });

  it("TC-05: corrupted storage falls back to defaults on rehydrate", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem("vikini-layout", "{broken");
    await useLayoutStore.persist.rehydrate();
    expect(useLayoutStore.getState().panelCollapsedBySection).toEqual(DEFAULT_PANEL_COLLAPSED);
  });
});

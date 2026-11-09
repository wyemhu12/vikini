import { describe, it, expect, beforeEach } from "vitest";
import { useCommandPaletteStore } from "./commandPaletteStore";

describe("commandPaletteStore", () => {
  beforeEach(() => useCommandPaletteStore.setState({ isOpen: false }));

  it("TC-06: opens, closes and toggles", () => {
    const { open, close, toggle } = useCommandPaletteStore.getState();
    open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    close();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});

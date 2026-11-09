import { describe, it, expect, vi, afterEach } from "vitest";
import { safeLocalStorage } from "./safeStorage";

describe("safeLocalStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("round-trips valid JSON values", () => {
    safeLocalStorage.setItem("k", JSON.stringify({ a: 1 }));
    expect(safeLocalStorage.getItem("k")).toBe('{"a":1}');
    safeLocalStorage.removeItem("k");
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("TC-13: returns null for corrupted JSON instead of throwing", () => {
    window.localStorage.setItem("k", "{not json");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("TC-13: swallows quota / access errors on write and read", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => safeLocalStorage.setItem("k", "{}")).not.toThrow();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });
});

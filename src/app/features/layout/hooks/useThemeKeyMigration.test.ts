import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useThemeKeyMigration } from "./useThemeKeyMigration";

const mockSetTheme = vi.fn();
let mockTheme: string | undefined;

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

describe("useThemeKeyMigration", () => {
  beforeEach(() => {
    mockSetTheme.mockReset();
  });

  it.each([
    ["sunset", "hoanghon-dark"],
    ["orchid", "sen-light"],
    ["pitch-black", "than-dark"],
  ])("TC-11: rewrites legacy '%s' to '%s' exactly once", (stored, expected) => {
    mockTheme = stored;
    renderHook(() => useThemeKeyMigration());
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith(expected);
  });

  it("TC-12: leaves a valid key untouched", () => {
    mockTheme = "hoanghon-light";
    renderHook(() => useThemeKeyMigration());
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("TC-13: does nothing before the theme is known", () => {
    mockTheme = undefined;
    renderHook(() => useThemeKeyMigration());
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it.each(["garbage", "__proto__"])("TC-14: resets '%s' to the default key", (stored) => {
    mockTheme = stored;
    renderHook(() => useThemeKeyMigration());
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith("hoanghon-dark");
  });
});

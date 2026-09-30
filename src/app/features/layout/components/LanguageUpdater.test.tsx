import { render, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import LanguageUpdater from "./LanguageUpdater";
import { useLanguageStore } from "@/lib/store/languageStore";

describe("LanguageUpdater (TC-07)", () => {
  const originalLocalStorage = window.localStorage;
  let storageMap: Record<string, string> = {};
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storageMap = {};
    useLanguageStore.setState({ language: "en" });

    setItemSpy = vi.fn((key: string, value: string) => {
      storageMap[key] = value;
    });

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => storageMap[key] || null),
        setItem: setItemSpy,
        removeItem: vi.fn((key: string) => {
          delete storageMap[key];
        }),
        clear: vi.fn(() => {
          storageMap = {};
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  it("hydrates 'vi' from localStorage without overwriting it with default 'en'", async () => {
    // 1. Simulate pre-existing 'vi' in localStorage
    storageMap["vikini-language"] = "vi";

    // 2. Mount LanguageUpdater
    await act(async () => {
      render(<LanguageUpdater />);
    });

    // 3. Verify language hydrated to 'vi'
    expect(useLanguageStore.getState().language).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");

    // 4. Verify localStorage.setItem was NEVER called with 'en'
    const enCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] === "vikini-language" && call[1] === "en"
    );
    expect(enCalls.length).toBe(0);
  });

  it("writes to localStorage when language is changed after hydration", async () => {
    storageMap["vikini-language"] = "vi";

    await act(async () => {
      render(<LanguageUpdater />);
    });

    // Change language explicitly
    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
    });

    expect(useLanguageStore.getState().language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(setItemSpy).toHaveBeenCalledWith("vikini-language", "en");
  });
});

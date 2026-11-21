import { describe, it, expect } from "vitest";
import { LANGUAGE_STORAGE_KEY, resolveInitialLanguage } from "./resolveInitialLanguage";

describe("resolveInitialLanguage (TC-P5-07)", () => {
  it("exports the canonical storage key", () => {
    expect(LANGUAGE_STORAGE_KEY).toBe("vikini-language");
  });

  it("returns direct stored values for vi and en", () => {
    expect(resolveInitialLanguage("vi", "en-US")).toBe("vi");
    expect(resolveInitialLanguage("en", "vi-VN")).toBe("en");
  });

  it("extracts language from legacy Zustand persist JSON payloads", () => {
    expect(resolveInitialLanguage('{"state":{"language":"vi"},"version":0}', "en-US")).toBe("vi");
    expect(resolveInitialLanguage('{"state":{"language":"en"},"version":0}', "vi-VN")).toBe("en");
  });

  it("falls back safely to navigatorLang on malformed JSON or unsupported values", () => {
    expect(resolveInitialLanguage("{bad-json", "vi-VN")).toBe("vi");
    expect(resolveInitialLanguage("{bad-json", "en-US")).toBe("en");
    expect(resolveInitialLanguage("fr", "vi-VN")).toBe("vi");
    expect(resolveInitialLanguage('{"state":{"language":"ja"}}', "en-US")).toBe("en");
  });

  it("handles null stored value with vi/en/undefined navigator language", () => {
    expect(resolveInitialLanguage(null, "vi-VN")).toBe("vi");
    expect(resolveInitialLanguage(null, "VI")).toBe("vi");
    expect(resolveInitialLanguage(null, "en-US")).toBe("en");
    expect(resolveInitialLanguage(null, undefined)).toBe("en");
  });
});

// /lib/features/novelcrafter/writeLength.test.ts
import { describe, expect, it } from "vitest";
import {
  MAX_WRITE_LENGTH_WORDS,
  MIN_WRITE_LENGTH_WORDS,
  NOVELCRAFTER_WRITE_LENGTH_OPTIONS,
} from "./types";
import { clampWriteLengthWords } from "./writeLength";

describe("writeLength (WL-01..WL-05)", () => {
  it("WL-01: returns rounded integer for valid custom numbers within [50, 4000]", () => {
    expect(clampWriteLengthWords(1500)).toBe(1500);
    expect(clampWriteLengthWords(1500.6)).toBe(1501);
  });

  it("WL-02: clamps values below 50 to MIN_WRITE_LENGTH_WORDS (50)", () => {
    expect(clampWriteLengthWords(10)).toBe(MIN_WRITE_LENGTH_WORDS);
    expect(clampWriteLengthWords(0)).toBe(50);
    expect(clampWriteLengthWords(-100)).toBe(50);
  });

  it("WL-03: clamps values above 4000 to MAX_WRITE_LENGTH_WORDS (4000)", () => {
    expect(clampWriteLengthWords(9999)).toBe(MAX_WRITE_LENGTH_WORDS);
    expect(clampWriteLengthWords(4001)).toBe(4000);
  });

  it("WL-04: returns clamped fallback for NaN, Infinity, or empty string", () => {
    expect(clampWriteLengthWords("")).toBe(300);
    expect(clampWriteLengthWords("   ", 600)).toBe(600);
    expect(clampWriteLengthWords("abc", 300)).toBe(300);
    expect(clampWriteLengthWords(Number.NaN, 1000)).toBe(1000);
    expect(clampWriteLengthWords(Number.POSITIVE_INFINITY, 300)).toBe(300);
  });

  it("WL-05: exports quick presets [300, 600, 1000, 2000]", () => {
    expect(NOVELCRAFTER_WRITE_LENGTH_OPTIONS).toEqual([300, 600, 1000, 2000]);
  });
});

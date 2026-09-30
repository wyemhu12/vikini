import { describe, it, expect } from "vitest";
import { computeCharsToTake, BASE_CHARS_PER_TICK, MIN_INTERVAL_MS } from "./typewriter";

describe("Typewriter Module (TC-02)", () => {
  it("exports sensible default constants", () => {
    expect(BASE_CHARS_PER_TICK).toBe(2);
    expect(MIN_INTERVAL_MS).toBe(30);
  });

  it("returns base chars (2) when backlog is <= 30", () => {
    expect(computeCharsToTake(0)).toBe(2);
    expect(computeCharsToTake(1)).toBe(2);
    expect(computeCharsToTake(20)).toBe(2);
    expect(computeCharsToTake(30)).toBe(2);
  });

  it("returns 6 chars when backlog is between 31 and 80", () => {
    expect(computeCharsToTake(31)).toBe(6);
    expect(computeCharsToTake(50)).toBe(6);
    expect(computeCharsToTake(80)).toBe(6);
  });

  it("returns 12 chars when backlog is between 81 and 200", () => {
    expect(computeCharsToTake(81)).toBe(12);
    expect(computeCharsToTake(100)).toBe(12);
    expect(computeCharsToTake(150)).toBe(12);
    expect(computeCharsToTake(200)).toBe(12);
  });

  it("returns Math.floor(bufferLen / 3) when backlog is > 200", () => {
    expect(computeCharsToTake(201)).toBe(Math.floor(201 / 3)); // 67
    expect(computeCharsToTake(300)).toBe(100);
    expect(computeCharsToTake(600)).toBe(200);
    expect(computeCharsToTake(1000)).toBe(333);
  });
});

// /lib/features/novelcrafter/manuscriptViewport.test.ts
import { describe, expect, it } from "vitest";
import { computeManuscriptBoxHeight } from "./manuscriptViewport";

describe("computeManuscriptBoxHeight", () => {
  it("TC-U01: fills the rest of the outer viewport below the box top", () => {
    expect(computeManuscriptBoxHeight({ outerClientHeight: 800, boxOffsetTop: 200 })).toBe(584);
  });

  it("TC-U02: never goes below the minimum height, including with a virtual keyboard", () => {
    expect(computeManuscriptBoxHeight({ outerClientHeight: 800, boxOffsetTop: 700 })).toBe(320);
    expect(
      computeManuscriptBoxHeight({
        outerClientHeight: 800,
        boxOffsetTop: 200,
        keyboardOffsetPx: 300,
      })
    ).toBe(320);
    expect(
      computeManuscriptBoxHeight({
        outerClientHeight: 1000,
        boxOffsetTop: 200,
        keyboardOffsetPx: 100,
      })
    ).toBe(684);
  });
});

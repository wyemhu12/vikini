import { describe, it, expect } from "vitest";
import { RAIL_ITEMS, getSectionForPath, getShellPaddingClass } from "./shellNav";

describe("shellNav", () => {
  it.each([
    ["/", "chat"],
    ["/projects/abc", "chat"],
    ["/images", "images"],
    ["/gallery", "images"],
    ["/describe", "images"],
    ["/novelcrafter", "novelcrafter"],
    ["/novelcrafter/prompts", "novelcrafter"],
    ["/features/gems", "pages"],
    ["/features/personas", "pages"],
    ["/admin", "pages"],
    ["/imagesx", "pages"],
  ])("TC-01: %s belongs to section %s", (pathname, section) => {
    expect(getSectionForPath(pathname)).toBe(section);
  });

  it("TC-01: falls back to chat for a null pathname", () => {
    expect(getSectionForPath(null)).toBe("chat");
  });

  it.each([
    ["/", "chat"],
    ["/projects/abc", "chat"],
    ["/gallery", "images"],
    ["/features/personas", "gems"],
    ["/novelcrafter/prompts", "novelcrafter"],
  ])("TC-01: %s highlights exactly the %s rail item", (pathname, itemId) => {
    const matches = RAIL_ITEMS.filter((item) => item.match(pathname)).map((item) => item.id);
    expect(matches).toEqual([itemId]);
  });

  it("TC-01: unrelated routes highlight no rail item (Negative)", () => {
    for (const pathname of ["/admin", "/auth/signin", "/imagesx"]) {
      expect(RAIL_ITEMS.filter((item) => item.match(pathname))).toHaveLength(0);
    }
  });

  it("TC-02: pads content by rail (+ panel when open) on desktop only", () => {
    expect(getShellPaddingClass(false)).toBe("md:pl-[calc(21rem+var(--sal,0px))]");
    expect(getShellPaddingClass(true)).toBe("md:pl-[calc(4rem+var(--sal,0px))]");
    for (const value of [true, false]) {
      for (const token of getShellPaddingClass(value).split(" ")) {
        expect(token.startsWith("md:")).toBe(true);
      }
    }
  });
});

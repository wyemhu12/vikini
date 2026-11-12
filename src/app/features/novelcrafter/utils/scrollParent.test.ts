// /app/features/novelcrafter/utils/scrollParent.test.ts
import { describe, expect, it } from "vitest";
import { findScrollParent } from "./scrollParent";

function scrollable(scrollHeight: number, clientHeight: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  return el;
}

describe("findScrollParent (TC-U03)", () => {
  it("returns the nearest ancestor that can actually scroll", () => {
    const outer = scrollable(1000, 600);
    const box = scrollable(2000, 500);
    const span = document.createElement("span");
    box.appendChild(span);
    outer.appendChild(box);
    document.body.appendChild(outer);

    expect(findScrollParent(span)).toBe(box);

    Object.defineProperty(box, "scrollHeight", { value: 400, configurable: true });
    expect(findScrollParent(span)).toBe(outer);

    outer.remove();
  });

  it("returns null when no ancestor scrolls", () => {
    const wrapper = document.createElement("div");
    const span = document.createElement("span");
    wrapper.appendChild(span);
    document.body.appendChild(wrapper);
    expect(findScrollParent(span)).toBeNull();
    expect(findScrollParent(null)).toBeNull();
    wrapper.remove();
  });
});

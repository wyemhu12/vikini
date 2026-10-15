// /lib/features/novelcrafter/quoteScrollPositioning.ts
// DOM Mirror caret vertical offset measurement and Sudowrite Golden Third scroll positioning

export const MIRROR_STYLE_PROPERTIES = [
  "direction",
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "tabSize",
  "whiteSpace",
  "wordWrap",
] as const;

export interface ComputeQuoteScrollTopInput {
  textareaRectTop: number;
  containerRectTop: number;
  containerScrollTop: number;
  quoteOffsetTop: number;
  containerClientHeight: number;
}

/**
 * Pure mathematical calculation for the target scrollTop of the scroll container
 * so the highlighted quote lands at the upper 1/3 ("Golden Third") of the viewport.
 */
export function computeQuoteScrollTop({
  textareaRectTop,
  containerRectTop,
  containerScrollTop,
  quoteOffsetTop,
  containerClientHeight,
}: ComputeQuoteScrollTopInput): number {
  const textareaTopInScrollContent = textareaRectTop - containerRectTop + containerScrollTop;
  const viewportPadding = Math.min(220, Math.max(100, containerClientHeight * 0.3));
  const targetTop = textareaTopInScrollContent + quoteOffsetTop - viewportPadding;
  return Math.max(0, targetTop);
}

/**
 * Measures the exact vertical pixel offset of `charIndex` inside a `<textarea>`
 * using a hidden off-screen DOM mirror element with all 24 typography/layout properties.
 * Always cleans up the temporary mirror node in `finally`.
 */
export function measureCaretOffsetTop(textarea: HTMLTextAreaElement, charIndex: number): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(textarea);

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "-9999px";
  mirror.style.left = "-9999px";
  mirror.style.overflowWrap = "break-word";

  for (const prop of MIRROR_STYLE_PROPERTIES) {
    const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    mirror.style.setProperty(cssProp, computed.getPropertyValue(cssProp));
  }

  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";

  const clientWidth = textarea.clientWidth;
  if (clientWidth > 0) {
    if (computed.boxSizing === "border-box") {
      const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
      const borderRight = parseFloat(computed.borderRightWidth) || 0;
      mirror.style.width = `${clientWidth + borderLeft + borderRight}px`;
    } else {
      const padLeft = parseFloat(computed.paddingLeft) || 0;
      const padRight = parseFloat(computed.paddingRight) || 0;
      mirror.style.width = `${Math.max(0, clientWidth - padLeft - padRight)}px`;
    }
  }

  const safeIndex = Math.max(0, Math.min(charIndex, textarea.value.length));
  const textBefore = textarea.value.slice(0, safeIndex);
  const textAfter = textarea.value.slice(safeIndex) || ".";

  mirror.textContent = textBefore;
  const marker = document.createElement("span");
  marker.textContent = textAfter.slice(0, 1) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  try {
    return marker.offsetTop;
  } finally {
    if (mirror.parentNode) {
      mirror.parentNode.removeChild(mirror);
    }
  }
}

// /lib/features/novelcrafter/quoteScrollPositioning.ts
// Golden Third scroll positioning for direct DOM feedback mark elements in the Manuscript Editor

export interface ComputeQuoteScrollTopInput {
  targetRectTop: number;
  containerRectTop: number;
  containerScrollTop: number;
  containerClientHeight: number;
}

/**
 * Pure mathematical calculation for the target scrollTop of the scroll container
 * so the highlighted quote DOM element lands at the upper 1/3 ("Golden Third") of the viewport.
 */
export function computeQuoteScrollTop({
  targetRectTop,
  containerRectTop,
  containerScrollTop,
  containerClientHeight,
}: ComputeQuoteScrollTopInput): number {
  const targetTopInScrollContent = targetRectTop - containerRectTop + containerScrollTop;
  const viewportPadding = Math.min(220, Math.max(100, containerClientHeight * 0.3));
  const targetTop = targetTopInScrollContent - viewportPadding;
  return Math.max(0, targetTop);
}

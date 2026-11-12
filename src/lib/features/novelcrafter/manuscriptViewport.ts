// /lib/features/novelcrafter/manuscriptViewport.ts
// Height of the manuscript box so it fills the outer scroll viewport from its top edge down.

export interface ManuscriptBoxHeightInput {
  /** Visible height of the outer scroll area. */
  outerClientHeight: number;
  /** Distance from the top of the outer scroll content to the top of the box (scroll-independent). */
  boxOffsetTop: number;
  /** Height covered by an on-screen keyboard, if any. */
  keyboardOffsetPx?: number;
  bottomGapPx?: number;
  minHeightPx?: number;
}

export function computeManuscriptBoxHeight({
  outerClientHeight,
  boxOffsetTop,
  keyboardOffsetPx = 0,
  bottomGapPx = 16,
  minHeightPx = 320,
}: ManuscriptBoxHeightInput): number {
  return Math.max(
    minHeightPx,
    Math.round(outerClientHeight - boxOffsetTop - keyboardOffsetPx - bottomGapPx)
  );
}

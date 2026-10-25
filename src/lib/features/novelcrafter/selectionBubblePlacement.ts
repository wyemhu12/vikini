// /lib/features/novelcrafter/selectionBubblePlacement.ts
// Pure coordinate math for positioning the floating selection bubble toolbar above/below selected text

export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ComputeSelectionBubbleInput {
  selectionRect: RectLike;
  containerRect: RectLike;
  containerScrollTop: number;
  bubbleWidth: number;
  bubbleHeight: number;
  gapPx?: number;
  edgePaddingPx?: number;
}

export interface SelectionBubblePosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

export type SelectionBubblePlacement = SelectionBubblePosition;

export function computeSelectionBubblePosition({
  selectionRect,
  containerRect,
  containerScrollTop,
  bubbleWidth,
  bubbleHeight,
  gapPx = 8,
  edgePaddingPx = 12,
}: ComputeSelectionBubbleInput): SelectionBubblePosition {
  const relTopInViewport = selectionRect.top - containerRect.top;
  const relTopInScroll = relTopInViewport + containerScrollTop;

  const aboveTopInViewport = relTopInViewport - bubbleHeight - gapPx;
  const placement: "above" | "below" = aboveTopInViewport < edgePaddingPx ? "below" : "above";

  const top =
    placement === "above"
      ? Math.max(edgePaddingPx, relTopInScroll - bubbleHeight - gapPx)
      : relTopInScroll + selectionRect.height + gapPx;

  const selectionCenterLeft =
    selectionRect.left - containerRect.top * 0 - containerRect.left + selectionRect.width / 2;
  const idealLeft = selectionCenterLeft - bubbleWidth / 2;
  const maxLeft = Math.max(edgePaddingPx, containerRect.width - bubbleWidth - edgePaddingPx);
  const left = Math.max(edgePaddingPx, Math.min(maxLeft, idealLeft));

  return {
    top,
    left,
    placement,
  };
}

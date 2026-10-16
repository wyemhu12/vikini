// /app/features/novelcrafter/utils/novelcrafterKeyboard.ts
// Keyboard shortcut guards for Novelcrafter Studio (NC-22)

export interface EscapeKeyContext {
  key: string;
  defaultPrevented: boolean;
  isStreaming: boolean;
  hasOpenModalOrPopover: boolean;
}

/**
 * Determines whether pressing Escape should abort the active Novelcrafter stream.
 * If a Radix Dialog, Sheet, or Popover is open (or already handled Escape via defaultPrevented),
 * Escape must close the overlay first without cancelling the background SSE stream (NC-22).
 */
export function shouldCancelStreamOnEscape(ctx: EscapeKeyContext): boolean {
  if (ctx.key !== "Escape") return false;
  if (ctx.defaultPrevented) return false;
  if (!ctx.isStreaming) return false;
  if (ctx.hasOpenModalOrPopover) return false;
  return true;
}

/**
 * Checks the DOM for any currently open Radix dialog, alertdialog, menu, or listbox overlay.
 */
export function hasActiveOverlayInDom(
  doc: Document | null = typeof document !== "undefined" ? document : null
): boolean {
  if (!doc) return false;
  const openOverlay = doc.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], [data-novelcrafter-popover="open"]'
  );
  return Boolean(openOverlay);
}

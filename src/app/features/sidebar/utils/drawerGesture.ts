/**
 * Mobile Drawer Drag Gesture Utilities
 * Pure functions and thresholds for touch swipe-to-close behavior on mobile viewports.
 */

export const DRAWER_CLOSE_OFFSET_THRESHOLD = -80;
export const DRAWER_CLOSE_VELOCITY_THRESHOLD = -300;

export interface DrawerDragInfo {
  offset: { x: number };
  velocity: { x: number };
}

/**
 * Determines whether a leftward drag swipe gesture should trigger closing the mobile drawer.
 * Triggers if either:
 * 1. Finger dragged left by 80px or more (offset.x <= -80)
 * 2. Flicked/swiped left fast with velocity -300px/s or faster (velocity.x <= -300)
 */
export function shouldCloseDrawer(info: DrawerDragInfo): boolean {
  return (
    info.offset.x <= DRAWER_CLOSE_OFFSET_THRESHOLD ||
    info.velocity.x <= DRAWER_CLOSE_VELOCITY_THRESHOLD
  );
}

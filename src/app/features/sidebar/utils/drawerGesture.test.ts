import { describe, it, expect } from "vitest";
import {
  shouldCloseDrawer,
  DRAWER_CLOSE_OFFSET_THRESHOLD,
  DRAWER_CLOSE_VELOCITY_THRESHOLD,
} from "./drawerGesture";

describe("drawerGesture - shouldCloseDrawer boundary tests", () => {
  it("exports correct threshold constants", () => {
    expect(DRAWER_CLOSE_OFFSET_THRESHOLD).toBe(-80);
    expect(DRAWER_CLOSE_VELOCITY_THRESHOLD).toBe(-300);
  });

  describe("Offset boundary checks (slow drag with zero velocity)", () => {
    it("returns false when offset is -79px (below threshold)", () => {
      expect(shouldCloseDrawer({ offset: { x: -79 }, velocity: { x: 0 } })).toBe(false);
    });

    it("returns true when offset is exactly -80px (exact boundary)", () => {
      expect(shouldCloseDrawer({ offset: { x: -80 }, velocity: { x: 0 } })).toBe(true);
    });

    it("returns true when offset is -81px (past threshold)", () => {
      expect(shouldCloseDrawer({ offset: { x: -81 }, velocity: { x: 0 } })).toBe(true);
    });
  });

  describe("Velocity boundary checks (fast flick with minimal offset)", () => {
    it("returns false when velocity is -299px/s (below threshold)", () => {
      expect(shouldCloseDrawer({ offset: { x: -10 }, velocity: { x: -299 } })).toBe(false);
    });

    it("returns true when velocity is exactly -300px/s (exact boundary)", () => {
      expect(shouldCloseDrawer({ offset: { x: -10 }, velocity: { x: -300 } })).toBe(true);
    });

    it("returns true when velocity is -301px/s (past threshold)", () => {
      expect(shouldCloseDrawer({ offset: { x: -10 }, velocity: { x: -301 } })).toBe(true);
    });
  });

  describe("Rightward gestures (drag or flick right)", () => {
    it("returns false for rightward drag (+50px, +100px/s)", () => {
      expect(shouldCloseDrawer({ offset: { x: 50 }, velocity: { x: 100 } })).toBe(false);
    });

    it("returns false for resting state (0px, 0px/s)", () => {
      expect(shouldCloseDrawer({ offset: { x: 0 }, velocity: { x: 0 } })).toBe(false);
    });
  });
});

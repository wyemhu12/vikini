import { describe, it, expect } from "vitest";
import { DURATION, EASE, TRANSITION, staggerDelay, reducedMotionTransition } from "./motion";

describe("motion design tokens & helpers (CT-6A-01, NP-5)", () => {
  it("keeps interactive UI durations crisp (<= 0.25s) and preserves legacy constants", () => {
    expect(DURATION.FAST).toBe(0.15);
    expect(DURATION.SNAPPY).toBe(0.2);
    expect(DURATION.NORMAL).toBe(0.25);
    expect(DURATION.SLOW).toBe(0.4);
    expect(DURATION.SLOWER).toBe(0.6);
    expect(DURATION.AMBIENT_CURSOR).toBe(0.8);
    expect(DURATION.AMBIENT_PULSE).toBe(1.25);
    expect(DURATION.AMBIENT_SLOW).toBe(2.0);
    expect(DURATION.AMBIENT_FLOAT).toBe(3.0);
    expect(DURATION.AMBIENT_SPIN).toBe(4.0);
  });

  it("exposes valid easing curves and transition presets", () => {
    expect(EASE.ENTER).toEqual([0.0, 0.0, 0.2, 1.0]);
    expect(EASE.EXIT).toEqual([0.23, 1, 0.32, 1]);
    expect(EASE.MOVE).toEqual([0.4, 0.0, 0.2, 1.0]);
    expect(EASE.LINEAR).toBe("linear");
    expect(EASE.SPRING).toEqual({ type: "spring", stiffness: 400, damping: 30 });
    expect(EASE.SPRING_SOFT).toEqual({ type: "spring", stiffness: 300, damping: 25 });

    expect(TRANSITION.FAST).toEqual({ duration: 0.15, ease: EASE.ENTER });
    expect(TRANSITION.NORMAL).toEqual({ duration: 0.25, ease: EASE.ENTER });
    expect(TRANSITION.SLOW).toEqual({ duration: 0.4, ease: EASE.MOVE });
    expect(TRANSITION.EXIT_FAST).toEqual({ duration: 0.15, ease: EASE.EXIT });
    expect(TRANSITION.EXIT_NORMAL).toEqual({ duration: 0.25, ease: EASE.EXIT });
    expect(TRANSITION.COLLAPSE).toEqual({ duration: 0.2, ease: EASE.MOVE });
    expect(TRANSITION.SPRING).toEqual(EASE.SPRING);
    expect(TRANSITION.SPRING_SOFT).toEqual(EASE.SPRING_SOFT);
  });

  it("computes bounded staggerDelay and guards invalid indices (NP-5)", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBeCloseTo(0.04);
    expect(staggerDelay(3)).toBeCloseTo(0.12);
    expect(staggerDelay(20)).toBe(0.3);
    expect(staggerDelay(999)).toBe(0.3);
    expect(staggerDelay(2, 0.08, 0.4)).toBeCloseTo(0.16);
    expect(staggerDelay(10, 0.08, 0.4)).toBe(0.4);

    // Negative / non-finite boundaries
    expect(staggerDelay(-5)).toBe(0);
    expect(staggerDelay(-3)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
    expect(staggerDelay(Number.POSITIVE_INFINITY)).toBe(0);
    expect(staggerDelay(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("returns instant 0-duration transition when reduced motion is enabled (NP-5)", () => {
    expect(reducedMotionTransition(true, TRANSITION.SPRING)).toEqual({ duration: 0 });
    expect(reducedMotionTransition(false, TRANSITION.SPRING)).toBe(TRANSITION.SPRING);
    expect(reducedMotionTransition(null, TRANSITION.EXIT_FAST)).toBe(TRANSITION.EXIT_FAST);
  });
});

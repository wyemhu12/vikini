import type { Transition } from "framer-motion";

// Duration constants (seconds)
export const DURATION = {
  FAST: 0.15,
  SNAPPY: 0.2,
  NORMAL: 0.25,
  SLOW: 0.4,
  SLOWER: 0.6,
  AMBIENT_CURSOR: 0.8,
  AMBIENT_PULSE: 1.25,
  AMBIENT_SLOW: 2.0,
  AMBIENT_FLOAT: 3.0,
  AMBIENT_SPIN: 4.0,
} as const;

// Easing presets
export const EASE = {
  ENTER: [0.0, 0.0, 0.2, 1.0] as const, // easeOut - for elements entering
  EXIT: [0.23, 1, 0.32, 1] as const, // strong easeOut - for elements leaving (fast start)
  MOVE: [0.4, 0.0, 0.2, 1.0] as const, // easeInOut - for moving elements
  LINEAR: "linear" as const,
  SPRING: { type: "spring" as const, stiffness: 400, damping: 30 },
  SPRING_SOFT: { type: "spring" as const, stiffness: 300, damping: 25 },
} as const;

// Transition presets
export const TRANSITION = {
  FAST: { duration: DURATION.FAST, ease: EASE.ENTER },
  NORMAL: { duration: DURATION.NORMAL, ease: EASE.ENTER },
  SLOW: { duration: DURATION.SLOW, ease: EASE.MOVE },
  EXIT_FAST: { duration: DURATION.FAST, ease: EASE.EXIT },
  EXIT_NORMAL: { duration: DURATION.NORMAL, ease: EASE.EXIT },
  COLLAPSE: { duration: DURATION.SNAPPY, ease: EASE.MOVE },
  SPRING: EASE.SPRING,
  SPRING_SOFT: EASE.SPRING_SOFT,
} as const satisfies Record<string, Transition>;

export function staggerDelay(index: number, step = 0.04, maxDelay = 0.3): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(index * step, maxDelay);
}

export function reducedMotionTransition(
  reduced: boolean | null,
  transition: Transition
): Transition {
  return reduced ? { duration: 0 } : transition;
}

import type { Transition } from "framer-motion";

// Duration constants (seconds)
export const DURATION = {
  FAST: 0.15,
  NORMAL: 0.25,
  SLOW: 0.4,
  SLOWER: 0.6,
} as const;

// Easing presets
export const EASE = {
  ENTER: [0.0, 0.0, 0.2, 1.0] as const, // easeOut - for elements entering
  EXIT: [0.4, 0.0, 1.0, 1.0] as const, // easeIn - for elements leaving
  MOVE: [0.4, 0.0, 0.2, 1.0] as const, // easeInOut - for moving elements
  SPRING: { type: "spring" as const, stiffness: 400, damping: 30 },
} as const;

// Transition presets
export const TRANSITION: Record<string, Transition> = {
  FAST: { duration: DURATION.FAST, ease: EASE.ENTER },
  NORMAL: { duration: DURATION.NORMAL, ease: EASE.ENTER },
  SLOW: { duration: DURATION.SLOW, ease: EASE.MOVE },
  SPRING: EASE.SPRING,
} as const;

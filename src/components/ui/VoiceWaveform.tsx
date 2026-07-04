// components/ui/VoiceWaveform.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

interface VoiceWaveformProps {
  /** Whether the waveform is active (animating) */
  isActive?: boolean;
  /** Number of bars */
  bars?: number;
  /** CSS class for the container */
  className?: string;
  /** Color variant */
  variant?: "accent" | "muted";
}

/**
 * Animated voice waveform indicator.
 * Shows pulsing bars when TTS is speaking or STT is listening.
 */
export function VoiceWaveform({
  isActive = false,
  bars = 5,
  className,
  variant = "accent",
}: VoiceWaveformProps) {
  const barColors = {
    accent: "bg-(--accent)",
    muted: "bg-(--text-secondary)",
  };

  return (
    <div
      className={cn("flex items-center justify-center gap-0.5 h-4", className)}
      role="img"
      aria-label={isActive ? "Audio playing" : "Audio paused"}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-0.5 h-4 rounded-full transition-[transform,opacity] duration-150 origin-bottom",
            barColors[variant],
            isActive ? "animate-voice-bar" : "opacity-30"
          )}
          style={{
            animationDelay: isActive ? `${i * 80}ms` : undefined,
            transform: isActive ? undefined : "scaleY(0.25)",
          }}
        />
      ))}
    </div>
  );
}

export default VoiceWaveform;

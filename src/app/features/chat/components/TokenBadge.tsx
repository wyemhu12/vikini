"use client";

import { memo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles } from "lucide-react";

interface TokenBadgeProps {
  totalTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  className?: string;
}

/**
 * Formats token count for display.
 * Numbers >= 1000 are formatted as "1.2K", >= 1000000 as "1.2M"
 */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * TokenBadge - Displays token usage information for AI responses.
 * Shows a compact badge with total tokens, tap/click to see breakdown.
 * Uses Popover instead of Tooltip for mobile touch support.
 */
const TokenBadge = memo(function TokenBadge({
  totalTokenCount,
  promptTokenCount,
  candidatesTokenCount,
  thoughtsTokenCount,
  className = "",
}: TokenBadgeProps) {
  const [open, setOpen] = useState(false);

  // Don't render if no token data
  if (!totalTokenCount || totalTokenCount <= 0) return null;

  const tooltipLines: string[] = [];
  if (promptTokenCount !== undefined && promptTokenCount > 0) {
    tooltipLines.push(`Input: ${formatTokenCount(promptTokenCount)}`);
  }
  if (candidatesTokenCount !== undefined && candidatesTokenCount > 0) {
    tooltipLines.push(`Output: ${formatTokenCount(candidatesTokenCount)}`);
  }
  if (thoughtsTokenCount !== undefined && thoughtsTokenCount > 0) {
    tooltipLines.push(`Thinking: ${formatTokenCount(thoughtsTokenCount)}`);
  }

  // If no breakdown available, just show the badge without popover
  if (tooltipLines.length === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-secondary/60 select-none ${className}`}
      >
        <Sparkles className="w-3 h-3" />
        <span>{formatTokenCount(totalTokenCount)} tokens</span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 text-xs text-secondary/60 hover:text-secondary active:text-secondary transition-colors select-none ${className}`}
          onClick={() => setOpen(!open)}
        >
          <Sparkles className="w-3 h-3" />
          <span>{formatTokenCount(totalTokenCount)} tokens</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-auto text-xs bg-surface-elevated border border-token px-3 py-2"
        sideOffset={4}
      >
        <div className="flex flex-col gap-0.5">
          {tooltipLines.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default TokenBadge;

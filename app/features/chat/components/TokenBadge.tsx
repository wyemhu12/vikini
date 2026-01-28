"use client";

import { memo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
 * Shows a compact badge with total tokens, expandable tooltip with breakdown.
 */
const TokenBadge = memo(function TokenBadge({
  totalTokenCount,
  promptTokenCount,
  candidatesTokenCount,
  thoughtsTokenCount,
  className = "",
}: TokenBadgeProps) {
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

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 text-xs text-secondary/60 hover:text-secondary transition-colors cursor-default select-none ${className}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{formatTokenCount(totalTokenCount)} tokens</span>
          </span>
        </TooltipTrigger>
        {tooltipLines.length > 0 && (
          <TooltipContent
            side="top"
            className="text-xs bg-surface-elevated border border-token px-2 py-1.5"
          >
            <div className="flex flex-col gap-0.5">
              {tooltipLines.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
});

export default TokenBadge;

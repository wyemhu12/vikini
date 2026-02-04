"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SourceCitation {
  filename: string;
  documentId: string;
  chunkId: string;
  similarity: number;
}

interface SourceCitationsProps {
  sources: SourceCitation[];
  className?: string;
}

/**
 * Displays knowledge base sources used to generate an AI response
 * Collapsible panel showing filename and similarity score
 */
export function SourceCitations({ sources, className }: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-border/50 bg-muted/30 overflow-hidden",
        className
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{sources.length} nguồn từ Knowledge Base</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {sources.map((source, index) => (
            <SourceItem key={source.chunkId} source={source} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SourceItemProps {
  source: SourceCitation;
  index: number;
}

function SourceItem({ source, index }: SourceItemProps) {
  const similarityPercent = Math.round(source.similarity * 100);

  // Color based on similarity
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-muted-foreground";
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background/50 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground shrink-0">[{index + 1}]</span>
        <span className="truncate font-medium">{source.filename}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-xs", getScoreColor(similarityPercent))}>
          {similarityPercent}%
        </span>
      </div>
    </div>
  );
}

/**
 * Inline citation badge for use within message content
 */
export function InlineCitation({ index, filename }: { index: number; filename: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-help"
      title={filename}
    >
      <FileText className="h-3 w-3" />
      <span>[{index}]</span>
    </span>
  );
}

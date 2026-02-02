// /app/features/chat/components/SourceLinks.tsx
"use client";

import React from "react";
import { sanitizeUrl } from "@/lib/utils/xssProtection";

// ============================================
// Type Definitions
// ============================================

interface Source {
  uri: string;
  title?: string;
}

interface SourceLinksProps {
  sources: unknown[];
  maxDisplay?: number;
}

// ============================================
// Component
// ============================================

function SourceLinks({ sources, maxDisplay = 5 }: SourceLinksProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-6 space-y-4 border-t border-token pt-4">
      <div className="flex flex-wrap gap-2">
        {sources.slice(0, maxDisplay).map((s, idx) => {
          const source = s as Source;
          return (
            <a
              key={idx}
              href={sanitizeUrl(source.uri)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-token bg-surface-elevated px-3 py-1 text-[10px] text-secondary hover:bg-control-hover hover:text-primary transition-all max-w-[200px]"
            >
              <span className="font-bold shrink-0">[{idx + 1}]</span>
              <span className="truncate">{source.title || source.uri}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(SourceLinks);

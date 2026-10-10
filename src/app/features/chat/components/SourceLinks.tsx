// /app/features/chat/components/SourceLinks.tsx
"use client";

import React from "react";
import { FileText, Globe } from "lucide-react";
import { sanitizeUrl } from "@/lib/utils/xssProtection";
import { useLanguage } from "../hooks/useLanguage";

// ============================================
// Type Definitions
// ============================================

interface Source {
  uri: string;
  title?: string;
}

interface RagSource {
  filename: string;
  documentId?: string;
  chunkId?: string;
  similarity?: number;
}

interface SourceLinksProps {
  sources?: unknown[];
  ragSources?: unknown[];
  maxDisplay?: number;
}

// ============================================
// Component
// ============================================

function SourceLinks({ sources, ragSources, maxDisplay = 5 }: SourceLinksProps) {
  const { t } = useLanguage();
  const validWebSources = Array.isArray(sources) ? (sources as Source[]).filter((s) => s?.uri) : [];
  const validRagSources = Array.isArray(ragSources)
    ? (ragSources as RagSource[]).filter((s) => s?.filename)
    : [];

  if (validWebSources.length === 0 && validRagSources.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-(--border)/60 pt-3">
      {/* RAG Knowledge Base Sources */}
      {validRagSources.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-(--text-secondary)">
            <FileText className="w-3 h-3 text-(--accent)" />
            <span>{t("ragSourcesTitle") || "Tài liệu tham chiếu"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {validRagSources.slice(0, maxDisplay).map((s, idx) => {
              const similarityPct =
                typeof s.similarity === "number" && !isNaN(s.similarity)
                  ? `${Math.round(s.similarity * 100)}%`
                  : null;
              return (
                <div
                  key={`rag-${idx}`}
                  className="flex items-center gap-1.5 rounded-full border border-(--border)/80 bg-(--surface-elevated) px-2.5 py-1 text-[11px] text-(--text-secondary) max-w-[240px]"
                >
                  <FileText className="w-3 h-3 text-(--accent) shrink-0" />
                  <span className="truncate">{s.filename}</span>
                  {similarityPct && (
                    <span className="shrink-0 text-[10px] text-(--text-secondary)/80 font-mono">
                      {similarityPct}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Web Search Sources */}
      {validWebSources.length > 0 && (
        <div className="space-y-1.5">
          {validRagSources.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-(--text-secondary)">
              <Globe className="w-3 h-3 text-(--text-secondary)" />
              <span>{t("webSourcesTitle") || "Nguồn web"}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {validWebSources.slice(0, maxDisplay).map((s, idx) => {
              return (
                <a
                  key={`web-${idx}`}
                  href={sanitizeUrl(s.uri)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-(--border)/80 bg-(--surface-elevated) px-2.5 py-1 text-[11px] text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-colors max-w-[200px]"
                >
                  <Globe className="w-3 h-3 shrink-0 text-(--text-secondary)" />
                  <span className="font-bold shrink-0">[{idx + 1}]</span>
                  <span className="truncate">{s.title || s.uri}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SourceLinks);

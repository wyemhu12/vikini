// /app/features/chat/components/SourceLinks.tsx
"use client";

import React from "react";
import { AlertTriangle, FileText, Globe, Lock, Presentation, Table2 } from "lucide-react";
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

interface UrlContextItem {
  retrievedUrl: string;
  status?: string;
}

interface SourceLinksProps {
  sources?: unknown[];
  ragSources?: unknown[];
  urlContext?: unknown[];
  maxDisplay?: number;
}

type GoogleDocDisplayKind = "doc" | "sheet" | "slide";
type GoogleDocChipTone = "ok" | "fallback" | "private" | "error";

function isGoogleWorkspaceItem(item: UrlContextItem): boolean {
  const status = String(item.status || "");
  if (status.startsWith("GOOGLE_")) return true;
  return /^https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\//i.test(
    item.retrievedUrl
  );
}

function resolveGoogleChipMeta(item: UrlContextItem): {
  kind: GoogleDocDisplayKind;
  tone: GoogleDocChipTone;
} {
  const status = String(item.status || "");
  const url = item.retrievedUrl.toLowerCase();

  let kind: GoogleDocDisplayKind = "doc";
  if (status.startsWith("GOOGLE_SHEET") || url.includes("/spreadsheets/")) {
    kind = "sheet";
  } else if (status.startsWith("GOOGLE_SLIDES") || url.includes("/presentation/")) {
    kind = "slide";
  }

  let tone: GoogleDocChipTone = "ok";
  if (status === "GOOGLE_DOC_PRIVATE") {
    tone = "private";
  } else if (
    status === "GOOGLE_DOC_NOT_FOUND" ||
    status === "GOOGLE_DOC_TIMEOUT" ||
    status === "GOOGLE_DOC_ERROR"
  ) {
    tone = "error";
  } else if (
    status === "GOOGLE_DOC_TEXT_FALLBACK" ||
    status === "GOOGLE_SLIDES_TEXT_FALLBACK" ||
    status === "GOOGLE_SHEET_CSV_FALLBACK"
  ) {
    tone = "fallback";
  }

  return { kind, tone };
}

// ============================================
// Component
// ============================================

function SourceLinks({ sources, ragSources, urlContext, maxDisplay = 5 }: SourceLinksProps) {
  const { t } = useLanguage();
  const validWebSources = Array.isArray(sources) ? (sources as Source[]).filter((s) => s?.uri) : [];
  const validRagSources = Array.isArray(ragSources)
    ? (ragSources as RagSource[]).filter((s) => s?.filename)
    : [];
  const validGoogleSources = Array.isArray(urlContext)
    ? (urlContext as UrlContextItem[]).filter(
        (u) =>
          typeof u?.retrievedUrl === "string" &&
          u.retrievedUrl.trim().length > 0 &&
          isGoogleWorkspaceItem(u)
      )
    : [];

  if (
    validWebSources.length === 0 &&
    validRagSources.length === 0 &&
    validGoogleSources.length === 0
  ) {
    return null;
  }

  const getGoogleTypeLabel = (kind: GoogleDocDisplayKind): string => {
    if (kind === "sheet") return t("googleDocTypeSheet");
    if (kind === "slide") return t("googleDocTypeSlide");
    return t("googleDocTypeDoc");
  };

  return (
    <div className="mt-4 space-y-3 border-t border-(--line)/60 pt-3">
      {/* Google Workspace Public Document Sources */}
      {validGoogleSources.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-(--muted)">
            <FileText className="w-3 h-3 text-(--accent)" aria-hidden="true" />
            <span>{t("googleDocsSourcesTitle")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {validGoogleSources.slice(0, maxDisplay).map((u, idx) => {
              const { kind, tone } = resolveGoogleChipMeta(u);
              const typeLabel = getGoogleTypeLabel(kind);
              const statusBadge =
                tone === "private"
                  ? t("googleDocPrivate")
                  : tone === "error"
                    ? t("googleDocUnavailable")
                    : tone === "fallback"
                      ? t("googleDocTextFallback")
                      : null;

              const iconClass =
                tone === "error"
                  ? "w-3.5 h-3.5 shrink-0 text-(--danger)"
                  : tone === "private" || tone === "fallback"
                    ? "w-3.5 h-3.5 shrink-0 text-(--warning)"
                    : "w-3.5 h-3.5 shrink-0 text-(--accent)";

              const badgeClass =
                tone === "error"
                  ? "shrink-0 text-xs font-medium text-(--danger)"
                  : "shrink-0 text-xs font-medium text-(--warning)";

              return (
                <a
                  key={`gdoc-${idx}`}
                  href={sanitizeUrl(u.retrievedUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--line)/80 bg-(--surface) px-2.5 py-1 text-xs text-(--muted) hover:bg-(--raised) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) max-w-[260px]"
                >
                  {tone === "private" ? (
                    <Lock className={iconClass} aria-hidden="true" />
                  ) : tone === "error" ? (
                    <AlertTriangle className={iconClass} aria-hidden="true" />
                  ) : kind === "sheet" ? (
                    <Table2 className={iconClass} aria-hidden="true" />
                  ) : kind === "slide" ? (
                    <Presentation className={iconClass} aria-hidden="true" />
                  ) : (
                    <FileText className={iconClass} aria-hidden="true" />
                  )}
                  <span className="truncate font-medium text-(--text)">{typeLabel}</span>
                  {statusBadge && <span className={badgeClass}>· {statusBadge}</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* RAG Knowledge Base Sources */}
      {validRagSources.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-(--muted)">
            <FileText className="w-3 h-3 text-(--accent)" aria-hidden="true" />
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
                  className="flex items-center gap-1.5 rounded-full border border-(--line)/80 bg-(--surface) px-2.5 py-1 text-xs text-(--muted) max-w-[240px]"
                >
                  <FileText className="w-3 h-3 text-(--accent) shrink-0" aria-hidden="true" />
                  <span className="truncate">{s.filename}</span>
                  {similarityPct && (
                    <span className="shrink-0 text-xs text-(--muted)/80 font-mono">
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
          {(validRagSources.length > 0 || validGoogleSources.length > 0) && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-(--muted)">
              <Globe className="w-3 h-3 text-(--muted)" aria-hidden="true" />
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
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-(--line)/80 bg-(--surface) px-2.5 py-1 text-xs text-(--muted) hover:bg-(--raised) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) max-w-[200px]"
                >
                  <Globe className="w-3 h-3 shrink-0 text-(--muted)" aria-hidden="true" />
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

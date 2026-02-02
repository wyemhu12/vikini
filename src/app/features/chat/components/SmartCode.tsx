// /app/features/chat/components/SmartCode.tsx
"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { logger } from "@/lib/utils/logger";

// ============================================
// Type Definitions
// ============================================

interface ReactElementProps {
  className?: string;
  children?: React.ReactNode;
}

interface SmartCodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// ============================================
// Utility Functions
// ============================================

function getLang(className?: string): string {
  const m = /language-([a-z0-9-]+)/i.exec(className || "");
  return m?.[1]?.toLowerCase() || "text";
}

export function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as ReactElementProps;
    return extractText(props.children);
  }
  return "";
}

// ============================================
// Component
// ============================================

const COLLAPSE_AFTER_LINES = 20;

function SmartCode({ inline, className, children }: SmartCodeProps) {
  const { t } = useLanguage();

  const codeText = useMemo(() => {
    const raw = extractText(children);
    return raw.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
  }, [children]);

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy code to clipboard:", err);
    }
  }, [codeText]);

  // Inline code
  if (inline) {
    return (
      <code className="rounded bg-control px-1.5 py-0.5 font-mono text-[0.9em] text-(--primary-light)">
        {children}
      </code>
    );
  }

  // Block code
  const lang = getLang(className);
  const lineCount = codeText.split("\n").length;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;
  const isCollapsed = isCollapsible && !expanded;

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border card-surface shadow-2xl transition-all hover:border-token">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-muted px-4 py-3 border-b border-token select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 opacity-60 group-hover/code:opacity-100 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-3 text-[11px] font-mono font-medium text-secondary uppercase tracking-wider">
            {lang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 py-1 rounded hover:bg-control-hover text-[10px] font-bold text-secondary hover:text-primary transition-colors uppercase tracking-wider"
            >
              {expanded ? t("collapse") : t("expand")}
            </button>
          )}

          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-200
              text-[10px] font-bold uppercase tracking-wider
              ${
                copied
                  ? "bg-green-500/10 text-green-400"
                  : "text-secondary hover:text-primary hover:bg-control-hover"
              }
            `}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className={`relative ${isCollapsed ? "max-h-[320px]" : ""} transition-all duration-300`}>
        <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          <code
            className={`${className} bg-transparent! text-[13px] leading-6 font-mono p-0! block min-w-full`}
          >
            {children}
          </code>
        </pre>
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-(--surface) via-[color-mix(in_srgb,var(--surface)_80%,transparent)] to-transparent pointer-events-none flex items-end justify-center pb-4">
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">
              {lineCount - COLLAPSE_AFTER_LINES} more lines...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SmartCode);

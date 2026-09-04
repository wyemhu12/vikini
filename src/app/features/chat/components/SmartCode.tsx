// /app/features/chat/components/SmartCode.tsx
"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
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
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error("Failed to copy code to clipboard:", message);
    }
  }, [codeText]);

  // Inline code
  if (inline) {
    return (
      <code className="rounded bg-(--control-bg) px-1.5 py-0.5 font-mono text-xs text-(--accent)">
        {children}
      </code>
    );
  }

  // Block code
  const lang = getLang(className);
  const lineCount = codeText.split("\n").length;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;
  const isCollapsed = isCollapsible && !expanded;

  const expandLabel =
    t("expandCode") && t("expandCode") !== "expandCode"
      ? t("expandCode")
      : t("expand")
        ? `${t("expand")} code`
        : "Expand code";

  const collapseLabel =
    t("collapseCode") && t("collapseCode") !== "collapseCode"
      ? t("collapseCode")
      : t("collapse")
        ? `${t("collapse")} code`
        : "Collapse code";

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border border-(--border) bg-(--surface-elevated) shadow-2xl transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--border) bg-(--control-bg) px-4 py-2.5 select-none">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
          {lang}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none ${
            copied
              ? "bg-(--success)/10 text-(--success)"
              : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-elevated)"
          }`}
          aria-label={copied ? t("copied") || "Copied" : t("copy") || "Copy"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-(--success)" />
              <span className="text-(--success)">{t("copied") || "Copied"}</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>{t("copy") || "Copy"}</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div
        className={`relative ${isCollapsed ? "max-h-[320px] overflow-hidden" : ""} transition-colors duration-300`}
      >
        <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          <code
            className={`${className || ""} bg-transparent! text-[13px] leading-6 font-mono text-(--text-primary) p-0! block min-w-full`}
          >
            {children}
          </code>
        </pre>

        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-(--surface-elevated) to-transparent pb-4 pointer-events-none">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-(--border) bg-(--surface-elevated) px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) shadow-sm transition-all active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>{expandLabel}</span>
            </button>
          </div>
        )}
      </div>

      {isCollapsible && expanded && (
        <div className="flex items-center justify-center border-t border-(--border) bg-(--control-bg)/40 p-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1.5 rounded-md border border-(--border) bg-(--surface-elevated) px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) shadow-sm transition-all active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span>{collapseLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(SmartCode);

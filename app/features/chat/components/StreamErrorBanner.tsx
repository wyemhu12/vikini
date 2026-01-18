// /app/features/chat/components/StreamErrorBanner.tsx
"use client";

import React from "react";
import { StreamError } from "./hooks/useChatStreamController";

// ============================================
// Type Definitions
// ============================================

interface StreamErrorBannerProps {
  error: StreamError | null;
  onDismiss: () => void;
  t: Record<string, string>;
}

// ============================================
// Component Implementation
// ============================================

/**
 * A floating error banner that displays stream errors including token limit errors.
 * Positioned fixed at top-right corner.
 */
const StreamErrorBanner: React.FC<StreamErrorBannerProps> = ({ error, onDismiss, t }) => {
  if (!error) return null;

  const title = error.isTokenLimit ? t.tokenLimitTitle : t.error;

  let message: string;
  if (error.isTokenLimit && error.tokenInfo) {
    message = (t.tokenLimitError || "Token limit exceeded: {{limit}} / {{requested}}")
      .replace("{{limit}}", error.tokenInfo.limit?.toLocaleString() || "?")
      .replace("{{requested}}", error.tokenInfo.requested?.toLocaleString() || "?");
  } else {
    message = error.message;
  }

  return (
    <div
      className="fixed top-4 right-4 z-100 max-w-md animate-in slide-in-from-top-2 fade-in duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-red-900/90 backdrop-blur-xl border border-red-500/50 rounded-xl p-4 shadow-2xl flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-lg" aria-hidden="true">
            ⚠
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-200 mb-1">{title}</h4>
          <p className="text-xs text-red-300/80 wrap-break-word">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
          aria-label={t.cancel || "Dismiss"}
        >
          <span className="text-red-300 text-xs">✕</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(StreamErrorBanner);

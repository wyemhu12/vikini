// /app/features/chat/components/StreamErrorBanner.tsx
"use client";

import React from "react";
import { StreamError } from "./hooks/useChatStreamController";
import { useLanguage } from "../hooks/useLanguage";

// ============================================
// Type Definitions
// ============================================

interface StreamErrorBannerProps {
  error: StreamError | null;
  onDismiss: () => void;
}

/**
 * Resolves a localized, user-facing message for a StreamError, including all `LOCAL_*` codes (`TC-45`).
 */
export function resolveStreamErrorMessage(error: StreamError, t: (key: string) => string): string {
  switch (error.code) {
    case "LOCAL_LLM_DISABLED":
      return t("localLlmErrorDisabled") || error.message;
    case "LOCAL_LLM_OFFLINE":
      return t("localLlmErrorOffline") || error.message;
    case "LOCAL_LLM_STARTING":
      return t("localLlmErrorStarting") || error.message;
    case "LOCAL_LLM_BUSY":
      return t("localLlmErrorBusy") || error.message;
    case "LOCAL_QUEUE_TIMEOUT":
      return t("localLlmErrorQueueTimeout") || error.message;
    case "LOCAL_IMAGES_UNSUPPORTED":
      return t("localLlmErrorImages") || error.message;
    case "LOCAL_CONTEXT_OVERFLOW": {
      const template = t("localLlmErrorContextOverflow") || error.message;
      const limitStr =
        typeof error.tokenInfo?.limit === "number"
          ? error.tokenInfo.limit.toLocaleString("en-US")
          : "?";
      const requestedStr =
        typeof error.tokenInfo?.requested === "number"
          ? error.tokenInfo.requested.toLocaleString("en-US")
          : "?";
      return template.replace("{{limit}}", limitStr).replace("{{requested}}", requestedStr);
    }
    default:
      break;
  }

  if (error.isTokenLimit && error.tokenInfo) {
    return t("tokenLimitError")
      .replace("{{limit}}", error.tokenInfo.limit?.toLocaleString() || "?")
      .replace("{{requested}}", error.tokenInfo.requested?.toLocaleString() || "?");
  }
  if (error.code === "empty_response") {
    return t("streamErrorEmptyResponse");
  }
  if (
    error.code === "INSUFFICIENT_CREDITS" ||
    (error as { isInsufficientCredits?: boolean }).isInsufficientCredits
  ) {
    return (
      t("insufficientCredits") ||
      "OpenRouter account balance is insufficient. Please check credits."
    );
  }

  return error.message;
}

// ============================================
// Component Implementation
// ============================================

/**
 * A floating error banner that displays stream errors including token limit errors.
 * Positioned fixed at top-right corner.
 */
const StreamErrorBanner: React.FC<StreamErrorBannerProps> = ({ error, onDismiss }) => {
  const { t } = useLanguage();
  if (!error) return null;

  // Determine title based on error type
  const title = error.isTokenLimit
    ? t("tokenLimitTitle")
    : (error as { isRateLimit?: boolean }).isRateLimit
      ? t("rateLimitTitle")
      : t("error");

  let message = resolveStreamErrorMessage(error, t);

  // Add retry info for rate limit errors
  const retryAfter = (error as { retryAfter?: number }).retryAfter;
  if (retryAfter && retryAfter > 0) {
    message += ` (Retry in ${Math.ceil(retryAfter)}s)`;
  }

  return (
    <div
      className="fixed top-[calc(1rem+var(--sat,0px))] right-[calc(1rem+var(--sar,0px))] z-(--z-banner) max-w-md animate-in slide-in-from-top-2 fade-in duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-(--danger)/10 backdrop-blur-xl border border-(--danger)/30 rounded-xl p-4 shadow-2xl flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-(--danger)/20 flex items-center justify-center">
          <span className="text-(--danger) text-lg" aria-hidden="true"></span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-(--text-primary) mb-1">{title}</h4>
          <p className="text-xs text-(--text-secondary) wrap-break-word">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-full bg-(--danger)/20 hover:bg-(--danger)/40 flex items-center justify-center transition-colors"
          aria-label={t("cancel")}
        >
          <span className="text-(--danger) text-xs"></span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(StreamErrorBanner);

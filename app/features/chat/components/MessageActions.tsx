// /app/features/chat/components/MessageActions.tsx
"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

// ============================================
// Type Definitions
// ============================================

interface MessageActionsProps {
  isBot: boolean;
  messageId?: string;
  copied: boolean;
  canRegenerate?: boolean;
  regenerating?: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onDelete?: (messageId: string) => void;
}

// ============================================
// Component
// ============================================

function MessageActions({
  isBot,
  messageId,
  copied,
  canRegenerate,
  regenerating,
  onCopy,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageActionsProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`flex items-center gap-4 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
        isBot ? "" : "flex-row-reverse"
      }`}
    >
      {/* Copy Button */}
      <button
        onClick={onCopy}
        className="text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter transition-colors"
        title={copied ? t("copied") : t("copy")}
      >
        {copied ? t("copied") : t("copy")}
      </button>

      {/* Edit Button (User messages only) */}
      {!isBot && onEdit && (
        <button
          onClick={onEdit}
          className="text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter transition-colors"
          title={t("edit")}
        >
          {t("edit")}
        </button>
      )}

      {/* Regenerate Button (Bot messages only) */}
      {isBot && canRegenerate && onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1 text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter disabled:opacity-30 transition-colors"
          title={t("regenerate")}
        >
          <span className={regenerating ? "animate-spin" : ""}>🔄</span>
          {regenerating ? t("thinking") : t("regenerate")}
        </button>
      )}

      {/* Delete Button */}
      {onDelete && messageId && (
        <button
          onClick={() => onDelete(messageId)}
          className="text-[10px] font-bold text-secondary hover:text-red-500 uppercase tracking-tighter transition-colors"
          title={t("delete")}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default React.memo(MessageActions);

// /app/features/chat/components/MessageActions.tsx
"use client";

import React from "react";
import { Trash2, Volume2, VolumeX, Copy, Check, RefreshCw } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { VoiceWaveform } from "@/components/ui/VoiceWaveform";

// ============================================
// Type Definitions
// ============================================

interface MessageActionsProps {
  isBot: boolean;
  messageId?: string;
  copied: boolean;
  canRegenerate?: boolean;
  regenerating?: boolean;
  /** TTS speaking state */
  isSpeaking?: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onDelete?: (messageId: string) => void;
  /** Callback to trigger TTS */
  onSpeak?: () => void;
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
  isSpeaking,
  onCopy,
  onEdit,
  onRegenerate,
  onDelete,
  onSpeak,
}: MessageActionsProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) shadow-sm rounded-full px-2.5 py-1 flex items-center gap-2 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 ${
        isBot ? "" : "flex-row-reverse"
      }`}
    >
      {/* Copy Button */}
      <button
        type="button"
        onClick={onCopy}
        className="group/copy min-h-[28px] min-w-[28px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-tighter transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none text-(--text-secondary) hover:text-(--accent)"
        title={copied ? t("copied") : t("copy")}
        aria-label={copied ? t("copied") : t("copy")}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-(--success) animate-in zoom-in-50 duration-200 ease-out" />
        ) : (
          <Copy className="w-3.5 h-3.5 group-hover/copy:scale-110 transition-transform duration-200" />
        )}
        <span className={copied ? "text-(--success)" : ""}>{copied ? t("copied") : t("copy")}</span>
      </button>

      {/* Edit Button (User messages only) */}
      {!isBot && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[28px] min-w-[28px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center text-xs font-semibold text-(--text-secondary) hover:text-(--accent) uppercase tracking-tighter transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          title={t("edit")}
          aria-label={t("edit")}
        >
          {t("edit")}
        </button>
      )}

      {/* Regenerate Button (Bot messages only) */}
      {isBot && canRegenerate && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="group/regen min-h-[28px] min-w-[28px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center gap-1 text-xs font-semibold text-(--text-secondary) hover:text-(--accent) uppercase tracking-tighter disabled:opacity-30 disabled:pointer-events-none transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          title={t("regenerate")}
          aria-label={t("regenerate")}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 group-hover/regen:rotate-180 transition-transform duration-300 ${regenerating ? "animate-spin" : ""}`}
          />
          <span>{t("regenerate")}</span>
        </button>
      )}

      {/* Delete Button */}
      {onDelete && messageId && (
        <button
          type="button"
          onClick={() => onDelete(messageId)}
          className="group-del-hover min-h-[28px] min-w-[28px] p-1 rounded-md inline-flex items-center justify-center text-(--text-secondary) hover:text-(--danger) transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          title={t("delete")}
          aria-label={t("delete")}
        >
          <Trash2 className="w-3.5 h-3.5 wiggle-on-hover" />
        </button>
      )}

      {/* TTS Button (Bot messages only) */}
      {isBot && onSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          className={`min-h-[28px] min-w-[28px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tighter transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none ${
            isSpeaking ? "text-(--accent)" : "text-(--text-secondary) hover:text-(--accent)"
          }`}
          title={isSpeaking ? t("stopSpeaking") || "Stop" : t("readAloud") || "Read aloud"}
          aria-label={isSpeaking ? t("stopSpeaking") || "Stop" : t("readAloud") || "Read aloud"}
          aria-pressed={Boolean(isSpeaking)}
        >
          {isSpeaking ? (
            <>
              <VoiceWaveform isActive={true} bars={4} className="h-3" />
              <VolumeX className="w-3.5 h-3.5" />
            </>
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

export default React.memo(MessageActions);

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
      className={`flex items-center gap-3 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
        isBot ? "" : "flex-row-reverse"
      }`}
    >
      {/* Copy Button */}
      <button
        onClick={onCopy}
        className="group/copy flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter transition-all text-secondary hover:text-(--accent)"
        title={copied ? t("copied") : t("copy")}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500 animate-bounce-once" />
        ) : (
          <Copy className="w-3 h-3 group-hover/copy:scale-110 transition-transform duration-200" />
        )}
        <span className={copied ? "text-green-500" : ""}>{copied ? t("copied") : t("copy")}</span>
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
          className="group/regen flex items-center gap-1 text-[10px] font-bold text-secondary hover:text-(--accent) uppercase tracking-tighter disabled:opacity-30 transition-all"
          title={t("regenerate")}
        >
          <RefreshCw className="w-3 h-3 group-hover/regen:rotate-180 transition-transform duration-300" />
          <span>{t("regenerate")}</span>
        </button>
      )}

      {/* Delete Button */}
      {onDelete && messageId && (
        <button
          onClick={() => onDelete(messageId)}
          className="group-del-hover flex items-center text-secondary hover:text-red-500 transition-colors"
          title={t("delete")}
        >
          <Trash2 className="w-3 h-3 wiggle-on-hover" />
        </button>
      )}

      {/* TTS Button (Bot messages only) */}
      {isBot && onSpeak && (
        <button
          onClick={onSpeak}
          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tighter transition-all ${
            isSpeaking ? "text-(--accent)" : "text-secondary hover:text-(--accent)"
          }`}
          title={isSpeaking ? t("stopSpeaking") || "Stop" : t("readAloud") || "Read aloud"}
          aria-pressed={isSpeaking}
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

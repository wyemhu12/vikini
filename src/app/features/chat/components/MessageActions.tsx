// /app/features/chat/components/MessageActions.tsx
"use client";

import React from "react";
import {
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  RefreshCw,
  GitFork,
  Loader2,
  Play,
  Pencil,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { VoiceWaveform } from "@/components/ui/VoiceWaveform";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

// ============================================
// Type Definitions
// ============================================

interface MessageActionsProps {
  isBot: boolean;
  messageId?: string;
  copied: boolean;
  canRegenerate?: boolean;
  regenerating?: boolean;
  isPartial?: boolean;
  isLastAssistant?: boolean;
  /** TTS speaking state */
  isSpeaking?: boolean;
  /** Branching in progress for this message */
  isBranching?: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onDelete?: (messageId: string) => void;
  /** Callback to trigger TTS */
  onSpeak?: () => void;
  /** Callback to branch into a new chat from this message */
  onBranch?: (messageId: string) => void;
  /** Keep the bar visible on desktop (e.g. last assistant message); otherwise shown on hover/focus. */
  alwaysVisible?: boolean;
}

// ============================================
// Component
// ============================================

const ICON_BUTTON_CLASS =
  "h-8 w-8 min-h-[28px] min-w-[28px] rounded-lg inline-flex items-center justify-center text-(--muted) hover:text-(--text) hover:bg-(--raised) disabled:opacity-40 disabled:pointer-events-none active:scale-[0.92] transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

interface IconActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: LucideIcon;
  iconClassName?: string;
}

/** Icon-only action: the label is the accessible name and the native tooltip. */
const IconAction = React.forwardRef<HTMLButtonElement, IconActionProps>(function IconAction(
  { label, icon: Icon, iconClassName, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className={cn(ICON_BUTTON_CLASS, className)}
      {...props}
    >
      {children ?? <Icon aria-hidden className={cn("w-4 h-4", iconClassName)} />}
    </button>
  );
});

function MessageActions({
  isBot,
  messageId,
  copied,
  canRegenerate,
  regenerating,
  isPartial,
  isLastAssistant,
  isSpeaking,
  isBranching,
  onCopy,
  onEdit,
  onRegenerate,
  onContinue,
  onDelete,
  onSpeak,
  onBranch,
  alwaysVisible = false,
}: MessageActionsProps) {
  const { t } = useLanguage();
  const branchLabel = isBranching
    ? t("branching") || "Branching..."
    : t("branchInNewChat") || "Branch in new chat";
  const speakLabel = isSpeaking ? t("stopSpeaking") || "Stop" : t("readAloud") || "Read aloud";

  return (
    <div
      className={cn(
        "mt-1 flex items-center gap-0.5 transition-opacity duration-200",
        isBot ? "justify-start" : "justify-end",
        alwaysVisible
          ? "opacity-100"
          : // Desktop: float over the gap below the message so hidden bars don't add height.
            cn(
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
              "md:absolute md:top-full md:z-10 md:mt-0",
              isBot ? "md:left-0" : "md:right-0"
            )
      )}
    >
      <IconAction
        label={copied ? t("copied") : t("copy")}
        icon={copied ? Check : Copy}
        iconClassName={copied ? "text-(--success)" : undefined}
        onClick={onCopy}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>

      {!isBot && onEdit && <IconAction label={t("edit")} icon={Pencil} onClick={onEdit} />}

      {isBot && isPartial && isLastAssistant && onContinue && (
        <IconAction
          label={t("continue")}
          icon={Play}
          iconClassName="fill-current text-(--accent)"
          onClick={onContinue}
        />
      )}

      {isBot && canRegenerate && onRegenerate && (
        <IconAction
          label={t("regenerate")}
          icon={RefreshCw}
          iconClassName={regenerating ? "animate-spin" : undefined}
          onClick={onRegenerate}
          disabled={regenerating}
        />
      )}

      {isBot && onSpeak && (
        <IconAction
          label={speakLabel}
          icon={isSpeaking ? VolumeX : Volume2}
          aria-pressed={Boolean(isSpeaking)}
          className={isSpeaking ? "text-(--accent)" : undefined}
          onClick={onSpeak}
        >
          {isSpeaking ? (
            <span className="flex items-center gap-1">
              <VoiceWaveform isActive={true} bars={4} className="h-3" />
              <VolumeX aria-hidden className="w-4 h-4" />
            </span>
          ) : undefined}
        </IconAction>
      )}

      {onBranch && messageId && (
        <IconAction
          label={branchLabel}
          icon={isBranching ? Loader2 : GitFork}
          iconClassName={isBranching ? "animate-spin text-(--accent)" : "rotate-180"}
          onClick={() => onBranch(messageId)}
          disabled={isBranching}
        />
      )}

      {onDelete && messageId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconAction label={t("messageMoreActions")} icon={MoreHorizontal} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isBot ? "start" : "end"} className="min-w-40">
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-(--danger) focus:text-(--danger)"
              onClick={() => onDelete(messageId)}
            >
              <Trash2 aria-hidden className="w-4 h-4" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default React.memo(MessageActions);

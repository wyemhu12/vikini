/**
 * ComposerSubmitButton - Send / Stop / Pending-Send Cancel action button for InputForm.
 *
 * Switches cleanly to `type="button"` with `onClick={onCancelPendingSend}` when a send is
 * queued behind uploads, preventing any conflict with idempotent double-Enter handling.
 */

"use client";

import React from "react";
import { Image as ImageIcon, Loader2, SendHorizontal, Square } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

export interface ComposerSubmitButtonProps {
  isStreaming: boolean;
  isPendingSend: boolean;
  isUploadBusy: boolean;
  isImageMode: boolean;
  isReady: boolean;
  onCancelPendingSend: () => void;
}

const BASE_BUTTON_CLASS =
  "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,opacity,filter,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

export function ComposerSubmitButton({
  isStreaming,
  isPendingSend,
  isUploadBusy,
  isImageMode,
  isReady,
  onCancelPendingSend,
}: ComposerSubmitButtonProps) {
  const { t } = useLanguage();

  if (!isStreaming && isPendingSend) {
    return (
      <button
        type="button"
        onClick={onCancelPendingSend}
        onMouseDown={(e) => e.preventDefault()}
        data-testid="composer-pending-send-button"
        className={`${BASE_BUTTON_CLASS} bg-(--accent) text-(--on-accent) ring-2 ring-(--accent)/30 hover:brightness-110 active:scale-[0.92]`}
        title={t("cancelPendingSend")}
        aria-label={t("cancelPendingSend")}
      >
        <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin motion-reduce:animate-none" />
      </button>
    );
  }

  const isDisabled = !isStreaming && !isReady;
  const stateClasses = isStreaming
    ? "bg-(--accent) text-(--on-accent) ring-2 ring-(--accent)/30 hover:brightness-110 active:scale-[0.92]"
    : isReady
      ? "bg-(--accent) text-(--on-accent) hover:brightness-110 active:scale-[0.92] shadow-[0_0_15px_var(--accent)] scale-100"
      : "bg-(--raised) text-(--muted) opacity-40 cursor-not-allowed scale-95";

  const label = isStreaming
    ? t("stopBtn") || "Stop"
    : isUploadBusy
      ? t("sendWhenUploadsReady")
      : t("send") || "Send";
  const ariaLabel = isStreaming
    ? t("stopGeneration") || "Stop generation"
    : isUploadBusy
      ? t("sendWhenUploadsReady")
      : t("send") || "Send message";

  return (
    <button
      type="submit"
      disabled={isDisabled}
      onMouseDown={(e) => e.preventDefault()}
      className={`${BASE_BUTTON_CLASS} ${stateClasses}`}
      title={label}
      aria-label={ariaLabel}
    >
      {isStreaming ? (
        <Square aria-hidden="true" className="w-4 h-4 fill-current" />
      ) : isImageMode ? (
        <ImageIcon aria-hidden="true" className="w-5 h-5" />
      ) : (
        <SendHorizontal aria-hidden="true" className="w-5 h-5" />
      )}
    </button>
  );
}

export default ComposerSubmitButton;

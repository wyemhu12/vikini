/**
 * PendingUploadSendBanner - Subtle animated status bar shown inside InputForm when a prompt
 * is queued to auto-send as soon as in-flight file uploads complete.
 */

"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";
import { useLanguage } from "../hooks/useLanguage";

export interface PendingUploadSendBannerProps {
  visible: boolean;
  activeUploadCount: number;
  onCancel: () => void;
}

export function PendingUploadSendBanner({
  visible,
  activeUploadCount,
  onCancel,
}: PendingUploadSendBannerProps) {
  const { t } = useLanguage();
  const shouldReduce = useReducedMotion();

  const label =
    activeUploadCount > 1
      ? t("pendingSendWaitingCount").replace("{count}", String(activeUploadCount))
      : t("pendingSendWaiting");

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="pending-upload-send-banner"
          initial={shouldReduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={shouldReduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={shouldReduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
          className="overflow-hidden"
        >
          <div
            role="status"
            aria-live="polite"
            data-testid="pending-upload-send-banner"
            className="mx-3 mt-1.5 mb-0.5 flex items-center justify-between gap-2 rounded-xl border border-(--accent)/25 bg-(--soft) px-3 py-1.5 text-xs text-(--text)"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin text-(--accent) motion-reduce:animate-none"
              />
              <span className="truncate font-medium">{label}</span>
            </div>
            <button
              type="button"
              onClick={onCancel}
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-(--muted) transition-[background-color,color,transform] duration-150 ease-out hover:bg-(--raised-hover) hover:text-(--text) active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{t("cancelPendingSend")}</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PendingUploadSendBanner;

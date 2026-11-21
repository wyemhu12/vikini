/**
 * FilePreviewArea - Inline file preview container above the textarea.
 *
 * Keeps a stable wrapper with AnimatePresence for smooth enter/exit height transitions,
 * explicit min-h-[88px] dropzone when dragging onto an empty composer, and unified stable
 * React keys (`renderKeyByFileId[file.id] ?? file.id`) so uploading cards morph in place
 * with zero duplicate-card flicker or sort teleportation.
 */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trash2, Upload } from "lucide-react";
import { FilePreviewCard } from "./FilePreviewCard";
import type { FileItem, FileUploadProgress } from "@/types/files";
import { useFileStore } from "@/lib/features/files/store";
import { filterVisibleUploadQueue } from "@/lib/features/files/uploadPresentation";
import { useLanguage } from "../hooks/useLanguage";
import { TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";

export interface FilePreviewAreaProps {
  /** Uploaded files from SWR (chronologically sorted) */
  files: FileItem[];
  /** In-progress uploads from Zustand store */
  uploadQueue: FileUploadProgress[];
  /** Handler to remove an uploaded file */
  onRemoveFile: (id: string) => void | Promise<void>;
  /** Handler to cancel an in-progress upload */
  onCancelUpload?: (tempId: string) => void;
  /** Handler to dismiss a failed upload card */
  onDismissError?: (tempId: string) => void;
  /** Handler to clear all files */
  onClearAll: () => void | Promise<void>;
  /** Handler when a file card is clicked (opens lightbox) */
  onClickFile: (file: FileItem) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Whether files are being dragged over the window */
  isDragging?: boolean;
}

export function FilePreviewArea({
  files,
  uploadQueue,
  onRemoveFile,
  onCancelUpload,
  onDismissError,
  onClearAll,
  onClickFile,
  disabled = false,
  isDragging = false,
}: FilePreviewAreaProps) {
  const { t } = useLanguage();
  const shouldReduce = useReducedMotion();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderKeyByFileId = useFileStore((s) => s.renderKeyByFileId);
  const localPreviewByFileId = useFileStore((s) => s.localPreviewByFileId);
  const recentlyCompletedAt = useFileStore((s) => s.recentlyCompletedAt);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, []);

  const visibleQueue = useMemo(
    () => filterVisibleUploadQueue(uploadQueue, files),
    [uploadQueue, files]
  );

  const hasContent = files.length > 0 || visibleQueue.length > 0;

  const handleClearAll = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (showClearConfirm) {
      void onClearAll();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      clearTimerRef.current = setTimeout(() => {
        clearTimerRef.current = null;
        setShowClearConfirm(false);
      }, 3000);
    }
  };

  return (
    <div className="relative">
      {/* Drag overlay over existing cards OR visible min-h dropzone when empty */}
      <AnimatePresence initial={false}>
        {isDragging && !hasContent && (
          <motion.div
            key="empty-dropzone"
            data-testid="composer-empty-dropzone"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotionTransition(shouldReduce, TRANSITION.COLLAPSE)}
            className="overflow-hidden px-3 pt-3 pb-1"
          >
            <div className="min-h-[88px] flex items-center justify-center rounded-2xl bg-(--soft) border-2 border-dashed border-(--accent) text-(--accent) font-medium text-sm gap-2">
              <Upload aria-hidden="true" className="w-5 h-5" />
              <span>{t("dropFilesHere")}</span>
            </div>
          </motion.div>
        )}

        {isDragging && hasContent && (
          <motion.div
            key="overlay-dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-t-3xl bg-(--surface)/85 backdrop-blur-sm border-2 border-dashed border-(--accent)"
          >
            <div className="flex items-center gap-2 text-(--accent) font-semibold text-sm">
              <Upload aria-hidden="true" className="w-5 h-5" />
              <span>{t("dropFilesHere")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File cards tray with smooth height enter/exit */}
      <AnimatePresence initial={false}>
        {hasContent && (
          <motion.div
            key="file-preview-tray"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotionTransition(shouldReduce, TRANSITION.COLLAPSE)}
            className="overflow-hidden"
          >
            <div className="px-3 pt-3 pb-1">
              <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-(--line) pb-1 snap-x snap-mandatory">
                <AnimatePresence mode="popLayout" initial={false}>
                  {files.map((file) => (
                    <FilePreviewCard
                      key={renderKeyByFileId[file.id] ?? file.id}
                      file={file}
                      localPreviewUrl={localPreviewByFileId[file.id]}
                      justCompleted={Boolean(recentlyCompletedAt[file.id])}
                      onRemove={onRemoveFile}
                      onClick={onClickFile}
                      disabled={disabled}
                    />
                  ))}

                  {visibleQueue.map((upload, idx) => (
                    <FilePreviewCard
                      key={upload.tempId}
                      upload={upload}
                      staggerIndex={idx}
                      onCancelUpload={onCancelUpload}
                      onDismissError={onDismissError}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {files.length > 1 && (
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={disabled}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                      showClearConfirm
                        ? "bg-(--danger)/10 text-(--danger) hover:bg-(--danger)/20"
                        : "text-(--muted) hover:text-(--danger) hover:bg-(--danger)/5"
                    } disabled:opacity-50`}
                  >
                    <Trash2 aria-hidden="true" className="w-3 h-3" />
                    {showClearConfirm ? t("confirmClearAll") : t("clearAllFiles")}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FilePreviewArea;

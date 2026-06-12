/**
 * FilePreviewArea — Inline file preview container above the textarea.
 *
 * Shows uploaded files + in-progress uploads as horizontal scrollable cards.
 * Replaces AttachmentsPanel (903 lines) with a clean inline-first design.
 */
"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, Upload } from "lucide-react";
import { FilePreviewCard } from "./FilePreviewCard";
import type { FileItem, FileUploadProgress } from "@/types/files";

interface FilePreviewAreaProps {
  /** Uploaded files from SWR */
  files: FileItem[];
  /** In-progress uploads from Zustand store */
  uploadQueue: FileUploadProgress[];
  /** Handler to remove an uploaded file */
  onRemoveFile: (id: string) => void;
  /** Handler to clear all files */
  onClearAll: () => void;
  /** Handler when a file card is clicked (opens lightbox) */
  onClickFile: (file: FileItem) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Whether files are being dragged over the window */
  isDragging?: boolean;
  /** Translations */
  t?: Record<string, string>;
}

export function FilePreviewArea({
  files,
  uploadQueue,
  onRemoveFile,
  onClearAll,
  onClickFile,
  disabled = false,
  isDragging = false,
  t,
}: FilePreviewAreaProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const hasContent = files.length > 0 || uploadQueue.length > 0;

  if (!hasContent && !isDragging) return null;

  const handleClearAll = () => {
    if (showClearConfirm) {
      onClearAll();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-dismiss confirm after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="relative">
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-t-3xl bg-(--surface)/80 backdrop-blur-sm border-2 border-dashed border-(--accent)"
          >
            <div className="flex flex-col items-center gap-2 text-(--accent) font-semibold">
              <Upload className="w-8 h-8 animate-bounce" />
              <span>{t?.dropFilesHere || "Drop files here"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File cards container */}
      {hasContent && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="px-3 pt-3 pb-1"
        >
          {/* Horizontal scroll container */}
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--control-border)] pb-1 snap-x snap-mandatory">
            <AnimatePresence mode="popLayout">
              {/* Uploaded files */}
              {files.map((file) => (
                <FilePreviewCard
                  key={file.id}
                  file={file}
                  onRemove={onRemoveFile}
                  onClick={onClickFile}
                  disabled={disabled}
                />
              ))}

              {/* In-progress uploads */}
              {uploadQueue.map((upload) => (
                <FilePreviewCard key={upload.tempId} upload={upload} />
              ))}
            </AnimatePresence>
          </div>

          {/* Clear all button */}
          {files.length > 1 && (
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={disabled}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all ${
                  showClearConfirm
                    ? "bg-(--danger)/10 text-(--danger) hover:bg-(--danger)/20"
                    : "text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/5"
                } disabled:opacity-50`}
              >
                <Trash2 className="w-3 h-3" />
                {showClearConfirm
                  ? t?.confirmClearAll || "Click again to confirm"
                  : t?.clearAllFiles || "Clear all"}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default FilePreviewArea;

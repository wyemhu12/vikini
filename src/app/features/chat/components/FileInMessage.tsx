/**
 * FileInMessage — Compact file indicator for chat bubbles.
 *
 * Shows a collapsible "📎 N files attached" bar in user messages.
 * Expandable to show file cards with preview/click capabilities.
 */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { FilePreviewCard } from "./FilePreviewCard";
import { useFiles } from "@/lib/features/files/useFiles";
import type { FileItem } from "@/types/files";

interface FileInMessageProps {
  conversationId: string;
  onClick?: (file: FileItem) => void;
  t?: Record<string, string>;
}

export function FileInMessage({ conversationId, onClick, t }: FileInMessageProps) {
  const { files, fileCount } = useFiles(conversationId);
  const [expanded, setExpanded] = useState(false);

  if (fileCount === 0) return null;

  return (
    <div className="mb-2 w-full">
      {/* Compact bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-secondary) text-xs transition-colors w-full"
      >
        <Paperclip className="w-3.5 h-3.5" />
        <span>
          {fileCount} {t?.filesAttached || (fileCount === 1 ? "file attached" : "files attached")}
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
        )}
      </button>

      {/* Expanded file cards */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--control-border)] pt-2 pb-1 snap-x snap-mandatory">
              {files.map((file) => (
                <FilePreviewCard key={file.id} file={file} onClick={onClick} compact disabled />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileInMessage;

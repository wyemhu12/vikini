/**
 * useGlobalFileDropPaste - Window-level drag-and-drop and clipboard paste file listeners.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { extractPastedFiles } from "./uploadPresentation";

interface UseGlobalFileDropPasteOptions {
  disabled?: boolean;
  onFiles: (files: FileList | File[]) => void | Promise<void>;
}

export function useGlobalFileDropPaste({ disabled, onFiles }: UseGlobalFileDropPasteOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const onFilesRef = useRef(onFiles);

  useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);

  useEffect(() => {
    if (disabled) {
      dragCounterRef.current = 0;
      setIsDragging(false);
      return;
    }

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) void onFilesRef.current(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const pastedFiles = extractPastedFiles(e.clipboardData?.items);
      if (pastedFiles.length > 0) {
        e.preventDefault();
        void onFilesRef.current(pastedFiles);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled]);

  return { isDragging };
}

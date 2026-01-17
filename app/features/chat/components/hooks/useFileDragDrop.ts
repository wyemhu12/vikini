import { useState, useEffect, useRef, RefObject } from "react";
import type { AttachmentsPanelRef } from "../AttachmentsPanel";

export function useFileDragDrop(attachmentsRef: RefObject<AttachmentsPanelRef | null>) {
  const [showFiles, setShowFiles] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only care if dragging files
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        // dragCounter helps avoid flickering when entering child elements
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          if (!showFiles) setShowFiles(true);
        }
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounter.current -= 1;
        // If we left the window (counter 0)
        if (dragCounter.current === 0) {
          // Collapse if empty, implying user cancelled drag-to-upload
          if (fileCount === 0) {
            setShowFiles(false);
          }
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;

      if (e.dataTransfer?.files?.length && e.dataTransfer.files.length > 0) {
        if (attachmentsRef.current) {
          attachmentsRef.current.uploadFiles(e.dataTransfer.files);
          // Ensure it stays open
          if (!showFiles) setShowFiles(true);
        }
      } else {
        // If dropped something else or nothing, revert?
        // Typically if dropping files, length > 0.
        if (fileCount === 0) setShowFiles(false);
      }
    };

    // Using proper event handler types - DragEvent handlers are compatible with EventListener
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [showFiles, fileCount, attachmentsRef]);

  return {
    showFiles,
    setShowFiles,
    fileCount,
    setFileCount,
  };
}

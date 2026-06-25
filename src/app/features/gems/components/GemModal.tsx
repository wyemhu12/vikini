"use client";

import { useCallback } from "react";
import { useGemStore } from "../stores/useGemStore";
import GemManager from "./GemManager";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function GemModal() {
  const { isOpen, closeGemModal, hasDirtyEditor } = useGemStore();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (hasDirtyEditor) {
          const confirmed = window.confirm(
            "You have unsaved changes. Are you sure you want to close?"
          );
          if (!confirmed) return;
        }
        closeGemModal();
      }
    },
    [hasDirtyEditor, closeGemModal]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] max-w-5xl w-full h-[85vh] sm:h-[85vh] p-0 gap-0 bg-(--surface)/95 backdrop-blur-xl border border-(--border) overflow-hidden rounded-t-3xl sm:rounded-2xl flex flex-col slide-in-from-bottom sm:slide-in-from-bottom-0">
        <div className="sm:hidden w-12 h-1.5 bg-(--border) rounded-full mx-auto my-3 absolute left-1/2 -translate-x-1/2 z-50"></div>
        <DialogTitle className="sr-only">Gem Manager</DialogTitle>
        <div className="w-full h-full flex flex-col relative">
          <ErrorBoundary>
            <GemManager inModal={true} />
          </ErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}

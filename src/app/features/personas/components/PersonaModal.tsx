"use client";

import { useCallback } from "react";
import { usePersonaStore } from "../stores/usePersonaStore";
import PersonaManager from "./PersonaManager";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function PersonaModal() {
  const { isOpen, closePersonaModal, hasDirtyEditor } = usePersonaStore();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (hasDirtyEditor) {
          const confirmed = window.confirm(
            "You have unsaved changes. Are you sure you want to close?"
          );
          if (!confirmed) return;
        }
        closePersonaModal();
      }
    },
    [hasDirtyEditor, closePersonaModal]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-dvh sm:h-[85vh] p-0 gap-0 bg-(--surface)/95 backdrop-blur-xl border border-(--border) overflow-hidden rounded-none sm:rounded-2xl">
        <DialogTitle className="sr-only">Persona Manager</DialogTitle>
        <div className="w-full h-full flex flex-col relative">
          <ErrorBoundary>
            <PersonaManager inModal={true} />
          </ErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useRef } from "react";
import { usePersonaStore } from "../stores/usePersonaStore";
import PersonaManager from "./PersonaManager";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { confirm } from "@/lib/store/confirmStore";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export default function PersonaModal() {
  const { isOpen, closePersonaModal } = usePersonaStore();
  const { t } = useLanguage();
  const isConfirmingRef = useRef(false);

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (!open) {
        const hasDirty = usePersonaStore.getState().hasDirtyEditor;
        if (hasDirty) {
          if (isConfirmingRef.current) return;
          isConfirmingRef.current = true;
          try {
            const confirmed = await confirm({
              title: t("discardChangesTitle"),
              description: t("discardChangesDesc"),
              variant: "danger",
            });
            if (!confirmed) return;
          } finally {
            isConfirmingRef.current = false;
          }
        }
        closePersonaModal();
      }
    },
    [closePersonaModal, t]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="!fixed !bottom-0 !left-0 !right-0 !top-auto !translate-x-0 !translate-y-0 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] max-w-5xl w-full h-[85vh] sm:h-[85vh] p-0 gap-0 bg-(--surface)/95 backdrop-blur-xl border border-(--border) overflow-hidden rounded-t-3xl sm:rounded-2xl flex flex-col data-[state=open]:!slide-in-from-bottom sm:data-[state=open]:!slide-in-from-left-1/2">
        <div className="sm:hidden w-12 h-1.5 bg-(--border) rounded-full mx-auto my-3 absolute left-1/2 -translate-x-1/2 z-50"></div>
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

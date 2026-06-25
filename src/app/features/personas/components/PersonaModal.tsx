"use client";

import { usePersonaStore } from "../stores/usePersonaStore";
import PersonaManager from "./PersonaManager";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function PersonaModal() {
  const { isOpen, closePersonaModal } = usePersonaStore();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closePersonaModal()}>
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

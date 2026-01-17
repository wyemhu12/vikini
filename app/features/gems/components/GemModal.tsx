"use client";

import { useGemStore } from "../stores/useGemStore";
import GemManager from "./GemManager";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function GemModal() {
  const { isOpen, closeGemModal } = useGemStore();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeGemModal()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border)] overflow-hidden sm:rounded-2xl">
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

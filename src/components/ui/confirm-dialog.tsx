"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/lib/store/confirmStore";
// @ts-ignore - JS hook without type declarations
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

/**
 * Single mounted host that renders confirmation prompts requested via the
 * imperative `confirm()` API (see lib/store/confirmStore). Mount once near the
 * app root, alongside <ToastContainer />.
 *
 * Built on the Radix Dialog primitive, so focus trapping, ESC-to-close and
 * scroll locking come for free — the gaps the old hand-rolled modals had.
 */
export default function ConfirmDialogHost() {
  const { open, loading, options, settle } = useConfirmStore();
  const { language } = useLanguage();
  const vi = language === "vi";

  const variant = options?.variant ?? "default";
  const isDanger = variant === "danger";

  const confirmLabel = options?.confirmLabel ?? (vi ? "Xác nhận" : "Confirm");
  const cancelLabel = options?.cancelLabel ?? (vi ? "Huỷ" : "Cancel");

  const handleConfirm = async () => {
    try {
      await settle(true);
    } catch {
      // onConfirm failed; dialog stays open for retry. Caller surfaces the error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && settle(false)}>
      <DialogContent
        className={isDanger ? "max-w-md ring-(--danger)/20" : "max-w-md"}
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
        onInteractOutside={(e) => loading && e.preventDefault()}
      >
        {/* Danger glow accent (Direction C touch) */}
        {isDanger && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl"
          />
        )}

        <DialogHeader>
          <div className="flex items-center gap-3">
            {isDanger && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--danger)/30 bg-(--danger)/10">
                <AlertTriangle className="h-5 w-5 text-(--danger)" />
              </span>
            )}
            <DialogTitle>{options?.title}</DialogTitle>
          </div>
          {options?.description && (
            <DialogDescription className="pt-1">{options.description}</DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => settle(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {vi ? "Đang xử lý…" : "Working…"}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

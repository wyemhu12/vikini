// /app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx
"use client";

import React from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { DestructiveSavePromptState } from "../hooks/useStoryPersistenceLifecycle";

interface DestructiveSaveConfirmModalProps {
  prompt: DestructiveSavePromptState | null;
  onConfirmOverwrite: () => void;
  onReloadSafe: () => void;
}

export default function DestructiveSaveConfirmModal({
  prompt,
  onConfirmOverwrite,
  onReloadSafe,
}: DestructiveSaveConfirmModalProps) {
  const { t } = useLanguage();

  if (!prompt) return null;

  const descriptionText = t("novelcrafterDestructiveSaveDesc")
    .replace("{previous}", prompt.previousChars.toLocaleString())
    .replace("{next}", prompt.nextChars.toLocaleString());

  return (
    <Dialog open={Boolean(prompt)} onOpenChange={(open) => !open && onReloadSafe()}>
      <DialogContent className="max-w-md border-(--warning)/50">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-(--warning)">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <DialogTitle>{t("novelcrafterDestructiveSaveTitle")}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-xs md:text-sm text-(--text-secondary) leading-relaxed">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-3 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onReloadSafe}
            className="w-full sm:w-auto inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("novelcrafterDestructiveSaveReloadBtn")}</span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirmOverwrite}
            className="w-full sm:w-auto inline-flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t("novelcrafterDestructiveSaveConfirmBtn")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

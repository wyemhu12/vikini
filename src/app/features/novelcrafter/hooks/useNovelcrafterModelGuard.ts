// /app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts
"use client";

import { useCallback, useEffect } from "react";
import { isModelAllowedById, reconcileAllowedStoryModel } from "@/lib/core/modelAccess";
import { toast } from "@/lib/store/toastStore";
import type { TranslationKey } from "@/lib/utils/translations";

interface UseNovelcrafterModelGuardParams {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isLoadingState: boolean;
  allowedModelIds: ReadonlySet<string>;
  modelsLoading: boolean;
  modelsResolved: boolean;
  t: (key: TranslationKey) => string;
}

export function useNovelcrafterModelGuard({
  selectedModel,
  setSelectedModel,
  isLoadingState,
  allowedModelIds,
  modelsLoading,
  modelsResolved,
  t,
}: UseNovelcrafterModelGuardParams) {
  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (modelsLoading || !isModelAllowedById(modelId, allowedModelIds)) {
        toast.info(t("novelcrafterModelLockedToast"));
        return;
      }
      setSelectedModel(modelId);
    },
    [allowedModelIds, modelsLoading, setSelectedModel, t]
  );

  useEffect(() => {
    if (isLoadingState) return;
    const reconciled = reconcileAllowedStoryModel(
      selectedModel,
      allowedModelIds,
      modelsLoading,
      modelsResolved
    );
    if (reconciled.didFallback) {
      setSelectedModel(reconciled.model);
      toast.info(t("novelcrafterModelFallbackToast"));
    }
  }, [
    allowedModelIds,
    isLoadingState,
    modelsLoading,
    modelsResolved,
    selectedModel,
    setSelectedModel,
    t,
  ]);

  return { handleSelectModel };
}

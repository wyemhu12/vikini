// /app/features/chat/components/hooks/useModelSelection.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import { useAllowedModels } from "./useAllowedModels";

const LANDING_MODEL_KEY = "vikini-landing-model";

/** Model used for new chats (landing page), persisted to localStorage. */
export function useLandingModel() {
  const [landingModel, setLandingModel] = useState<string>(DEFAULT_MODEL);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem(LANDING_MODEL_KEY);
      if (savedModel && SELECTABLE_MODELS.some((m) => m.id === savedModel)) {
        setLandingModel(savedModel);
      }
    }
  }, []);

  const saveLandingModel = useCallback((modelId: string) => {
    setLandingModel(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANDING_MODEL_KEY, modelId);
    }
  }, []);

  return { landingModel, saveLandingModel };
}

interface UseModelSelectionOptions {
  isAuthed: boolean;
  selectedConversationId: string | null;
  saveLandingModel: (modelId: string) => void;
  patchConversationModel: (id: string, model: string) => void;
  setConversationModel: (id: string, model: string) => Promise<void>;
  openUpgradeModal: (modelName: string) => void;
  errorMessage: string;
}

/** Model permissions (rank-based) and the model change handler. */
export function useModelSelection({
  isAuthed,
  selectedConversationId,
  saveLandingModel,
  patchConversationModel,
  setConversationModel,
  openUpgradeModal,
  errorMessage,
}: UseModelSelectionOptions) {
  const { allowedModelIds, features, loading: modelsLoading } = useAllowedModels(isAuthed);

  const isModelAllowed = useCallback(
    (modelId: string) => {
      if (modelsLoading) return true;
      if (allowedModelIds.size === 0) return true;
      return allowedModelIds.has(modelId);
    },
    [allowedModelIds, modelsLoading]
  );

  const handleModelChange = useCallback(
    async (newModelId: string) => {
      if (!isModelAllowed(newModelId)) {
        const model = SELECTABLE_MODELS.find((m) => m.id === newModelId);
        openUpgradeModal(model?.name || newModelId);
        return;
      }
      if (!selectedConversationId) {
        saveLandingModel(newModelId);
        return;
      }
      try {
        patchConversationModel(selectedConversationId, newModelId);
        await setConversationModel(selectedConversationId, newModelId);
      } catch (e: unknown) {
        logger.error("Failed to change model:", e);
        toast.error(errorMessage);
      }
    },
    [
      isModelAllowed,
      selectedConversationId,
      saveLandingModel,
      patchConversationModel,
      setConversationModel,
      openUpgradeModal,
      errorMessage,
    ]
  );

  return { isModelAllowed, features, handleModelChange };
}

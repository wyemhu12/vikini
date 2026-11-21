"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { GeneratedImage } from "../Canvas";
import type { BatchQuotaInfo } from "../ControlPanel";
import type {
  CreateConversationOptions,
  FrontendConversation,
} from "@/lib/features/chat/conversationListHelpers";
import {
  buildFinalPrompt,
  buildGenerateImageBody,
  buildVariationPrompt,
  classifyStudioError,
  estimateGenerationSeconds,
  fileToBase64,
  postGenerateImageRequest,
  readStoredApiKey,
  resolveApiKeyStorageKey,
  type StudioErrorDisplay,
} from "@/lib/features/image-gen/studioHelpers";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import { formatDate } from "@/lib/utils/dateFormat";

export interface UseImageStudioActionsParams {
  prompt: string;
  negativePrompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  style: string;
  isEnhancerOn: boolean;
  numberOfImages: number;
  referenceImages: File[];
  generating: boolean;
  showDeleteConfirm: string | null;
  selectedConversationId: string | null;
  language: string;
  t: (key: string) => string;
  createConversation: (options?: CreateConversationOptions) => Promise<FrontendConversation | null>;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  setSelectedConversationId: (id: string | null) => void;
  setGenerating: Dispatch<SetStateAction<boolean>>;
  setGeneratingLabel: Dispatch<SetStateAction<string | null>>;
  setMobileTab: Dispatch<SetStateAction<"studio" | "results">>;
  setShowApiKeyWarning: Dispatch<SetStateAction<boolean>>;
  setShowError: Dispatch<SetStateAction<StudioErrorDisplay | null>>;
  setShowDeleteConfirm: Dispatch<SetStateAction<string | null>>;
  setBatchQuota: Dispatch<SetStateAction<BatchQuotaInfo>>;
  addToPromptHistory: (p: string) => void;
}

export function useImageStudioActions(params: UseImageStudioActionsParams) {
  const {
    prompt,
    negativePrompt,
    model,
    aspectRatio,
    resolution,
    style,
    isEnhancerOn,
    numberOfImages,
    referenceImages,
    generating,
    showDeleteConfirm,
    selectedConversationId,
    language,
    t,
    createConversation,
    loadConversation,
    refreshConversations,
    setSelectedConversationId,
    setGenerating,
    setGeneratingLabel,
    setMobileTab,
    setShowApiKeyWarning,
    setShowError,
    setShowDeleteConfirm,
    setBatchQuota,
    addToPromptHistory,
  } = params;

  const genStartTimeRef = useRef<number>(0);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
    };
  }, []);

  const fetchBatchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/batch-gen-quota");
      if (res.ok) {
        const json = await res.json();
        const payload = json.data ?? json;
        if (payload.maxBatchSize) setBatchQuota(payload);
      }
    } catch (e: unknown) {
      logger.warn("Failed to fetch batch quota:", e);
    }
  }, [setBatchQuota]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const { storageKey, requiresUserKey } = resolveApiKeyStorageKey(model);
    const key = readStoredApiKey(storageKey);
    if (requiresUserKey && !key) {
      setShowApiKeyWarning(true);
      return;
    }

    let targetId = selectedConversationId;
    if (!targetId) {
      const newProj = await createConversation({
        title: `${t("studioNewProject")} ${formatDate(new Date(), language === "vi" ? "vi-VN" : "en-GB")}`,
        model: "vikini-image-studio",
      });
      if (newProj) {
        targetId = newProj.id;
        setSelectedConversationId(newProj.id);
      } else {
        setShowError({ message: t("studioCreateProjectFailed") });
        return;
      }
    }

    setGenerating(true);
    setMobileTab("results");
    genStartTimeRef.current = Date.now();
    setGeneratingLabel(
      `${t("studioGenerating")} (~${estimateGenerationSeconds(model, numberOfImages)}s)`
    );

    genTimerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - genStartTimeRef.current) / 1000);
      setGeneratingLabel(`${t("studioGenerating")} (${elapsed}s)`);
    }, 1000);

    const finalPrompt = buildFinalPrompt(prompt, negativePrompt);
    const referenceImagesBase64: string[] = [];
    if (referenceImages.length > 0) {
      try {
        for (const refFile of referenceImages) {
          referenceImagesBase64.push(await fileToBase64(refFile));
        }
      } catch (e: unknown) {
        logger.warn("Failed to convert reference images:", e);
      }
    }

    const totalImages = numberOfImages;
    let successCount = 0;
    const sendOne = async () => {
      const body = buildGenerateImageBody({
        prompt: finalPrompt,
        conversationId: targetId!,
        model,
        aspectRatio,
        resolution,
        style,
        isEnhancerOn,
        referenceImagesBase64,
        batchSize: totalImages > 1 ? totalImages : undefined,
      });
      const json = await postGenerateImageRequest(body, key, "Generation failed");
      if (json.success) {
        successCount++;
        if (totalImages > 1) {
          setGeneratingLabel(
            t("studioGeneratingProgress")
              .replace("{current}", String(successCount))
              .replace("{total}", String(totalImages))
          );
        }
      }
      return json;
    };

    try {
      if (totalImages > 1) {
        setGeneratingLabel(
          t("studioGeneratingProgress")
            .replace("{current}", "1")
            .replace("{total}", String(totalImages))
        );
        const results = await Promise.allSettled(
          Array.from({ length: totalImages }, () => sendOne())
        );
        const failures = results.filter((r) => r.status === "rejected").length;
        if (successCount > 0) {
          await loadConversation(targetId!);
          void refreshConversations();
        }
        if (failures > 0 && successCount === 0) {
          const firstRejected = results.find(
            (r) => r.status === "rejected"
          ) as PromiseRejectedResult;
          throw firstRejected.reason;
        }
      } else {
        await sendOne();
        if (successCount > 0) {
          await loadConversation(targetId!);
          void refreshConversations();
        }
      }
      if (successCount > 0) addToPromptHistory(prompt);
    } catch (error: unknown) {
      logger.error("Gen Error:", error);
      if (successCount === 0) {
        const errMsg = error instanceof Error ? error.message : "";
        setShowError(classifyStudioError(errMsg || t("studioGenerateFailed"), t));
      }
    } finally {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
      setGenerating(false);
      setGeneratingLabel(null);
      if (totalImages > 1) void fetchBatchQuota();
    }
  }, [
    prompt,
    negativePrompt,
    model,
    aspectRatio,
    resolution,
    style,
    isEnhancerOn,
    numberOfImages,
    referenceImages,
    selectedConversationId,
    createConversation,
    loadConversation,
    refreshConversations,
    fetchBatchQuota,
    addToPromptHistory,
    setSelectedConversationId,
    setGenerating,
    setGeneratingLabel,
    setMobileTab,
    setShowApiKeyWarning,
    setShowError,
    t,
    language,
  ]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!showDeleteConfirm) return;
    try {
      const res = await fetch(`/api/messages/${showDeleteConfirm}`, { method: "DELETE" });
      if (res.ok && selectedConversationId) void loadConversation(selectedConversationId);
    } catch (e: unknown) {
      logger.error("Delete error:", e);
      toast.error(t("studioDeleteFailed") || "Failed to delete image");
    } finally {
      setShowDeleteConfirm(null);
    }
  }, [showDeleteConfirm, selectedConversationId, loadConversation, setShowDeleteConfirm, t]);

  const handleVariation = useCallback(
    async (image: GeneratedImage) => {
      if (generating || !selectedConversationId) return;
      const targetId = selectedConversationId;
      setGenerating(true);
      setMobileTab("results");
      setGeneratingLabel(t("studioCreatingVariation"));

      try {
        const response = await fetch(image.url);
        const base64 = await fileToBase64(await response.blob());
        const key = readStoredApiKey("vikini-gemini-key");
        const variationModel = model.includes("gemini-3") ? model : "gemini-3.1-flash-image";
        const json = await postGenerateImageRequest(
          {
            prompt: buildVariationPrompt(image.prompt),
            conversationId: targetId,
            options: {
              model: variationModel,
              aspectRatio: image.aspectRatio || aspectRatio,
              referenceImage: base64,
            },
          },
          key,
          "Variation failed"
        );
        if (json.success) {
          await loadConversation(targetId);
          void refreshConversations();
        }
      } catch (error: unknown) {
        logger.error("Variation Error:", error);
        const errMsg = error instanceof Error ? error.message : "";
        setShowError(classifyStudioError(errMsg || t("studioGenerateFailed"), t));
      } finally {
        setGenerating(false);
        setGeneratingLabel(null);
      }
    },
    [
      generating,
      selectedConversationId,
      model,
      aspectRatio,
      loadConversation,
      refreshConversations,
      setGenerating,
      setGeneratingLabel,
      setMobileTab,
      setShowError,
      t,
    ]
  );

  const handleToggleFavorite = useCallback(
    async (image: GeneratedImage) => {
      if (!image.id) return;
      try {
        const res = await fetch(`/api/messages/${image.id}/favorite`, { method: "PATCH" });
        if (res.ok && selectedConversationId) await loadConversation(selectedConversationId);
      } catch (e: unknown) {
        logger.error("Favorite toggle error:", e);
        toast.error(t("studioFavoriteFailed") || "Failed to update favorite");
      }
    },
    [selectedConversationId, loadConversation, t]
  );

  return {
    fetchBatchQuota,
    handleGenerate,
    handleDeleteConfirm,
    handleVariation,
    handleToggleFavorite,
  };
}

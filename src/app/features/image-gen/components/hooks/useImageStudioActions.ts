"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GeneratedImage } from "../Canvas";
import {
  ReferenceImageUploadError,
  buildFinalPrompt,
  buildGenerateImageBody,
  classifyStudioError,
  estimateGenerationSeconds,
  fetchStudioBatchQuota,
  postGenerateImageRequest,
  readStoredApiKey,
  requestImageVariation,
  resolveApiKeyStorageKey,
  resolveBatchFailureReason,
  uploadReferenceImages,
} from "@/lib/features/image-gen/studioHelpers";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import { formatDate } from "@/lib/utils/dateFormat";
import type { UseImageStudioActionsParams } from "./imageStudioTypes";

export type { UseImageStudioActionsParams };

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
  const generatingRef = useRef(false);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
    };
  }, []);

  const fetchBatchQuota = useCallback(async () => {
    const quota = await fetchStudioBatchQuota((e) =>
      logger.warn("Failed to fetch batch quota:", e)
    );
    if (quota && !isUnmountedRef.current) setBatchQuota(quota);
  }, [setBatchQuota]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generatingRef.current) return;

    const { storageKey, requiresUserKey } = resolveApiKeyStorageKey(model);
    const key = readStoredApiKey(storageKey);
    if (requiresUserKey && !key) {
      setShowApiKeyWarning(true);
      return;
    }

    generatingRef.current = true;
    let successCount = 0;
    let startedGeneration = false;

    try {
      let targetId = selectedConversationId;
      if (!targetId) {
        const newProj = await createConversation({
          title: `${t("studioNewProject")} ${formatDate(new Date(), language === "vi" ? "vi-VN" : "en-GB")}`,
          model: "vikini-image-studio",
        });
        if (isUnmountedRef.current) return;
        if (newProj) {
          targetId = newProj.id;
          setSelectedConversationId(newProj.id);
        } else {
          setShowError({ message: t("studioCreateProjectFailed") });
          return;
        }
      }

      startedGeneration = true;
      setGenerating(true);
      setMobileTab("results");
      genStartTimeRef.current = Date.now();
      setGeneratingLabel(
        `${t("studioGenerating")} (~${estimateGenerationSeconds(model, numberOfImages)}s)`
      );

      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
      }
      genTimerRef.current = setInterval(() => {
        if (isUnmountedRef.current) return;
        const elapsed = Math.round((Date.now() - genStartTimeRef.current) / 1000);
        setGeneratingLabel(`${t("studioGenerating")} (${elapsed}s)`);
      }, 1000);

      const finalPrompt = buildFinalPrompt(prompt, negativePrompt);
      const resolvedTargetId = targetId;
      const sendOne = async () => {
        const referenceImagePaths =
          referenceImages.length > 0
            ? await uploadReferenceImages(
                referenceImages,
                resolvedTargetId,
                t("studioRefUploadFailed")
              )
            : [];
        if (isUnmountedRef.current) return { success: false };

        const body = buildGenerateImageBody({
          prompt: finalPrompt,
          conversationId: resolvedTargetId,
          model,
          aspectRatio,
          resolution,
          style,
          isEnhancerOn,
          referenceImagePaths,
          batchSize: numberOfImages > 1 ? numberOfImages : undefined,
        });
        const json = await postGenerateImageRequest(body, key, "Generation failed");
        if (json.success) {
          successCount++;
          if (numberOfImages > 1 && !isUnmountedRef.current) {
            setGeneratingLabel(
              t("studioGeneratingProgress")
                .replace("{current}", String(successCount))
                .replace("{total}", String(numberOfImages))
            );
          }
        }
        return json;
      };

      if (numberOfImages > 1) {
        setGeneratingLabel(
          t("studioGeneratingProgress")
            .replace("{current}", "1")
            .replace("{total}", String(numberOfImages))
        );
        const results = await Promise.allSettled(
          Array.from({ length: numberOfImages }, () => sendOne())
        );
        const batchError = resolveBatchFailureReason(
          results,
          successCount,
          t("studioGenerateFailed")
        );
        if (batchError) throw batchError;
      } else {
        await sendOne();
      }
      if (successCount > 0 && !isUnmountedRef.current) {
        await loadConversation(resolvedTargetId);
        void refreshConversations();
        addToPromptHistory(prompt);
      }
    } catch (error: unknown) {
      logger.error("Gen Error:", error);
      if (successCount === 0 && !isUnmountedRef.current) {
        if (error instanceof ReferenceImageUploadError) {
          toast.error(t("studioRefUploadFailed"));
        } else {
          setShowError(classifyStudioError(error instanceof Error ? error.message : "", t));
        }
      }
    } finally {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
      generatingRef.current = false;
      if (!isUnmountedRef.current) {
        setGenerating(false);
        setGeneratingLabel(null);
        if (startedGeneration && numberOfImages > 1) void fetchBatchQuota();
      }
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
      const res = await fetch(`/api/messages/${encodeURIComponent(showDeleteConfirm)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (selectedConversationId) void loadConversation(selectedConversationId);
    } catch (e: unknown) {
      logger.error("Delete error:", e);
      toast.error(t("studioDeleteFailed"));
    } finally {
      if (!isUnmountedRef.current) setShowDeleteConfirm(null);
    }
  }, [showDeleteConfirm, selectedConversationId, loadConversation, setShowDeleteConfirm, t]);

  const handleVariation = useCallback(
    async (image: GeneratedImage) => {
      if (generating || generatingRef.current || !selectedConversationId) return;
      generatingRef.current = true;
      const targetId = selectedConversationId;
      setGenerating(true);
      setMobileTab("results");
      setGeneratingLabel(t("studioCreatingVariation"));

      try {
        const json = await requestImageVariation({
          imageUrl: image.url,
          originalPrompt: image.prompt,
          conversationId: targetId,
          model,
          aspectRatio: image.aspectRatio || aspectRatio,
        });
        if (json.success && !isUnmountedRef.current) {
          await loadConversation(targetId);
          void refreshConversations();
        }
      } catch (error: unknown) {
        logger.error("Variation Error:", error);
        if (!isUnmountedRef.current) {
          setShowError(classifyStudioError(error instanceof Error ? error.message : "", t));
        }
      } finally {
        generatingRef.current = false;
        if (!isUnmountedRef.current) {
          setGenerating(false);
          setGeneratingLabel(null);
        }
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
        const res = await fetch(`/api/messages/${encodeURIComponent(image.id)}/favorite`, {
          method: "PATCH",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (selectedConversationId) await loadConversation(selectedConversationId);
      } catch (e: unknown) {
        logger.error("Favorite toggle error:", e);
        toast.error(t("studioFavoriteFailed"));
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

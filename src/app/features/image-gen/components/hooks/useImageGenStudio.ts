// Image Gen Studio controller hook
// Extracted from ImageGenStudio.tsx for modularity

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { GeneratedImage } from "../Canvas";
import type { BatchQuotaInfo } from "../ControlPanel";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";
import {
  useConversation,
  type FrontendConversation,
  type FrontendMessage,
} from "../../../chat/hooks/useConversation";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { useSearchParams } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { formatDate } from "@/lib/utils/dateFormat";

/** Classify raw error messages into user-friendly i18n messages + suggestions */
function classifyError(
  errorMsg: string,
  t: (key: string) => string
): { message: string; suggestion?: string } {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("safety") || lower.includes("blocked")) {
    return {
      message: t("studioErrorSafety"),
      suggestion: t("studioErrorSafetySuggestion"),
    };
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many")) {
    return {
      message: t("studioErrorRateLimit"),
      suggestion: t("studioErrorRateLimitSuggestion"),
    };
  }
  if (lower.includes("content policy") || lower.includes("recitation")) {
    return {
      message: t("studioErrorContentPolicy"),
      suggestion: t("studioErrorContentPolicySuggestion"),
    };
  }
  return { message: errorMsg || t("studioGenerateFailed") };
}

export function useImageGenStudio() {
  const { t, language } = useLanguage();

  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
    messages,
    refreshConversations,
  } = useConversation();

  // Filter for Image Studio Projects
  const studioProjects = useMemo(() => {
    return (conversations || []).filter(
      (c: FrontendConversation) => c.model === "vikini-image-studio"
    );
  }, [conversations]);

  // UI States
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState("gemini-3.1-flash-image");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");
  const [style, setStyle] = useState("none");
  const [isEnhancerOn, setIsEnhancerOn] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mobileTab, setMobileTab] = useState<"studio" | "results">("studio");

  // Modal States
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showError, setShowError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Edit / Reference / Lightbox
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [templateModalTarget, setTemplateModalTarget] = useState<ImageTemplate | null>(null);

  // Batch Generation
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [batchQuota, setBatchQuota] = useState<BatchQuotaInfo>({
    rank: "basic",
    maxBatchSize: 2,
    quotas: { 2: { limit: 10, used: 0, remaining: 10 } },
  });
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

  // Time tracking refs
  const genStartTimeRef = useRef<number>(0);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read ?prompt= query param
  const searchParams = useSearchParams();
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    if (promptParam) setPrompt(promptParam);
  }, [searchParams]);

  // Sync messages to generatedImages
  const generatedImages: GeneratedImage[] = useMemo(() => {
    return messages
      .filter((msg: FrontendMessage) => msg.role === "assistant" && msg.meta?.imageUrl)
      .map((msg: FrontendMessage) => {
        const meta = msg.meta!;
        const opts = meta.originalOptions || {};
        return {
          id: msg.id,
          url: meta.imageUrl!,
          prompt: meta.prompt || msg.content || "Unknown prompt",
          aspectRatio: opts.aspectRatio,
          style: opts.style,
          model: opts.model,
          enhancer: opts.enhancer,
          originalPrompt: meta.originalPrompt as string | undefined,
          enhancedPrompt: meta.enhancedPrompt as string | undefined,
          isFavorite: !!meta.is_favorite,
          parentMessageId: meta.parentMessageId as string | undefined,
          editDepth: meta.editDepth as number | undefined,
          tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : undefined,
          aiComment: meta.aiComment as string | undefined,
        };
      })
      .reverse();
  }, [messages]);

  // Load messages when ID changes
  useEffect(() => {
    if (selectedConversationId) void loadConversation(selectedConversationId);
  }, [selectedConversationId, loadConversation]);

  // Fetch batch quota
  const fetchBatchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/batch-gen-quota");
      if (res.ok) {
        const json = await res.json();
        const payload = json.data ?? json;
        if (payload.maxBatchSize) setBatchQuota(payload);
      }
    } catch (e) {
      logger.warn("Failed to fetch batch quota:", e);
    }
  }, []);

  // Prompt History
  const HISTORY_KEY = "vikini-prompt-history";
  const MAX_HISTORY = 30;
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setPromptHistory(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const addToPromptHistory = useCallback((p: string) => {
    setPromptHistory((prev) => {
      const deduped = prev.filter((h) => h !== p);
      const next = [p, ...deduped].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearPromptHistory = useCallback(() => {
    setPromptHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // API key check
  const getRequiredApiKey = useCallback(() => {
    if (model.includes("gpt-image")) {
      return { key: localStorage.getItem("vikini-openai-key") || "", provider: "OpenAI" };
    } else if (model.includes("flux") || model.includes("replicate")) {
      return { key: localStorage.getItem("vikini-replicate-key") || "", provider: "Replicate" };
    }
    return { key: localStorage.getItem("vikini-gemini-key") || "", provider: "Gemini" };
  }, [model]);

  // Create project
  const handleCreateProject = useCallback(async () => {
    const newProj = await createConversation({
      title: t("studioNewProject"),
      model: "vikini-image-studio",
    });
    if (newProj) setSelectedConversationId(newProj.id);
    return newProj;
  }, [createConversation, t, setSelectedConversationId]);

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const { key } = getRequiredApiKey();
    if (
      (model.includes("gpt-image") || model.includes("flux") || model.includes("replicate")) &&
      !key
    ) {
      setShowApiKeyWarning(true);
      return;
    }

    let targetId = selectedConversationId;
    if (!targetId) {
      const newProj = await createConversation({
        title:
          t("studioNewProject") +
          " " +
          formatDate(new Date(), language === "vi" ? "vi-VN" : "en-GB"),
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
    const perImageSec = model.includes("pro") ? 20 : model.includes("gemini") ? 12 : 15;
    const estimatedTotal = perImageSec * numberOfImages;
    setGeneratingLabel(`${t("studioGenerating")} (~${estimatedTotal}s)`);

    genTimerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - genStartTimeRef.current) / 1000);
      setGeneratingLabel(`${t("studioGenerating")} (${elapsed}s)`);
    }, 1000);

    let finalPrompt = prompt;
    if (negativePrompt.trim()) {
      finalPrompt = `${prompt}\nDo NOT include: ${negativePrompt.trim()}`;
    }

    const referenceImagesBase64: string[] = [];
    if (referenceImages.length > 0) {
      try {
        for (const refFile of referenceImages) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(refFile);
          });
          referenceImagesBase64.push(base64);
        }
      } catch (e) {
        logger.warn("Failed to convert reference images:", e);
      }
    }

    const totalImages = numberOfImages;
    let successCount = 0;

    try {
      if (totalImages > 1) {
        setGeneratingLabel(
          t("studioGeneratingProgress")
            .replace("{current}", "1")
            .replace("{total}", String(totalImages))
        );

        const promises = Array.from({ length: totalImages }, (_) =>
          fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": key },
            body: JSON.stringify({
              prompt: finalPrompt,
              conversationId: targetId,
              options: {
                model,
                aspectRatio,
                resolution: model.includes("gemini-3") ? resolution : undefined,
                style: style === "none" ? undefined : style,
                enhancer: isEnhancerOn,
                referenceImages:
                  referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
              },
              batchSize: totalImages,
            }),
          }).then(async (response) => {
            const json = await response.json();
            if (!response.ok) {
              throw new Error(json.error?.message || json.error || "Generation failed");
            }
            if (json.success) {
              successCount++;
              setGeneratingLabel(
                t("studioGeneratingProgress")
                  .replace("{current}", String(successCount))
                  .replace("{total}", String(totalImages))
              );
            }
            return json;
          })
        );

        const results = await Promise.allSettled(promises);
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
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({
            prompt: finalPrompt,
            conversationId: targetId,
            options: {
              model,
              aspectRatio,
              resolution: model.includes("gemini-3") ? resolution : undefined,
              style: style === "none" ? undefined : style,
              enhancer: isEnhancerOn,
              referenceImages: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
            },
          }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error?.message || json.error || "Generation failed");
        }

        if (json.success) {
          successCount++;
          await loadConversation(targetId!);
          void refreshConversations();
        }
      }

      if (successCount > 0) addToPromptHistory(prompt);
    } catch (error: unknown) {
      logger.error("Gen Error:", error);
      if (successCount === 0) {
        const errMsg = error instanceof Error ? error.message : "";
        setShowError(classifyError(errMsg || t("studioGenerateFailed"), t));
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
    getRequiredApiKey,
    setSelectedConversationId,
    t,
    language,
  ]);

  // Remix
  const handleRemix = useCallback((image: GeneratedImage) => {
    setPrompt(image.prompt);
    if (image.aspectRatio) setAspectRatio(image.aspectRatio);
    if (image.style) setStyle(image.style);
    if (image.model) setModel(image.model);
    if (image.enhancer !== undefined) setIsEnhancerOn(image.enhancer);
    setMobileTab("studio");
  }, []);

  // Template selection
  const handleSelectTemplate = useCallback((template: ImageTemplate) => {
    if (template.requiresPhoto) {
      setTemplateModalTarget(template);
    } else {
      setPrompt(template.prompt);
      if (template.style && template.style !== "none") setStyle(template.style);
      setMobileTab("studio");
    }
  }, []);

  const handleTemplatePhoto = useCallback((template: ImageTemplate, file: File) => {
    setPrompt(template.prompt);
    if (template.style && template.style !== "none") setStyle(template.style);
    setReferenceImages([file]);
    setTemplateModalTarget(null);
    setMobileTab("studio");
  }, []);

  // Edit handlers
  const handleEdit = useCallback((image: GeneratedImage) => setEditingImage(image), []);
  const handleCloseEditPanel = useCallback(() => setEditingImage(null), []);
  const handleEditComplete = useCallback(() => {
    if (selectedConversationId) void loadConversation(selectedConversationId);
  }, [selectedConversationId, loadConversation]);

  // Lightbox
  const handleImageClick = useCallback((_image: GeneratedImage, index: number) => {
    setLightboxIndex(index);
  }, []);

  // Delete
  const handleDeleteRequest = useCallback((id: string) => setShowDeleteConfirm(id), []);
  const handleDeleteConfirm = useCallback(async () => {
    if (!showDeleteConfirm) return;
    try {
      const res = await fetch(`/api/messages/${showDeleteConfirm}`, { method: "DELETE" });
      if (res.ok && selectedConversationId) void loadConversation(selectedConversationId);
    } catch (e) {
      logger.error("Delete error:", e);
      toast.error(t("studioDeleteFailed") || "Failed to delete image");
    } finally {
      setShowDeleteConfirm(null);
    }
  }, [showDeleteConfirm, selectedConversationId, loadConversation, t]);

  // Variation
  const handleVariation = useCallback(
    async (image: GeneratedImage) => {
      if (generating) return;
      const targetId = selectedConversationId;
      if (!targetId) return;

      setGenerating(true);
      setMobileTab("results");
      setGeneratingLabel(t("studioCreatingVariation"));

      try {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const variationPrompt = `Create a variation of this image. Keep the same overall composition, style, and mood, but introduce subtle creative differences in details, colors, or perspective. Original description: ${image.prompt}`;
        const key = localStorage.getItem("vikini-gemini-key") || "";
        const variationModel = model.includes("gemini-3") ? model : "gemini-3.1-flash-image";

        const genResponse = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({
            prompt: variationPrompt,
            conversationId: targetId,
            options: {
              model: variationModel,
              aspectRatio: image.aspectRatio || aspectRatio,
              referenceImage: base64,
            },
          }),
        });

        const json = await genResponse.json();
        if (!genResponse.ok) {
          throw new Error(json.error?.message || json.error || "Variation failed");
        }

        if (json.success) {
          await loadConversation(targetId);
          void refreshConversations();
        }
      } catch (error: unknown) {
        logger.error("Variation Error:", error);
        const errMsg = error instanceof Error ? error.message : "";
        setShowError(classifyError(errMsg || t("studioGenerateFailed"), t));
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
      t,
    ]
  );

  // Favorite toggle
  const handleToggleFavorite = useCallback(
    async (image: GeneratedImage) => {
      if (!image.id) return;
      try {
        const res = await fetch(`/api/messages/${image.id}/favorite`, { method: "PATCH" });
        if (res.ok && selectedConversationId) await loadConversation(selectedConversationId);
      } catch (e) {
        logger.error("Favorite toggle error:", e);
        toast.error(t("studioFavoriteFailed") || "Failed to update favorite");
      }
    },
    [selectedConversationId, loadConversation, t]
  );

  // Rename
  const handleRename = useCallback(
    (id: string) => {
      const current = studioProjects.find((p: FrontendConversation) => p.id === id);
      setRenameValue(current?.title || "");
      setShowRenameModal(id);
    },
    [studioProjects]
  );

  const confirmRename = useCallback(async () => {
    if (!showRenameModal || !renameValue.trim()) return;
    void renameConversation(showRenameModal, renameValue.trim());
    setShowRenameModal(null);
    setRenameValue("");
  }, [showRenameModal, renameValue, renameConversation]);

  // Delete project (with confirmation)
  const handleDeleteProject = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t("deleteConfirm") || "Delete this project?",
        description:
          t("studioDeleteProjectDesc") ||
          "All generated images in this project will be permanently deleted.",
        variant: "danger",
        confirmLabel: t("modalDeleteButton") || "Delete",
        cancelLabel: t("cancel") || "Cancel",
      });
      if (ok) void deleteConversation(id);
    },
    [t, deleteConversation]
  );

  return {
    // Data
    t,
    language,
    conversations,
    studioProjects,
    generatedImages,
    selectedConversationId,
    setSelectedConversationId,
    // UI State
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    style,
    setStyle,
    isEnhancerOn,
    setIsEnhancerOn,
    generating,
    mobileTab,
    setMobileTab,
    generatingLabel,
    // Modals
    showApiKeyWarning,
    setShowApiKeyWarning,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showError,
    setShowError,
    showRenameModal,
    setShowRenameModal,
    renameValue,
    setRenameValue,
    // Edit / Reference / Lightbox
    editingImage,
    referenceImages,
    setReferenceImages,
    lightboxIndex,
    setLightboxIndex,
    templateModalTarget,
    setTemplateModalTarget,
    // Batch
    numberOfImages,
    setNumberOfImages,
    batchQuota,
    // Prompt History
    promptHistory,
    clearPromptHistory,
    // Handlers
    handleCreateProject,
    handleGenerate,
    handleRemix,
    handleSelectTemplate,
    handleTemplatePhoto,
    handleEdit,
    handleCloseEditPanel,
    handleEditComplete,
    handleImageClick,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleVariation,
    handleToggleFavorite,
    handleRename,
    confirmRename,
    handleDeleteProject,
    fetchBatchQuota,
  };
}

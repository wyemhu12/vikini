// Image Gen Studio controller hook
// Extracted from ImageGenStudio.tsx for modularity

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { GeneratedImage } from "../Canvas";
import type { BatchQuotaInfo } from "../ControlPanel";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";
import { useConversation, type FrontendConversation } from "../../../chat/hooks/useConversation";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { confirm } from "@/lib/store/confirmStore";
import {
  mapMessagesToGeneratedImages,
  type StudioErrorDisplay,
} from "@/lib/features/image-gen/studioHelpers";
import { usePromptHistory } from "./usePromptHistory";
import { useImageStudioActions } from "./useImageStudioActions";

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

  const studioProjects = useMemo(
    () =>
      (conversations || []).filter((c: FrontendConversation) => c.model === "vikini-image-studio"),
    [conversations]
  );

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
  const [showError, setShowError] = useState<StudioErrorDisplay | null>(null);
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

  const searchParams = useSearchParams();
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    if (promptParam) setPrompt(promptParam);
  }, [searchParams]);

  useEffect(() => {
    const projectIdParam = searchParams.get("projectId");
    if (projectIdParam) setSelectedConversationId(projectIdParam);
  }, [searchParams, setSelectedConversationId]);

  const generatedImages = useMemo(() => mapMessagesToGeneratedImages(messages), [messages]);

  useEffect(() => {
    if (selectedConversationId) void loadConversation(selectedConversationId);
  }, [selectedConversationId, loadConversation]);

  const { promptHistory, addToPromptHistory, clearPromptHistory } = usePromptHistory();

  const {
    fetchBatchQuota,
    handleGenerate,
    handleDeleteConfirm,
    handleVariation,
    handleToggleFavorite,
  } = useImageStudioActions({
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
  });

  const handleCreateProject = useCallback(async () => {
    const newProj = await createConversation({
      title: t("studioNewProject"),
      model: "vikini-image-studio",
    });
    if (newProj) setSelectedConversationId(newProj.id);
    return newProj;
  }, [createConversation, t, setSelectedConversationId]);

  const handleRemix = useCallback((image: GeneratedImage) => {
    setPrompt(image.prompt);
    if (image.aspectRatio) setAspectRatio(image.aspectRatio);
    if (image.style) setStyle(image.style);
    if (image.model) setModel(image.model);
    if (image.enhancer !== undefined) setIsEnhancerOn(image.enhancer);
    setMobileTab("studio");
  }, []);

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

  const handleEdit = useCallback((image: GeneratedImage) => setEditingImage(image), []);
  const handleCloseEditPanel = useCallback(() => setEditingImage(null), []);
  const handleEditComplete = useCallback(() => {
    if (selectedConversationId) void loadConversation(selectedConversationId);
  }, [selectedConversationId, loadConversation]);

  const handleImageClick = useCallback((_image: GeneratedImage, index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => setShowDeleteConfirm(id), []);

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

  const handleDeleteProject = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t("studioDeleteProjectTitle") || "Delete this project?",
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
    t,
    language,
    conversations,
    studioProjects,
    generatedImages,
    selectedConversationId,
    setSelectedConversationId,
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
    editingImage,
    referenceImages,
    setReferenceImages,
    lightboxIndex,
    setLightboxIndex,
    templateModalTarget,
    setTemplateModalTarget,
    numberOfImages,
    setNumberOfImages,
    batchQuota,
    promptHistory,
    clearPromptHistory,
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

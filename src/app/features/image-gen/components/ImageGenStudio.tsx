"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import ControlPanel, { type BatchQuotaInfo } from "./ControlPanel";
import Canvas, { GeneratedImage } from "./Canvas";
import EditPanel from "./EditPanel";
import ImageLightbox from "./ImageLightbox";
import TemplateModal from "./TemplateModal";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";

import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";

import {
  useConversation,
  FrontendConversation,
  FrontendMessage,
} from "../../chat/hooks/useConversation";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logger } from "@/lib/utils/logger";
import { cn } from "@/lib/utils/cn";
import { confirm } from "@/lib/store/confirmStore";
import { formatDate } from "@/lib/utils/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Images } from "lucide-react";

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
  // Default — use the raw error if meaningful, otherwise generic
  return { message: errorMsg || t("studioGenerateFailed") };
}

export function ImageGenStudio() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const { theme: _theme, toggleTheme: _toggleTheme } = useTheme();
  const { t, language, setLanguage: _setLanguage } = useLanguage();

  // Use shared conversation hook
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
    messages, // Contains current project messages
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
  const [negativePrompt, setNegativePrompt] = useState(""); // QW1
  const [model, setModel] = useState("gemini-3.1-flash-image");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K"); // QW-A
  const [style, setStyle] = useState("none");
  const [isEnhancerOn, setIsEnhancerOn] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Read ?prompt= query param from Describe Image "Use in Studio" button
  const searchParams = useSearchParams();
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    if (promptParam) {
      setPrompt(promptParam);
    }
  }, [searchParams]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<"studio" | "results">("studio");

  // Modal States
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showError, setShowError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Phase 1: Edit Image
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);

  // Phase 2: Reference Images (multi, QW-D)
  const [referenceImages, setReferenceImages] = useState<File[]>([]);

  // Phase 3: Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Template Gallery
  const [templateModalTarget, setTemplateModalTarget] = useState<ImageTemplate | null>(null);

  // Phase 4: Batch Generation
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [batchQuota, setBatchQuota] = useState<BatchQuotaInfo>({
    rank: "basic",
    maxBatchSize: 2,
    quotas: { 2: { limit: 10, used: 0, remaining: 10 } },
  });
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

  // P2-2: Time tracking refs
  const genStartTimeRef = useRef<number>(0);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync selected conversation messages to generatedImages
  const generatedImages: GeneratedImage[] = useMemo(() => {
    return messages
      .filter((msg: FrontendMessage) => msg.role === "assistant" && msg.meta?.imageUrl)
      .map((msg: FrontendMessage) => {
        // Safe to use ! here because we filtered for imageUrl above
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
          // QW2: Enhanced Prompt Transparency
          originalPrompt: meta.originalPrompt as string | undefined,
          enhancedPrompt: meta.enhancedPrompt as string | undefined,
          // QW4: Favorites
          isFavorite: !!meta.is_favorite,
          // MT2: Version Chain
          parentMessageId: meta.parentMessageId as string | undefined,
          editDepth: meta.editDepth as number | undefined,
          // MT3: Tags
          tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : undefined,
          // P2-1: AI comment
          aiComment: meta.aiComment as string | undefined,
        };
      })
      .reverse(); // Show newest first
  }, [messages]);

  // Auto-select first project if none selected (Optional)
  useEffect(() => {
    if (!selectedConversationId && studioProjects.length > 0) {
      // Uncomment to auto-select
      // setSelectedConversationId(studioProjects[0].id);
    }
  }, [selectedConversationId, studioProjects]);

  // Load messages when ID changes
  useEffect(() => {
    if (selectedConversationId) {
      void loadConversation(selectedConversationId);
    }
  }, [selectedConversationId, loadConversation]);

  // Phase 4: Fetch batch gen quota on mount and after generating
  const fetchBatchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/batch-gen-quota");
      if (res.ok) {
        const json = await res.json();
        // API uses success() wrapper: { success: true, data: { rank, maxBatchSize, quotas } }
        const payload = json.data ?? json;
        if (payload.maxBatchSize) {
          setBatchQuota(payload);
        }
      }
    } catch (e) {
      logger.warn("Failed to fetch batch quota:", e);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      void fetchBatchQuota();
    }
  }, [isAuthed, fetchBatchQuota]);

  // QW5: Prompt History (localStorage, max 30)
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

  const handleCreateProject = async () => {
    const newProj = await createConversation({
      title: t("studioNewProject"),
      model: "vikini-image-studio", // Key differentiator
    });
    if (newProj) {
      setSelectedConversationId(newProj.id);
      setMobileOpen(false);
    }
  };

  // Check if API key is required for the selected model
  const getRequiredApiKey = () => {
    if (model.includes("gpt-image")) {
      return { key: localStorage.getItem("vikini-openai-key") || "", provider: "OpenAI" };
    } else if (model.includes("flux") || model.includes("replicate")) {
      return { key: localStorage.getItem("vikini-replicate-key") || "", provider: "Replicate" };
    }
    // Gemini uses server key by default, but BYOK is optional
    return { key: localStorage.getItem("vikini-gemini-key") || "", provider: "Gemini" };
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // BYOK Validation: Check if non-default model needs API key
    const { key, provider: _provider } = getRequiredApiKey();
    // Only require for OpenAI and Replicate (third-party)
    if (
      (model.includes("gpt-image") || model.includes("flux") || model.includes("replicate")) &&
      !key
    ) {
      setShowApiKeyWarning(true);
      return;
    }

    let targetId = selectedConversationId;

    // Auto-create project if none selected
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
    // Auto-switch to results tab on mobile when generating starts
    setMobileTab("results");

    // P2-2: Time estimate for generation
    genStartTimeRef.current = Date.now();
    const perImageSec = model.includes("pro") ? 20 : model.includes("gemini") ? 12 : 15;
    const estimatedTotal = perImageSec * numberOfImages;
    setGeneratingLabel(`${t("studioGenerating")} (~${estimatedTotal}s)`);

    genTimerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - genStartTimeRef.current) / 1000);
      setGeneratingLabel(`${t("studioGenerating")} (${elapsed}s)`);
    }, 1000);

    // QW1: Append negative prompt if present
    let finalPrompt = prompt;
    if (negativePrompt.trim()) {
      finalPrompt = `${prompt}\nDo NOT include: ${negativePrompt.trim()}`;
    }

    // Phase 2: Convert reference images to base64 if present (QW-D: multi)
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

    // Phase 4: Batch generation
    const totalImages = numberOfImages;
    let successCount = 0;

    try {
      // QW6: Parallel batch generation with Promise.allSettled
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
        // Single image — keep simple sequential flow
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

      // QW5: Save prompt to history on success
      if (successCount > 0) {
        addToPromptHistory(prompt);
      }
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
      // Refresh batch quota after generation
      if (totalImages > 1) {
        void fetchBatchQuota();
      }
    }
  };

  const handleRemix = (image: GeneratedImage) => {
    setPrompt(image.prompt);
    if (image.aspectRatio) setAspectRatio(image.aspectRatio);
    if (image.style) setStyle(image.style);
    if (image.model) setModel(image.model);
    if (image.enhancer !== undefined) setIsEnhancerOn(image.enhancer);
    // Switch to studio tab on mobile to edit the prompt
    setMobileTab("studio");
  };

  // Template selection handler
  const handleSelectTemplate = (template: ImageTemplate) => {
    if (template.requiresPhoto) {
      // Open modal to ask for photo
      setTemplateModalTarget(template);
    } else {
      // Fill prompt + style directly
      setPrompt(template.prompt);
      if (template.style && template.style !== "none") {
        setStyle(template.style);
      }
      setMobileTab("studio");
    }
  };

  // Template photo chosen (from TemplateModal)
  const handleTemplatePhoto = (template: ImageTemplate, file: File) => {
    setPrompt(template.prompt);
    if (template.style && template.style !== "none") {
      setStyle(template.style);
    }
    setReferenceImages([file]);
    setTemplateModalTarget(null);
    setMobileTab("studio");
  };

  // Phase 1: Edit handlers — now opens EditPanel (multi-turn)
  const handleEdit = (image: GeneratedImage) => {
    setEditingImage(image);
  };

  const handleEditComplete = () => {
    if (selectedConversationId) {
      void loadConversation(selectedConversationId);
    }
  };

  const handleCloseEditPanel = () => {
    setEditingImage(null);
  };

  // Phase 3: Lightbox handlers
  const handleImageClick = (_image: GeneratedImage, index: number) => {
    setLightboxIndex(index);
  };

  const handleDeleteRequest = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    try {
      const res = await fetch(`/api/messages/${showDeleteConfirm}`, { method: "DELETE" });
      if (res.ok && selectedConversationId) {
        void loadConversation(selectedConversationId);
      }
    } catch (e) {
      logger.error("Delete error:", e);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  // QW3: Variation handler — send image back as reference with variation prompt
  const handleVariation = async (image: GeneratedImage) => {
    if (generating) return;

    const targetId = selectedConversationId;
    if (!targetId) return;

    setGenerating(true);
    setMobileTab("results");
    setGeneratingLabel(t("studioCreatingVariation"));

    try {
      // Fetch the image and convert to base64
      const response = await fetch(image.url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const variationPrompt = `Create a variation of this image. Keep the same overall composition, style, and mood, but introduce subtle creative differences in details, colors, or perspective. Original description: ${image.prompt}`;

      const key = localStorage.getItem("vikini-gemini-key") || "";
      // Force Gemini model for reference image support
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
  };

  // QW4: Favorite toggle
  const handleToggleFavorite = async (image: GeneratedImage) => {
    if (!image.id) return;
    try {
      const res = await fetch(`/api/messages/${image.id}/favorite`, { method: "PATCH" });
      if (res.ok && selectedConversationId) {
        // Refresh to get updated meta
        await loadConversation(selectedConversationId);
      }
    } catch (e) {
      logger.error("Favorite toggle error:", e);
    }
  };

  const handleRename = (id: string) => {
    const current = studioProjects.find((p: FrontendConversation) => p.id === id);
    setRenameValue(current?.title || "");
    setShowRenameModal(id);
  };

  const confirmRename = async () => {
    if (!showRenameModal || !renameValue.trim()) return;
    void renameConversation(showRenameModal, renameValue.trim());
    setShowRenameModal(null);
    setRenameValue("");
  };

  // If not authed, show simple loader or redirect (handled by ChatApp usually, but here distinct)
  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-surface text-primary">
        {t("loading")}
      </div>
    );
  }
  if (!isAuthed) {
    void signIn();
    return null;
  }

  return (
    <div className="h-screen w-screen text-(--text-primary) overflow-hidden relative font-sans bg-(--surface-base) flex">
      {/* API Key Warning Modal */}
      <AlertDialog open={showApiKeyWarning} onOpenChange={setShowApiKeyWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studioApiKeyRequired")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studioMissingApiKey")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowApiKeyWarning(false)}>
              {t("done")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Modal */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("galleryDeleteImage")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studioDeleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover)"
            >
              {t("modalDeleteButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <AlertDialog open={!!showError} onOpenChange={() => setShowError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("error")}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>{showError?.message}</p>
                {showError?.suggestion && (
                  <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">
                    💡 {showError.suggestion}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("done")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowError(null);
                void handleGenerate();
              }}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {t("studioRetry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Sidebar */}
      <Sidebar
        conversations={studioProjects}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(id) => {
          setSelectedConversationId(id);
          setMobileOpen(false);
        }}
        onNewChat={handleCreateProject}
        newChatLabel={t("studioNewProject")}
        onDeleteConversation={async (id) => {
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
        }}
        onRenameChat={handleRename}
        onLogout={() => {}} // Handle in ChatApp mainly
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        session={session}
      />

      <FloatingMenuTrigger onClick={() => setMobileOpen(true)} />

      <div
        className={`flex-1 flex flex-col h-full transition-colors duration-300 relative z-10 pt-14 md:pt-0 ${
          sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"
        }`}
      >
        <HeaderBar onToggleSidebar={() => setMobileOpen(true)} />

        {/* Main content area - side by side on desktop, tabbed on mobile */}
        <div className="flex flex-col md:flex-row h-full w-full relative overflow-hidden bg-(--surface-base)">
          {/* Mobile Tab Bar */}
          <div className="md:hidden flex border-b border-(--border) bg-(--surface-base) shrink-0 z-10">
            <button
              onClick={() => setMobileTab("studio")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
                mobileTab === "studio"
                  ? "text-(--text-primary)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              {t("studioTabStudio")}
              {mobileTab === "studio" && (
                <motion.div
                  layoutId="mobileTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setMobileTab("results")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
                mobileTab === "results"
                  ? "text-(--text-primary)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Images className="w-4 h-4" />
              {t("studioTabResults")}
              {generatedImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/20 text-purple-400">
                  {generatedImages.length}
                </span>
              )}
              {mobileTab === "results" && (
                <motion.div
                  layoutId="mobileTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                />
              )}
            </button>
          </div>

          {/* Content panels with AnimatePresence for mobile */}
          <AnimatePresence mode="wait" initial={false}>
            {/* ControlPanel - always visible on md+, conditionally on mobile */}
            <ControlPanel
              key="control-panel"
              prompt={prompt}
              setPrompt={setPrompt}
              model={model}
              setModel={setModel}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              style={style}
              setStyle={setStyle}
              isEnhancerOn={isEnhancerOn}
              setIsEnhancerOn={setIsEnhancerOn}
              onGenerate={handleGenerate}
              generating={generating}
              className={mobileTab !== "studio" ? "hidden md:flex" : "flex"}
              referenceImages={referenceImages}
              setReferenceImages={setReferenceImages}
              numberOfImages={numberOfImages}
              setNumberOfImages={setNumberOfImages}
              batchQuota={batchQuota}
              generatingLabel={generatingLabel || undefined}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
              promptHistory={promptHistory}
              onClearHistory={clearPromptHistory}
            />

            {/* Canvas - always visible on md+, conditionally on mobile */}
            <Canvas
              key="canvas"
              images={generatedImages}
              generating={generating}
              selectedAspectRatio={aspectRatio}
              onRemix={handleRemix}
              onDelete={handleDeleteRequest}
              onEdit={handleEdit}
              onImageClick={handleImageClick}
              onSelectTemplate={handleSelectTemplate}
              onVariation={handleVariation}
              onToggleFavorite={handleToggleFavorite}
              onTagsUpdated={handleEditComplete}
              className={cn(
                mobileTab !== "results" ? "hidden md:flex" : "flex",
                editingImage ? "hidden lg:flex" : ""
              )}
            />

            {/* Multi-Turn Edit Panel — slides in from right */}
            <AnimatePresence>
              {editingImage && selectedConversationId && (
                <EditPanel
                  key="edit-panel"
                  sourceImage={editingImage}
                  conversationId={selectedConversationId}
                  onClose={handleCloseEditPanel}
                  onEditComplete={handleEditComplete}
                />
              )}
            </AnimatePresence>
          </AnimatePresence>
        </div>

        {/* Template Modal (for transform templates) */}
        <TemplateModal
          template={templateModalTarget}
          open={!!templateModalTarget}
          onOpenChange={(open) => !open && setTemplateModalTarget(null)}
          onChoosePhoto={handleTemplatePhoto}
        />

        {/* Phase 3: Image Lightbox */}
        {lightboxIndex !== null && (
          <ImageLightbox
            images={generatedImages}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onRemix={(img) => {
              setLightboxIndex(null);
              handleRemix(img);
            }}
            onEdit={(img) => {
              setLightboxIndex(null);
              handleEdit(img);
            }}
            onDelete={(id) => {
              handleDeleteRequest(id);
              // Move to adjacent image or close
              if (generatedImages.length <= 1) {
                setLightboxIndex(null);
              } else if (lightboxIndex >= generatedImages.length - 1) {
                setLightboxIndex(lightboxIndex - 1);
              }
            }}
          />
        )}
      </div>

      {/* Rename Modal */}
      <AlertDialog
        open={!!showRenameModal}
        onOpenChange={(open) => !open && setShowRenameModal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("renameChat") || "Rename Project"}</AlertDialogTitle>
            <AlertDialogDescription>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                autoFocus
                className="w-full mt-2 px-4 py-3 rounded-lg bg-(--control-bg) border border-(--control-border) text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none focus:ring-2 focus:ring-(--accent)/50"
                placeholder={t("renameChat") || "Enter new name"}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRename} disabled={!renameValue.trim()}>
              {t("save") || "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

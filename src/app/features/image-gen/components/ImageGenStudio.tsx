"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ControlPanel, { type BatchQuotaInfo } from "./ControlPanel";
import Canvas, { GeneratedImage } from "./Canvas";
import EditImageModal from "./EditImageModal";
import ImageLightbox from "./ImageLightbox";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";

import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage, type SupportedLanguage } from "../../chat/hooks/useLanguage";
import { translations } from "@/lib/utils/config";
import {
  useConversation,
  FrontendConversation,
  FrontendMessage,
} from "../../chat/hooks/useConversation";
import { useSession, signIn } from "next-auth/react";

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
import { formatDate } from "@/lib/utils/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Images } from "lucide-react";

export function ImageGenStudio() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const { theme: _theme, toggleTheme: _toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  // Create translation dict for HeaderBar (needs Record<string, string>)
  const tDict = useMemo(() => {
    return (translations?.[language] || translations?.en || {}) as Record<string, string>;
  }, [language]);

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
  const [model, setModel] = useState("imagen-4.0-generate-001");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("none");
  const [isEnhancerOn, setIsEnhancerOn] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<"studio" | "results">("studio");

  // Modal States
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Phase 1: Edit Image
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);

  // Phase 2: Reference Image
  const [referenceImage, setReferenceImage] = useState<File | null>(null);

  // Phase 3: Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Phase 4: Batch Generation
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [batchQuota, setBatchQuota] = useState<BatchQuotaInfo | null>(null);
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

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
      loadConversation(selectedConversationId);
    }
  }, [selectedConversationId, loadConversation]);

  // Phase 4: Fetch batch gen quota on mount and after generating
  const fetchBatchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/batch-gen-quota");
      if (res.ok) {
        const data = await res.json();
        setBatchQuota(data);
      }
    } catch (e) {
      logger.warn("Failed to fetch batch quota:", e);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      fetchBatchQuota();
    }
  }, [isAuthed, fetchBatchQuota]);

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
    if (model.includes("dall-e")) {
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
      (model.includes("dall-e") || model.includes("flux") || model.includes("replicate")) &&
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
        setShowError(t("studioCreateProjectFailed"));
        return;
      }
    }

    setGenerating(true);
    // Auto-switch to results tab on mobile when generating starts
    setMobileTab("results");

    // Phase 2: Convert reference image to base64 if present
    let referenceImageBase64: string | undefined;
    if (referenceImage) {
      try {
        const reader = new FileReader();
        referenceImageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(referenceImage);
        });
      } catch (e) {
        logger.warn("Failed to convert reference image:", e);
      }
    }

    // Phase 4: Batch generation - sequential to avoid rate limits
    const totalImages = numberOfImages;
    let successCount = 0;

    try {
      for (let i = 0; i < totalImages; i++) {
        if (totalImages > 1) {
          setGeneratingLabel(
            t("studioGeneratingProgress")
              .replace("{current}", String(i + 1))
              .replace("{total}", String(totalImages))
          );
        }

        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
          },
          body: JSON.stringify({
            prompt,
            conversationId: targetId,
            options: {
              model,
              aspectRatio,
              style: style === "none" ? undefined : style,
              enhancer: isEnhancerOn,
              referenceImage: referenceImageBase64,
            },
            batchSize: totalImages > 1 ? totalImages : undefined,
          }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error?.message || json.error || "Generation failed");
        }

        if (json.success) {
          successCount++;
          // Refresh messages to show new image immediately
          await loadConversation(targetId!);
          if (i === 0) {
            refreshConversations();
          }
        }
      }
    } catch (error) {
      logger.error("Gen Error:", error);
      if (successCount === 0) {
        setShowError(t("studioGenerateFailed"));
      }
    } finally {
      setGenerating(false);
      setGeneratingLabel(null);
      // Refresh batch quota after generation
      if (totalImages > 1) {
        fetchBatchQuota();
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

  const handleSuggestPrompt = (suggestedPrompt: string) => {
    setPrompt(suggestedPrompt);
    // Switch to studio tab so user can see the prompt filled in
    setMobileTab("studio");
  };

  // Phase 1: Edit handlers
  const handleEdit = (image: GeneratedImage) => {
    setEditingImage(image);
  };

  const handleEditComplete = async () => {
    setEditingImage(null);
    if (selectedConversationId) {
      await loadConversation(selectedConversationId);
    }
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
        loadConversation(selectedConversationId);
      }
    } catch (e) {
      logger.error("Delete error:", e);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleRename = (id: string) => {
    const current = studioProjects.find((p: FrontendConversation) => p.id === id);
    setRenameValue(current?.title || "");
    setShowRenameModal(id);
  };

  const confirmRename = async () => {
    if (!showRenameModal || !renameValue.trim()) return;
    renameConversation(showRenameModal, renameValue.trim());
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
    signIn();
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
            <AlertDialogDescription>{showError}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowError(null)}>{t("done")}</AlertDialogAction>
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
        onDeleteConversation={(id) => deleteConversation(id)}
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
        className={`flex-1 flex flex-col h-full transition-all duration-300 relative z-10 ${
          sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"
        }`}
      >
        <HeaderBar
          t={tDict}
          language={language}
          onLanguageChange={(lang) => setLanguage(lang as SupportedLanguage)}
          onToggleSidebar={() => setMobileOpen(true)}
        />

        {/* Main content area - side by side on desktop, tabbed on mobile */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full relative bg-(--surface-base) pt-14 md:pt-0">
          {/* Mobile Tab Bar - sticky so it stays visible during scroll */}
          <div className="md:hidden flex border-b border-(--border) bg-(--surface-base)/95 backdrop-blur-md shrink-0 sticky top-0 z-30">
            <button
              onClick={() => setMobileTab("studio")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative ${
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
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative ${
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
              style={style}
              setStyle={setStyle}
              isEnhancerOn={isEnhancerOn}
              setIsEnhancerOn={setIsEnhancerOn}
              onGenerate={handleGenerate}
              generating={generating}
              className={mobileTab !== "studio" ? "hidden md:flex" : "flex"}
              referenceImage={referenceImage}
              setReferenceImage={setReferenceImage}
              numberOfImages={numberOfImages}
              setNumberOfImages={setNumberOfImages}
              batchQuota={batchQuota}
              generatingLabel={generatingLabel || undefined}
            />

            {/* Canvas - always visible on md+, conditionally on mobile */}
            <Canvas
              key="canvas"
              images={generatedImages}
              generating={generating}
              onRemix={handleRemix}
              onDelete={handleDeleteRequest}
              onEdit={handleEdit}
              onImageClick={handleImageClick}
              onSuggestPrompt={handleSuggestPrompt}
              className={mobileTab !== "results" ? "hidden md:flex" : "flex"}
            />
          </AnimatePresence>
        </div>

        {/* Phase 1: Edit Image Modal */}
        <EditImageModal
          image={editingImage}
          open={!!editingImage}
          onOpenChange={(open) => !open && setEditingImage(null)}
          onEditComplete={handleEditComplete}
          conversationId={selectedConversationId}
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

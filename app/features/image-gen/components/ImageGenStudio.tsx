"use client";

import { useState, useMemo, useEffect } from "react";
import ControlPanel from "./ControlPanel";
import Canvas, { GeneratedImage } from "./Canvas";
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

export function ImageGenStudio() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const { theme: _theme, toggleTheme: _toggleTheme } = useTheme();
  const { t, language } = useLanguage();

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

  // Modal States
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

    try {
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
          },
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message || json.error || "Generation failed");
      }

      if (json.success) {
        // Refresh messages to show new image
        await loadConversation(targetId!);
        // Also refresh project list just in case of first message logic (preview)
        refreshConversations();
      }
    } catch (error) {
      logger.error("Gen Error:", error);
      setShowError(t("studioGenerateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleRemix = (image: GeneratedImage) => {
    setPrompt(image.prompt);
    if (image.aspectRatio) setAspectRatio(image.aspectRatio);
    if (image.style) setStyle(image.style);
    if (image.model) setModel(image.model);
    if (image.enhancer !== undefined) setIsEnhancerOn(image.enhancer);
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
          t={{}}
          language="en"
          onLanguageChange={() => {}}
          onToggleSidebar={() => setMobileOpen(true)}
        />

        {/* Decoration */}
        <div className="absolute inset-0 left-0 w-80 bg-(--surface-muted) border-r border-(--border) pointer-events-none -z-10 hidden lg:block"></div>

        <div className="flex h-full w-full relative overflow-hidden bg-(--surface-base)">
          <ControlPanel
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
          />

          <Canvas
            images={generatedImages}
            generating={generating}
            onRemix={handleRemix}
            onDelete={handleDeleteRequest}
          />
        </div>
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

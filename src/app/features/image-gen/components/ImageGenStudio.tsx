"use client";

import { useSession, signIn } from "next-auth/react";
import ControlPanel from "./ControlPanel";
import Canvas from "./Canvas";
import EditPanel from "./EditPanel";
import ImageLightbox from "./ImageLightbox";
import TemplateModal from "./TemplateModal";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";

import { useTheme } from "../../chat/hooks/useTheme";

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
import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Images } from "lucide-react";

import { useImageGenStudio } from "./hooks/useImageGenStudio";
import { useEffect, useState } from "react";

export function ImageGenStudio() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const { theme: _theme } = useTheme();

  const studio = useImageGenStudio();
  const { t } = studio;

  // Sidebar state (local to layout)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch batch quota on auth
  useEffect(() => {
    if (isAuthed) void studio.fetchBatchQuota();
  }, [isAuthed, studio.fetchBatchQuota]);

  // Auto-select first project
  useEffect(() => {
    if (!studio.selectedConversationId && studio.studioProjects.length > 0) {
      // Uncomment to auto-select
      // studio.setSelectedConversationId(studio.studioProjects[0].id);
    }
  }, [studio.selectedConversationId, studio.studioProjects]);

  // Auth gates
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
      <AlertDialog open={studio.showApiKeyWarning} onOpenChange={studio.setShowApiKeyWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studioApiKeyRequired")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studioMissingApiKey")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => studio.setShowApiKeyWarning(false)}>
              {t("done")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Modal */}
      <AlertDialog
        open={!!studio.showDeleteConfirm}
        onOpenChange={() => studio.setShowDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("galleryDeleteImage")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studioDeleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={studio.handleDeleteConfirm}
              className="bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover)"
            >
              {t("modalDeleteButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <AlertDialog open={!!studio.showError} onOpenChange={() => studio.setShowError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("error")}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>{studio.showError?.message}</p>
                {studio.showError?.suggestion && (
                  <p className="text-xs text-(--warning) bg-(--warning)/10 border border-(--warning)/20 rounded-lg px-3 py-2 mt-2">
                    {studio.showError.suggestion}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("done")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                studio.setShowError(null);
                void studio.handleGenerate();
              }}
              className="bg-(--primary) text-(--primary-foreground) hover:bg-(--primary-hover)"
            >
              {t("studioRetry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Sidebar */}
      <Sidebar
        conversations={studio.studioProjects}
        selectedConversationId={studio.selectedConversationId}
        onSelectConversation={(id) => {
          studio.setSelectedConversationId(id);
          setMobileOpen(false);
        }}
        onNewChat={async () => {
          await studio.handleCreateProject();
          setMobileOpen(false);
        }}
        newChatLabel={t("studioNewProject")}
        onDeleteConversation={studio.handleDeleteProject}
        onRenameChat={studio.handleRename}
        onLogout={() => {}}
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

        {/* Main content area */}
        <div className="flex flex-col md:flex-row h-full w-full relative overflow-hidden bg-(--surface-base)">
          {/* Mobile Tab Bar */}
          <div className="md:hidden flex border-b border-(--border) bg-(--surface-base) shrink-0 z-10">
            <button
              onClick={() => studio.setMobileTab("studio")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
                studio.mobileTab === "studio"
                  ? "text-(--text-primary)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              {t("studioTabStudio")}
              {studio.mobileTab === "studio" && (
                <motion.div
                  layoutId="mobileTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-(--primary) rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => studio.setMobileTab("results")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
                studio.mobileTab === "results"
                  ? "text-(--text-primary)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Images className="w-4 h-4" />
              {t("studioTabResults")}
              {studio.generatedImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-(--primary)/20 text-(--primary)">
                  {studio.generatedImages.length}
                </span>
              )}
              {studio.mobileTab === "results" && (
                <motion.div
                  layoutId="mobileTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-(--primary) rounded-full"
                />
              )}
            </button>
          </div>

          {/* Content panels */}
          <AnimatePresence mode="wait" initial={false}>
            <ControlPanel
              key="control-panel"
              prompt={studio.prompt}
              setPrompt={studio.setPrompt}
              model={studio.model}
              setModel={studio.setModel}
              aspectRatio={studio.aspectRatio}
              setAspectRatio={studio.setAspectRatio}
              resolution={studio.resolution}
              setResolution={studio.setResolution}
              style={studio.style}
              setStyle={studio.setStyle}
              isEnhancerOn={studio.isEnhancerOn}
              setIsEnhancerOn={studio.setIsEnhancerOn}
              onGenerate={studio.handleGenerate}
              generating={studio.generating}
              className={studio.mobileTab !== "studio" ? "hidden md:flex" : "flex"}
              referenceImages={studio.referenceImages}
              setReferenceImages={studio.setReferenceImages}
              numberOfImages={studio.numberOfImages}
              setNumberOfImages={studio.setNumberOfImages}
              batchQuota={studio.batchQuota}
              generatingLabel={studio.generatingLabel || undefined}
              negativePrompt={studio.negativePrompt}
              setNegativePrompt={studio.setNegativePrompt}
              promptHistory={studio.promptHistory}
              onClearHistory={studio.clearPromptHistory}
            />

            <Canvas
              key="canvas"
              images={studio.generatedImages}
              generating={studio.generating}
              selectedAspectRatio={studio.aspectRatio}
              onRemix={studio.handleRemix}
              onDelete={studio.handleDeleteRequest}
              onEdit={studio.handleEdit}
              onImageClick={studio.handleImageClick}
              onSelectTemplate={studio.handleSelectTemplate}
              onVariation={studio.handleVariation}
              onToggleFavorite={studio.handleToggleFavorite}
              onTagsUpdated={studio.handleEditComplete}
              className={cn(
                studio.mobileTab !== "results" ? "hidden md:flex" : "flex",
                studio.editingImage ? "hidden lg:flex" : ""
              )}
            />

            {/* Multi-Turn Edit Panel */}
            <AnimatePresence>
              {studio.editingImage && studio.selectedConversationId && (
                <EditPanel
                  key="edit-panel"
                  sourceImage={studio.editingImage}
                  conversationId={studio.selectedConversationId}
                  onClose={studio.handleCloseEditPanel}
                  onEditComplete={studio.handleEditComplete}
                />
              )}
            </AnimatePresence>
          </AnimatePresence>
        </div>

        {/* Template Modal */}
        <TemplateModal
          template={studio.templateModalTarget}
          open={!!studio.templateModalTarget}
          onOpenChange={(open) => !open && studio.setTemplateModalTarget(null)}
          onChoosePhoto={studio.handleTemplatePhoto}
        />

        {/* Lightbox */}
        {studio.lightboxIndex !== null && (
          <ImageLightbox
            images={studio.generatedImages}
            currentIndex={studio.lightboxIndex}
            onClose={() => studio.setLightboxIndex(null)}
            onNavigate={studio.setLightboxIndex}
            onRemix={(img) => {
              studio.setLightboxIndex(null);
              studio.handleRemix(img);
            }}
            onEdit={(img) => {
              studio.setLightboxIndex(null);
              studio.handleEdit(img);
            }}
            onDelete={(id) => {
              studio.handleDeleteRequest(id);
              if (studio.generatedImages.length <= 1) {
                studio.setLightboxIndex(null);
              } else if (studio.lightboxIndex! >= studio.generatedImages.length - 1) {
                studio.setLightboxIndex(studio.lightboxIndex! - 1);
              }
            }}
          />
        )}
      </div>

      {/* Rename Modal */}
      <AlertDialog
        open={!!studio.showRenameModal}
        onOpenChange={(open) => !open && studio.setShowRenameModal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("renameChat") || "Rename Project"}</AlertDialogTitle>
            <AlertDialogDescription>
              <input
                type="text"
                value={studio.renameValue}
                onChange={(e) => studio.setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && studio.confirmRename()}
                autoFocus
                className="w-full mt-2 px-4 py-3 rounded-lg bg-(--control-bg) border border-(--control-border) text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none focus:ring-2 focus:ring-(--accent)/50"
                placeholder={t("renameChat") || "Enter new name"}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={studio.confirmRename} disabled={!studio.renameValue.trim()}>
              {t("save") || "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

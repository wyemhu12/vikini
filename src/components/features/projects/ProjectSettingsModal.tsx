"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Trash2, Loader2, MessageSquare, Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KnowledgePanel } from "@/components/features/projects";
import { ProjectIcon } from "@/components/features/projects/ProjectIcon";
import { useProjectStore } from "@/lib/store/projectStore";
import { useConversation } from "@/app/features/chat/hooks/useConversation";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import type { KnowledgeDocument, ProjectWithStats } from "@/types/projects";

interface ProjectSettingsModalProps {
  /** Project ID */
  projectId: string;
  /** Whether modal is open */
  isOpen: boolean;
  /** Close modal */
  onClose: () => void;
  /** Create new chat in project */
  onNewChat?: (projectId: string) => void;
  /** Navigate to chat */
  onSelectChat?: (chatId: string) => void;
}

/**
 * Project settings modal - shows knowledge base, project info, and conversations
 */
export function ProjectSettingsModal({
  projectId,
  isOpen,
  onClose,
  onNewChat,
  onSelectChat,
}: ProjectSettingsModalProps) {
  const { t, language } = useLanguage();

  const projects = useProjectStore((s) => s.projects);
  const limits = useProjectStore((s) => s.limits);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const { getProjectConversations, deleteConversation, refreshConversations } = useConversation();
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get conversations for this project
  const projectConversations = getProjectConversations(projectId);

  // Find project from store
  useEffect(() => {
    if (!isOpen) return;
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setProject(found);
    } else {
      void fetchProjects();
    }
  }, [projectId, projects, fetchProjects, isOpen]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch documents");
      }

      setDocuments(Array.isArray(data?.data?.documents) ? data.data.documents : []);
    } catch (err: unknown) {
      logger.error("[ProjectSettingsModal] Failed to fetch documents:", err);
      const msg = err instanceof Error ? err.message : t("projectSettingsSaveFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (isOpen && projectId) {
      void fetchDocuments();
    }
  }, [isOpen, projectId, fetchDocuments]);

  // Upload document
  const handleUpload = async (file: File, payload: FormData | string) => {
    let res: Response;
    if (payload instanceof FormData) {
      res = await fetch(`/api/projects/${projectId}/knowledge`, {
        method: "POST",
        body: payload,
      });
    } else {
      res = await fetch(`/api/projects/${projectId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content: payload,
          mimeType: file.type || "text/plain",
        }),
      });
    }

    if (res.status === 413) {
      throw new Error(
        t("serverPayloadTooLarge") || "File quá lớn, vượt quá giới hạn tải lên của máy chủ"
      );
    }

    let data: { success?: boolean; error?: { message?: string }; data?: { truncated?: boolean } };
    try {
      data = await res.json();
    } catch {
      throw new Error(res.ok ? "Upload failed" : `Upload failed (${res.status})`);
    }

    if (!data.success) {
      throw new Error(data.error?.message || "Upload failed");
    }

    // Refresh both document list and project stats (document_count, storage_bytes)
    await Promise.all([fetchDocuments(), fetchProjects()]);

    return { truncated: Boolean(data.data?.truncated) };
  };

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    const res = await fetch(`/api/projects/${projectId}/knowledge?documentId=${documentId}`, {
      method: "DELETE",
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Delete failed");
    }

    // Refresh both document list and project stats (document_count, storage_bytes)
    await Promise.all([fetchDocuments(), fetchProjects()]);
  };

  // Delete project - imperative confirm
  const handleDeleteProject = async () => {
    const ok = await confirm({
      title: t("projectDeleteProjectTitle"),
      description: t("projectDeleteProjectDesc"),
      variant: "danger",
      confirmLabel: t("modalDeleteButton"),
      cancelLabel: t("cancel"),
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      onClose();
    } catch (err: unknown) {
      logger.error("[ProjectSettingsModal] Delete project failed:", err);
      const msg = err instanceof Error ? err.message : t("projectDeleteFailed");
      setError(msg);
      toast.error(t("projectDeleteFailed"));
      setIsDeleting(false);
    }
  };

  // Delete chat - imperative confirm
  const handleDeleteChat = async (chatId: string) => {
    const ok = await confirm({
      title: t("projectDeleteChatTitle"),
      description: t("modalDeleteConfirm"),
      variant: "danger",
      confirmLabel: t("modalDeleteButton"),
      cancelLabel: t("cancel"),
    });
    if (!ok) return;
    try {
      await deleteConversation(chatId);
      await refreshConversations();
    } catch (err: unknown) {
      logger.error("[ProjectSettingsModal] Delete chat failed:", err);
      toast.error(t("deleteChatFailed2"));
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        {...(!project?.description ? { "aria-describedby": undefined } : {})}
        className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] max-w-5xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--line) shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {project && <ProjectIcon icon={project.icon} color={project.color} size="lg" />}
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold truncate">
                {project?.name || t("loading")}
              </DialogTitle>
              {project?.description && (
                <DialogDescription className="text-sm text-(--muted) line-clamp-1 mt-0.5">
                  {project.description}
                </DialogDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              aria-label={t("deleteProject")}
              className={cn(
                "p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                "hover:bg-(--danger)/10 text-(--danger)"
              )}
              title={t("deleteProject")}
            >
              {isDeleting ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="p-2 hover:bg-(--raised) rounded-lg transition-colors text-(--muted) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/20 text-(--danger)"
            >
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Knowledge Base Panel */}
            <div className="min-w-0 bg-(--raised) rounded-xl border border-(--line) overflow-hidden">
              <KnowledgePanel
                projectId={projectId}
                documents={documents}
                storageUsedBytes={project?.storage_bytes || 0}
                storageMaxBytes={limits?.maxStorageBytesPerProject ?? 5 * 1024 * 1024}
                isLoading={isLoading}
                onUpload={handleUpload}
                onDelete={handleDeleteDocument}
                onRefresh={fetchDocuments}
              />
            </div>

            {/* Right column */}
            <div className="min-w-0 space-y-6">
              {/* Project Info */}
              <div className="bg-(--raised) rounded-xl border border-(--line) p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText aria-hidden="true" className="h-4 w-4" />
                  {t("projectInfoTitle")}
                </h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-(--muted)">{t("projectDocuments")}</dt>
                    <dd className="font-medium">{project?.document_count || 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-(--muted)">{t("projectConversationsShort")}</dt>
                    <dd className="font-medium">{project?.conversation_count || 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-(--muted)">{t("projectEmbeddingModel")}</dt>
                    <dd className="font-mono text-xs">{project?.embedding_model || "-"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-(--muted)">{t("projectCreated")}</dt>
                    <dd className="font-medium">
                      {project?.created_at
                        ? new Date(project.created_at).toLocaleDateString(
                            language === "vi" ? "vi-VN" : "en-US"
                          )
                        : "-"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Conversations */}
              <div className="bg-(--raised) rounded-xl border border-(--line) p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare aria-hidden="true" className="h-4 w-4" />
                    {t("projectConversationsShort")} ({projectConversations.length})
                  </h3>
                  {onNewChat && (
                    <button
                      type="button"
                      onClick={() => {
                        onNewChat(projectId);
                        onClose();
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                        "bg-(--accent) text-(--on-accent) hover:brightness-110",
                        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      )}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      {t("newChat")}
                    </button>
                  )}
                </div>

                {projectConversations.length === 0 ? (
                  <p className="text-sm text-(--muted) text-center py-4">
                    {t("projectNoChatsYet")}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {projectConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "group flex items-center justify-between rounded-lg border border-(--line)/50",
                          "bg-(--surface) hover:bg-(--raised-hover)",
                          "transition-colors"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectChat?.(conv.id);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 p-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                        >
                          <MessageSquare
                            aria-hidden="true"
                            className="h-4 w-4 text-(--muted) shrink-0"
                          />
                          <span className="text-sm truncate">{conv.title || t("newChat")}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={t("delete")}
                          onClick={() => {
                            void handleDeleteChat(conv.id);
                          }}
                          className="shrink-0 mr-1.5 inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-lg text-(--muted) hover:text-(--danger) hover:bg-(--danger)/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) transition-[opacity,color,background-color]"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectSettingsModal;

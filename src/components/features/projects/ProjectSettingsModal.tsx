"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Trash2, Loader2, MessageSquare, Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { KnowledgePanel } from "@/components/features/projects";
import { ProjectIcon } from "@/components/features/projects/ProjectIcon";
import { useProjectStore } from "@/lib/store/projectStore";
import { useConversation } from "@/app/features/chat/hooks/useConversation";
import { useLanguageStore } from "@/lib/store/languageStore";
import { translations } from "@/lib/utils/config";
import DeleteConfirmModal from "@/app/components/DeleteConfirmModal";
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
  const language = useLanguageStore((state) => state.language);
  const t = translations[language];

  const { projects, deleteProject, fetchProjects } = useProjectStore();
  const { getProjectConversations, deleteConversation, refreshConversations } = useConversation();
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation modals
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Get conversations for this project
  const projectConversations = getProjectConversations(projectId);

  // Find project from store
  useEffect(() => {
    if (!isOpen) return;
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setProject(found);
    } else {
      fetchProjects();
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

      setDocuments(data.data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchDocuments();
    }
  }, [isOpen, projectId, fetchDocuments]);

  // Upload document
  const handleUpload = async (file: File, content: string) => {
    const res = await fetch(`/api/projects/${projectId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content,
        mime_type: file.type || "text/plain",
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Upload failed");
    }

    await fetchDocuments();
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

    await fetchDocuments();
  };

  // Delete project - opens modal
  const handleDeleteProject = () => {
    setShowDeleteProjectModal(true);
  };

  // Confirm delete project
  const confirmDeleteProject = async () => {
    setShowDeleteProjectModal(false);
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setIsDeleting(false);
    }
  };

  // Delete chat - opens modal
  const handleDeleteChat = (chatId: string) => {
    setChatToDelete(chatId);
    setShowDeleteChatModal(true);
  };

  // Confirm delete chat
  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    setShowDeleteChatModal(false);
    await deleteConversation(chatToDelete);
    await refreshConversations();
    setChatToDelete(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-16 z-50 flex items-center justify-center">
        <div
          className={cn(
            "w-full h-full max-w-5xl max-h-[90vh]",
            "bg-(--surface) rounded-xl border border-(--border)",
            "shadow-2xl flex flex-col overflow-hidden"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
            <div className="flex items-center gap-3">
              {project && <ProjectIcon icon={project.icon} color={project.color} size="lg" />}
              <div>
                <h2 className="text-lg font-bold">{project?.name || "Loading..."}</h2>
                {project?.description && (
                  <p className="text-sm text-(--text-secondary) line-clamp-1">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "hover:bg-red-500/10 text-red-500"
                )}
                title={language === "vi" ? "Xóa dự án" : "Delete project"}
              >
                {isDeleting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-(--control-bg-hover) rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Knowledge Base Panel */}
              <div className="bg-(--surface-muted) rounded-xl border border-(--border) overflow-hidden">
                <KnowledgePanel
                  projectId={projectId}
                  documents={documents}
                  storageUsedBytes={project?.storage_bytes || 0}
                  storageMaxBytes={5 * 1024 * 1024}
                  isLoading={isLoading}
                  onUpload={handleUpload}
                  onDelete={handleDeleteDocument}
                  onRefresh={fetchDocuments}
                />
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Project Info */}
                <div className="bg-(--surface-muted) rounded-xl border border-(--border) p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {language === "vi" ? "Thông tin" : "Info"}
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-(--text-secondary)">
                        {language === "vi" ? "Tài liệu" : "Documents"}
                      </dt>
                      <dd className="font-medium">{project?.document_count || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-(--text-secondary)">
                        {language === "vi" ? "Hội thoại" : "Conversations"}
                      </dt>
                      <dd className="font-medium">{project?.conversation_count || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-(--text-secondary)">Model</dt>
                      <dd className="font-mono text-xs">{project?.embedding_model || "-"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-(--text-secondary)">
                        {language === "vi" ? "Ngày tạo" : "Created"}
                      </dt>
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
                <div className="bg-(--surface-muted) rounded-xl border border-(--border) p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {language === "vi" ? "Hội thoại" : "Conversations"} (
                      {projectConversations.length})
                    </h3>
                    {onNewChat && (
                      <button
                        onClick={() => {
                          onNewChat(projectId);
                          onClose();
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                          "transition-colors"
                        )}
                      >
                        <Plus className="h-4 w-4" />
                        {t.newChat}
                      </button>
                    )}
                  </div>

                  {projectConversations.length === 0 ? (
                    <p className="text-sm text-(--text-secondary) text-center py-4">
                      {t.projectNoChatsYet}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {projectConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg",
                            "bg-(--control-bg) hover:bg-(--control-bg-hover)",
                            "cursor-pointer transition-colors group"
                          )}
                          onClick={() => {
                            onSelectChat?.(conv.id);
                            onClose();
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <MessageSquare className="h-4 w-4 text-(--text-secondary) shrink-0" />
                            <span className="text-sm truncate">{conv.title || t.newChat}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(conv.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Project Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteProjectModal}
        onConfirm={confirmDeleteProject}
        onCancel={() => setShowDeleteProjectModal(false)}
        title={language === "vi" ? "Xóa dự án" : "Delete Project"}
        message={
          language === "vi"
            ? "Xóa dự án này? Tất cả tài liệu và hội thoại sẽ bị mất."
            : "Delete this project? All documents and conversations will be lost."
        }
        t={t}
      />

      {/* Delete Chat Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteChatModal}
        onConfirm={confirmDeleteChat}
        onCancel={() => {
          setShowDeleteChatModal(false);
          setChatToDelete(null);
        }}
        title={language === "vi" ? "Xóa hội thoại" : "Delete Conversation"}
        t={t}
      />
    </>
  );
}

export default ProjectSettingsModal;

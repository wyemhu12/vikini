"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Settings, Trash2, Loader2, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { KnowledgePanel } from "@/components/features/projects";
import { useProjectStore } from "@/lib/store/projectStore";
import { useConversation } from "@/app/features/chat/hooks/useConversation";
import type { KnowledgeDocument, ProjectWithStats } from "@/types/projects";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { projects, deleteProject, fetchProjects } = useProjectStore();
  const { getProjectConversations, createConversation, deleteConversation } = useConversation();
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get conversations for this project
  const projectConversations = getProjectConversations(projectId);

  // Find project from store or fetch
  useEffect(() => {
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setProject(found);
    } else {
      // Fetch if not in store
      fetchProjects();
    }
  }, [projectId, projects, fetchProjects]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
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
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId, fetchDocuments]);

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

    // Refresh list
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

    // Refresh list
    await fetchDocuments();
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!confirm("Delete this project? All documents and conversations will be lost.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setIsDeleting(false);
    }
  };

  if (!project && !isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Project not found</h1>
          <button onClick={() => router.push("/")} className="text-primary hover:underline">
            Go back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--surface-muted)">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-(--surface)/90 backdrop-blur-xl border-b border-(--border)">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-(--control-bg-hover) rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 flex-1">
            <span
              className="w-10 h-10 flex items-center justify-center rounded-lg text-xl"
              style={{ backgroundColor: project?.color || "#6366f1" }}
            >
              {project?.icon || "📁"}
            </span>
            <div>
              <h1 className="text-lg font-bold">{project?.name || "Loading..."}</h1>
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
              className={cn("p-2 rounded-lg transition-colors", "hover:bg-red-500/10 text-red-500")}
              title="Delete project"
            >
              {isDeleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {/* Knowledge Base Panel */}
          <div className="bg-(--surface) rounded-xl border border-(--border) overflow-hidden">
            <KnowledgePanel
              projectId={projectId}
              documents={documents}
              storageUsedBytes={project?.storage_bytes || 0}
              storageMaxBytes={5 * 1024 * 1024} // TODO: get from limits
              isLoading={isLoading}
              onUpload={handleUpload}
              onDelete={handleDeleteDocument}
              onRefresh={fetchDocuments}
            />
          </div>

          {/* Project Info */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-(--surface) rounded-xl border border-(--border) p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Project Info
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-(--text-secondary)">Documents</dt>
                  <dd className="font-medium">{project?.document_count || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-secondary)">Conversations</dt>
                  <dd className="font-medium">{project?.conversation_count || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-secondary)">Embedding Model</dt>
                  <dd className="font-mono text-xs">{project?.embedding_model || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-(--text-secondary)">Created</dt>
                  <dd className="font-medium">
                    {project?.created_at ? new Date(project.created_at).toLocaleDateString() : "-"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Usage Tips */}
            <div className="bg-(--surface) rounded-xl border border-(--border) p-6">
              <h2 className="font-semibold mb-3">How to use</h2>
              <ul className="text-sm text-(--text-secondary) space-y-2">
                <li>• Upload documents to build your knowledge base</li>
                <li>• Start a new chat in this project</li>
                <li>• AI will search your documents for relevant context</li>
              </ul>
            </div>

            {/* Conversations in this project */}
            <div className="bg-(--surface) rounded-xl border border-(--border) p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversations ({projectConversations.length})
                </h2>
                <button
                  onClick={async () => {
                    setIsCreatingChat(true);
                    try {
                      const conv = await createConversation({
                        title: "",
                        projectId: projectId,
                      });
                      if (conv) {
                        router.push(`/?id=${conv.id}`);
                      }
                    } finally {
                      setIsCreatingChat(false);
                    }
                  }}
                  disabled={isCreatingChat}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "transition-colors"
                  )}
                >
                  {isCreatingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  New Chat
                </button>
              </div>

              {projectConversations.length === 0 ? (
                <p className="text-sm text-(--text-secondary) text-center py-4">
                  No conversations yet. Start a new chat!
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projectConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        "bg-(--control-bg) hover:bg-(--control-bg-hover)",
                        "cursor-pointer transition-colors group"
                      )}
                      onClick={() => router.push(`/?id=${conv.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <MessageSquare className="h-4 w-4 text-(--text-secondary) shrink-0" />
                        <span className="text-sm truncate">{conv.title || "New conversation"}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this conversation?")) {
                            deleteConversation(conv.id);
                          }
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
      </main>
    </div>
  );
}

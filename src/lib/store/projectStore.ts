/**
 * Project Store - Zustand state management for projects
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ProjectWithStats, UserTier, EmbeddingModel } from "@/types/projects";

interface ProjectLimits {
  maxProjects: number;
  currentProjects: number;
  maxStorageBytesPerProject: number;
  availableModels: readonly EmbeddingModel[];
}

interface ProjectStore {
  // State
  projects: ProjectWithStats[];
  currentProjectId: string | null;
  tier: UserTier;
  limits: ProjectLimits | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: ProjectWithStats[]) => void;
  setCurrentProject: (projectId: string | null) => void;
  setTierAndLimits: (tier: UserTier, limits: ProjectLimits) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getCurrentProject: () => ProjectWithStats | null;

  // API actions
  fetchProjects: () => Promise<void>;
  createProject: (input: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    embedding_model?: EmbeddingModel;
  }) => Promise<ProjectWithStats>;
  updateProject: (
    projectId: string,
    input: {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      embedding_model?: EmbeddingModel;
    }
  ) => Promise<ProjectWithStats>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProjectId: null,
      tier: "basic",
      limits: null,
      isLoading: false,
      error: null,

      // Basic setters
      setProjects: (projects) => set({ projects }),
      setCurrentProject: (projectId) => set({ currentProjectId: projectId }),
      setTierAndLimits: (tier, limits) => set({ tier, limits }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Computed
      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        if (!currentProjectId) return null;
        return projects.find((p) => p.id === currentProjectId) || null;
      },

      // API: Fetch all projects
      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/projects");
          const data = await res.json();

          if (!data.success) {
            throw new Error(data.error?.message || "Failed to fetch projects");
          }

          set({
            projects: data.data.projects,
            tier: data.data.tier,
            limits: data.data.limits,
            isLoading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to fetch projects";
          set({ error: message, isLoading: false });
        }
      },

      // API: Create project
      createProject: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = await res.json();

          if (!data.success) {
            throw new Error(data.error?.message || "Failed to create project");
          }

          const newProject: ProjectWithStats = {
            ...data.data.project,
            conversation_count: 0,
            document_count: 0,
            storage_bytes: 0,
          };

          set((state) => ({
            projects: [newProject, ...state.projects],
            isLoading: false,
          }));

          return newProject;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create project";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      // API: Update project
      updateProject: async (projectId, input) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const data = await res.json();

          if (!data.success) {
            throw new Error(data.error?.message || "Failed to update project");
          }

          const updatedProject = data.data.project;

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, ...updatedProject } : p
            ),
            isLoading: false,
          }));

          return updatedProject;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update project";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      // API: Delete project
      deleteProject: async (projectId) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: "DELETE",
          });
          const data = await res.json();

          if (!data.success) {
            throw new Error(data.error?.message || "Failed to delete project");
          }

          set((state) => ({
            projects: state.projects.filter((p) => p.id !== projectId),
            currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
            isLoading: false,
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete project";
          set({ error: message, isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: "vikini-projects",
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);

// Convenience hooks
export const useCurrentProject = () => {
  const store = useProjectStore();
  return store.getCurrentProject();
};

export const useProjectLimits = () => {
  return useProjectStore((state) => ({
    tier: state.tier,
    limits: state.limits,
  }));
};

/**
 * Project Store - Zustand state management for projects
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { ProjectWithStats, UserTier } from "@/types/projects";

export interface ProjectLimits {
  maxProjects: number;
  currentProjects: number;
  maxStorageBytesPerProject: number;
}

async function parseApiResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
  let json: { success?: boolean; data?: T; error?: { message?: string } };
  try {
    json = (await res.json()) as { success?: boolean; data?: T; error?: { message?: string } };
  } catch {
    throw new Error(res.ok ? fallbackMsg : `${fallbackMsg} (HTTP ${res.status})`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(
      json?.error?.message || (res.ok ? fallbackMsg : `${fallbackMsg} (HTTP ${res.status})`)
    );
  }
  return json.data as T;
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
  }) => Promise<ProjectWithStats>;
  updateProject: (
    projectId: string,
    input: {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
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
          const data = await parseApiResponse<{
            projects: ProjectWithStats[];
            tier: UserTier;
            limits: ProjectLimits;
          }>(res, "Failed to fetch projects");

          set({
            projects: data.projects,
            tier: data.tier,
            limits: data.limits,
            isLoading: false,
          });
        } catch (err: unknown) {
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
          const data = await parseApiResponse<{ project: ProjectWithStats }>(
            res,
            "Failed to create project"
          );

          const newProject: ProjectWithStats = {
            ...data.project,
            conversation_count: 0,
            document_count: 0,
            storage_bytes: 0,
          };

          set((state) => ({
            projects: [newProject, ...state.projects],
            limits: state.limits
              ? { ...state.limits, currentProjects: state.limits.currentProjects + 1 }
              : state.limits,
            isLoading: false,
          }));

          return newProject;
        } catch (err: unknown) {
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
          const data = await parseApiResponse<{ project: ProjectWithStats }>(
            res,
            "Failed to update project"
          );

          const updatedProject = data.project;

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, ...updatedProject } : p
            ),
            isLoading: false,
          }));

          return updatedProject;
        } catch (err: unknown) {
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
          await parseApiResponse<unknown>(res, "Failed to delete project");

          set((state) => ({
            projects: state.projects.filter((p) => p.id !== projectId),
            currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
            limits: state.limits
              ? { ...state.limits, currentProjects: Math.max(0, state.limits.currentProjects - 1) }
              : state.limits,
            isLoading: false,
          }));
        } catch (err: unknown) {
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
export const useCurrentProject = () =>
  useProjectStore((s) =>
    s.currentProjectId ? (s.projects.find((p) => p.id === s.currentProjectId) ?? null) : null
  );

export const useProjectLimits = () =>
  useProjectStore(
    useShallow((state) => ({
      tier: state.tier,
      limits: state.limits,
    }))
  );

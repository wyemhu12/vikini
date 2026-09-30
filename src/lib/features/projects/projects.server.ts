/**
 * Projects Server-Side Operations
 * CRUD operations for projects with tier limit enforcement
 * Uses Typed Supabase Client and immutable gemini-embedding-2 model
 */
import { getTypedSupabaseAdmin } from "@/lib/core/supabase.server";
import type { Tables } from "@/types/database.types";
import {
  Project,
  ProjectWithStats,
  CreateProjectInput,
  UpdateProjectInput,
  PROJECT_LIMITS,
  UserTier,
} from "@/types/projects";
import { logger } from "@/lib/utils/logger";

const projectLogger = logger.withContext("projects");

/**
 * Maps database project row to domain Project model.
 * Always normalizes embedding_model to "gemini-embedding-2" and guarantees fallback defaults.
 */
export function toProject(row: Tables<"projects">): Project {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon || "📁",
    color: row.color || "#6366f1",
    embedding_model: "gemini-embedding-2",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

// ============================================
// TIER DETECTION
// ============================================
export async function getUserTier(userId: string): Promise<UserTier> {
  const supabase = getTypedSupabaseAdmin();

  const { data } = await supabase.from("profiles").select("rank").eq("email", userId).single();

  if (!data?.rank) return "basic";

  const rank = String(data.rank).toLowerCase();
  if (rank === "admin") return "admin";
  if (rank === "pro") return "pro";
  return "basic";
}

export function getTierLimits(tier: UserTier) {
  return PROJECT_LIMITS[tier];
}

// ============================================
// PROJECT CRUD
// ============================================

/**
 * Get all projects for a user with stats
 */
export async function getUserProjects(userId: string): Promise<ProjectWithStats[]> {
  const supabase = getTypedSupabaseAdmin();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    projectLogger.error("Failed to fetch projects", error);
    throw new Error("Failed to fetch projects");
  }

  if (!projects || projects.length === 0) {
    return [];
  }

  // Get stats for each project
  const projectsWithStats: ProjectWithStats[] = await Promise.all(
    projects.map(async (project) => {
      const [convCount, docStats] = await Promise.all([
        getProjectConversationCount(project.id),
        getProjectDocumentStats(project.id),
      ]);

      return {
        ...toProject(project),
        conversation_count: convCount,
        document_count: docStats.count,
        storage_bytes: docStats.totalBytes,
      };
    })
  );

  return projectsWithStats;
}

/**
 * Get a single project by ID
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<ProjectWithStats | null> {
  const supabase = getTypedSupabaseAdmin();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    return null;
  }

  const [convCount, docStats] = await Promise.all([
    getProjectConversationCount(projectId),
    getProjectDocumentStats(projectId),
  ]);

  return {
    ...toProject(project),
    conversation_count: convCount,
    document_count: docStats.count,
    storage_bytes: docStats.totalBytes,
  };
}

/**
 * Create a new project
 */
export async function createProject(userId: string, input: CreateProjectInput): Promise<Project> {
  const supabase = getTypedSupabaseAdmin();

  // Check tier limits
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const existingCount = await getUserProjectCount(userId);

  if (existingCount >= limits.maxProjects) {
    throw new Error(`Project limit reached. ${tier} tier allows ${limits.maxProjects} projects.`);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      icon: input.icon || "📁",
      color: input.color || "#6366f1",
      embedding_model: "gemini-embedding-2",
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("A project with this name already exists");
    }
    projectLogger.error("Failed to create project", error);
    throw new Error("Failed to create project");
  }

  projectLogger.info(`Created project: ${data.name} (${data.id}) for user ${userId}`);
  return toProject(data);
}

/**
 * Update a project (embedding_model is immutable and cannot be modified)
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<Project> {
  const supabase = getTypedSupabaseAdmin();

  const updates: {
    name?: string;
    description?: string | null;
    icon?: string;
    color?: string;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) {
    projectLogger.error("Failed to update project", error);
    throw new Error("Failed to update project");
  }

  return toProject(data);
}

/**
 * Delete a project (cascade deletes documents and chunks)
 */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const supabase = getTypedSupabaseAdmin();

  // First, unlink conversations (they're preserved with project_id = NULL)
  await supabase.from("conversations").update({ project_id: null }).eq("project_id", projectId);

  // Delete project (CASCADE will delete documents and chunks)
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    projectLogger.error("Failed to delete project", error);
    throw new Error("Failed to delete project");
  }

  projectLogger.info(`Deleted project ${projectId} for user ${userId}`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserProjectCount(userId: string): Promise<number> {
  const supabase = getTypedSupabaseAdmin();

  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count || 0;
}

async function getProjectConversationCount(projectId: string): Promise<number> {
  const supabase = getTypedSupabaseAdmin();

  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) return 0;
  return count || 0;
}

async function getProjectDocumentStats(
  projectId: string
): Promise<{ count: number; totalBytes: number }> {
  const supabase = getTypedSupabaseAdmin();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("size_bytes")
    .eq("project_id", projectId);

  if (error || !data) {
    return { count: 0, totalBytes: 0 };
  }

  const totalBytes = data.reduce((sum, doc) => sum + (doc.size_bytes || 0), 0);
  return { count: data.length, totalBytes };
}

/**
 * Check if user can add more storage to a project
 */
export async function canAddStorageToProject(
  projectId: string,
  userId: string,
  additionalBytes: number
): Promise<{ allowed: boolean; currentBytes: number; maxBytes: number }> {
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const stats = await getProjectDocumentStats(projectId);

  const maxBytes = limits.maxStorageBytesPerProject;
  const allowed = stats.totalBytes + additionalBytes <= maxBytes;

  return {
    allowed,
    currentBytes: stats.totalBytes,
    maxBytes,
  };
}

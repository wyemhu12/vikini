/**
 * Projects Server-Side Operations
 * CRUD operations for projects with tier limit enforcement
 */
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
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

// ============================================
// TIER DETECTION
// ============================================
export async function getUserTier(userId: string): Promise<UserTier> {
  const supabase = getSupabaseAdmin();

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
  const supabase = getSupabaseAdmin();

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
        ...project,
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
  const supabase = getSupabaseAdmin();

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
    ...project,
    conversation_count: convCount,
    document_count: docStats.count,
    storage_bytes: docStats.totalBytes,
  };
}

/**
 * Create a new project
 */
export async function createProject(userId: string, input: CreateProjectInput): Promise<Project> {
  const supabase = getSupabaseAdmin();

  // Check tier limits
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const existingCount = await getUserProjectCount(userId);

  if (existingCount >= limits.maxProjects) {
    throw new Error(`Project limit reached. ${tier} tier allows ${limits.maxProjects} projects.`);
  }

  // Validate embedding model for tier
  const embeddingModel = input.embedding_model || "text-embedding-004";
  if (!(limits.embeddingModels as readonly string[]).includes(embeddingModel)) {
    throw new Error(`Embedding model ${embeddingModel} not available for ${tier} tier`);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      icon: input.icon || "📁",
      color: input.color || "#6366f1",
      embedding_model: embeddingModel,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A project with this name already exists");
    }
    projectLogger.error("Failed to create project", error);
    throw new Error("Failed to create project");
  }

  projectLogger.info(`Created project: ${data.name} (${data.id}) for user ${userId}`);
  return data;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<Project> {
  const supabase = getSupabaseAdmin();

  // Validate embedding model if changing
  if (input.embedding_model) {
    const tier = await getUserTier(userId);
    const limits = getTierLimits(tier);
    if (!(limits.embeddingModels as readonly string[]).includes(input.embedding_model)) {
      throw new Error(`Embedding model ${input.embedding_model} not available for ${tier} tier`);
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;
  if (input.embedding_model !== undefined) updates.embedding_model = input.embedding_model;

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

  return data;
}

/**
 * Delete a project (cascade deletes documents and chunks)
 */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

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
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count || 0;
}

async function getProjectConversationCount(projectId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

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
  const supabase = getSupabaseAdmin();

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

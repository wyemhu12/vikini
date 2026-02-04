/**
 * Projects + Knowledge Base Types
 */

// ============================================
// TIER LIMITS
// ============================================
export const PROJECT_LIMITS = {
  basic: {
    maxProjects: 5,
    maxDocsPerProject: 50,
    maxStorageBytesPerProject: 5 * 1024 * 1024, // 5MB
    embeddingModels: ["text-embedding-004"] as const,
  },
  pro: {
    maxProjects: 10,
    maxDocsPerProject: 50,
    maxStorageBytesPerProject: 5 * 1024 * 1024, // 5MB
    embeddingModels: ["text-embedding-004", "gemini-embedding-001"] as const,
  },
  admin: {
    maxProjects: 99,
    maxDocsPerProject: 50,
    maxStorageBytesPerProject: 100 * 1024 * 1024, // 100MB
    embeddingModels: ["text-embedding-004", "gemini-embedding-001"] as const,
  },
} as const;

export type UserTier = keyof typeof PROJECT_LIMITS;
export type EmbeddingModel = "text-embedding-004" | "gemini-embedding-001";

// ============================================
// PROJECT
// ============================================
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  embedding_model: EmbeddingModel;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  conversation_count: number;
  document_count: number;
  storage_bytes: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  embedding_model?: EmbeddingModel;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  embedding_model?: EmbeddingModel;
}

// ============================================
// KNOWLEDGE DOCUMENT
// ============================================
export type DocumentStatus = "processing" | "ready" | "error";

export interface KnowledgeDocument {
  id: string;
  project_id: string;
  user_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  total_chunks: number;
  embedding_model: EmbeddingModel | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// KNOWLEDGE CHUNK
// ============================================
export interface KnowledgeChunk {
  id: string;
  document_id: string;
  project_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[]; // Vector, usually not returned
  created_at: string;
}

export interface ChunkMetadata {
  page?: number;
  line_start?: number;
  line_end?: number;
  section?: string;
  [key: string]: unknown;
}

// ============================================
// SEARCH RESULTS
// ============================================
export interface KnowledgeSearchResult {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
}

// ============================================
// SUPPORTED FILE TYPES
// ============================================
export const SUPPORTED_FILE_TYPES = {
  documents: [".pdf", ".txt", ".md", ".docx", ".ini"],
  code: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".css",
    ".scss",
    ".html",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
  ],
} as const;

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_FILE_TYPES.documents,
  ...SUPPORTED_FILE_TYPES.code,
];

export function isSupportedFileType(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return ALL_SUPPORTED_EXTENSIONS.includes(ext as (typeof ALL_SUPPORTED_EXTENSIONS)[number]);
}

export function getFileCategory(filename: string): "document" | "code" | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (
    SUPPORTED_FILE_TYPES.documents.includes(ext as (typeof SUPPORTED_FILE_TYPES.documents)[number])
  ) {
    return "document";
  }
  if (SUPPORTED_FILE_TYPES.code.includes(ext as (typeof SUPPORTED_FILE_TYPES.code)[number])) {
    return "code";
  }
  return null;
}

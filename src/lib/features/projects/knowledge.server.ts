/**
 * Knowledge Base Server Operations
 * Document CRUD, upload processing, and semantic search
 * Uses unified gemini-embedding-2 (3072d) and pre-insert limit validation
 */
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import {
  KnowledgeDocument,
  KnowledgeSearchResult,
  isSupportedFileType,
  getFileCategory,
  MAX_FILE_SIZE_BYTES,
  MAX_CHUNKS_PER_UPLOAD,
} from "@/types/projects";
import { getUserTier, getTierLimits, canAddStorageToProject } from "./projects.server";
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  formatQueryForRAG,
  formatDocumentForRAG,
} from "./embedding.server";
import { chunkContent } from "./chunking";
import { ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const kbLogger = logger.withContext("knowledge");

// ============================================
// DOCUMENT CRUD
// ============================================

/**
 * Get all documents in a project
 */
export async function getProjectDocuments(
  projectId: string,
  userId: string
): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    kbLogger.error("Failed to fetch documents", error);
    throw new Error("Failed to fetch documents");
  }

  return data || [];
}

/**
 * Get a single document by ID
 */
export async function getDocument(
  documentId: string,
  userId: string
): Promise<KnowledgeDocument | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Delete a document (cascade deletes chunks)
 */
export async function deleteDocument(documentId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) {
    kbLogger.error("Failed to delete document", error);
    throw new Error("Failed to delete document");
  }

  kbLogger.info(`Deleted document ${documentId}`);
}

// ============================================
// UPLOAD & PROCESSING
// ============================================

export interface UploadDocumentInput {
  projectId: string;
  userId: string;
  filename: string;
  content: string;
  mimeType?: string;
}

/**
 * Upload and process a document into the knowledge base.
 * Pre-insert validation ensures no phantom/error records are created
 * if the file exceeds size (5MB) or chunks count (500).
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<KnowledgeDocument> {
  const supabase = getSupabaseAdmin();

  // 1. Validate file type
  if (!isSupportedFileType(input.filename)) {
    throw new ValidationError(`Unsupported file type: ${input.filename}`);
  }

  // 2. Check content size (5MB max)
  const contentBytes = Buffer.byteLength(input.content, "utf8");
  if (contentBytes > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds 5MB limit");
  }

  // 3. Check storage limits & tier
  const tier = await getUserTier(input.userId);
  const limits = getTierLimits(tier);
  const storageCheck = await canAddStorageToProject(input.projectId, input.userId, contentBytes);
  if (!storageCheck.allowed) {
    const maxMB = Math.round(storageCheck.maxBytes / (1024 * 1024));
    const usedMB = Math.round(storageCheck.currentBytes / (1024 * 1024));
    throw new Error(`Storage limit exceeded. Project uses ${usedMB}MB of ${maxMB}MB allowed.`);
  }

  // 4. Check document count limit
  const existingDocs = await getProjectDocuments(input.projectId, input.userId);
  if (existingDocs.length >= limits.maxDocsPerProject) {
    throw new Error(
      `Document limit reached. Maximum ${limits.maxDocsPerProject} documents per project.`
    );
  }

  // 5. Pre-insert Validation: Chunking & validate chunks count BEFORE inserting into database!
  const chunks = chunkContent(input.content, input.filename);
  if (chunks.length === 0) {
    throw new ValidationError("No content to process");
  }
  if (chunks.length > MAX_CHUNKS_PER_UPLOAD) {
    throw new ValidationError("Document exceeds maximum 500 chunks limit (~350–400 KB text)");
  }

  // 6. Insert document record (status: processing) ONLY after passing chunk validation
  const { data: doc, error: createError } = await supabase
    .from("knowledge_documents")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      filename: input.filename,
      mime_type: input.mimeType || getMimeType(input.filename),
      size_bytes: contentBytes,
      embedding_model: "gemini-embedding-2",
      status: "processing",
    })
    .select()
    .single();

  if (createError || !doc) {
    kbLogger.error("Failed to create document", createError);
    throw new Error("Failed to create document");
  }

  try {
    // 7. Format chunks and generate embeddings in native batch
    const chunkTexts = chunks.map((c) => formatDocumentForRAG(c.content, input.filename));
    const embeddings = await generateEmbeddingsBatch(chunkTexts);

    // 8. Insert chunks
    const chunkInserts = chunks.map((chunk, i) => ({
      document_id: doc.id,
      project_id: input.projectId,
      user_id: input.userId,
      chunk_index: chunk.index,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: `[${embeddings[i].join(",")}]`,
    }));

    const { error: chunkError } = await supabase.from("knowledge_chunks").insert(chunkInserts);
    if (chunkError) {
      throw new Error("Failed to insert document chunks");
    }

    // 9. Update document status to ready
    const { data: updatedDoc, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        total_chunks: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id)
      .select()
      .single();

    if (updateError || !updatedDoc) {
      throw new Error("Failed to finalize document status");
    }

    return updatedDoc;
  } catch (procErr: unknown) {
    const msg = procErr instanceof Error ? procErr.message : "Processing failed";
    await supabase
      .from("knowledge_documents")
      .update({
        status: "error",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    throw procErr;
  }
}

// ============================================
// CLEANUP STUCK DOCUMENTS
// ============================================

/**
 * Cleans up documents that have been stuck in "processing" state for more than 15 minutes.
 */
export async function cleanupStuckProcessingDocuments(projectId?: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let query = supabase
    .from("knowledge_documents")
    .update({
      status: "error",
      error_message: "Upload processing timed out (exceeded 15 minutes)",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt("updated_at", fifteenMinutesAgo);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.select("id");
  if (error) {
    kbLogger.error("Failed to cleanup stuck documents", error);
    return 0;
  }
  return data?.length ?? 0;
}

// ============================================
// SEARCH
// ============================================

/**
 * Search knowledge base for a project using semantic similarity.
 * Zero sample chunk overhead and zero extra DB round-trip.
 */
export async function searchKnowledge(
  projectId: string,
  userId: string,
  query: string,
  options?: {
    threshold?: number;
    limit?: number;
  }
): Promise<KnowledgeSearchResult[]> {
  const supabase = getSupabaseAdmin();
  const threshold = options?.threshold ?? 0.7;
  const limit = options?.limit ?? 5;

  kbLogger.info(`Search: project=${projectId}, threshold=${threshold}, limit=${limit}`);

  // 1. Generate query embedding with task prefix for optimal asymmetric retrieval
  const formattedQuery = formatQueryForRAG(query);
  const queryEmbedding = await generateEmbedding(formattedQuery);

  // 2. Search using the RPC function directly
  const { data, error } = await supabase.rpc("match_project_knowledge", {
    p_project_id: projectId,
    query_embedding: `[${queryEmbedding.join(",")}]`,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    kbLogger.error("Knowledge search failed", error);
    throw new Error("Search failed");
  }

  return (data || []) as KnowledgeSearchResult[];
}

// ============================================
// HELPERS
// ============================================

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  const category = getFileCategory(filename);

  if (category === "code") {
    return "text/plain";
  }

  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ini": "text/plain",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

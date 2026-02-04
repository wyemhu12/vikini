/**
 * Knowledge Base Server Operations
 * Document CRUD, upload processing, and search
 */
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import {
  KnowledgeDocument,
  KnowledgeSearchResult,
  EmbeddingModel,
  isSupportedFileType,
  getFileCategory,
} from "@/types/projects";
import { getUserTier, getTierLimits, canAddStorageToProject } from "./projects.server";
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  getValidatedEmbeddingModel,
} from "./embedding.server";
import { chunkContent } from "./chunking";
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
  embeddingModel?: EmbeddingModel;
}

/**
 * Upload and process a document into the knowledge base
 * This creates the document, chunks the content, generates embeddings,
 * and stores everything in the database
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<KnowledgeDocument> {
  const supabase = getSupabaseAdmin();

  // Validate file type
  if (!isSupportedFileType(input.filename)) {
    throw new Error(`Unsupported file type: ${input.filename}`);
  }

  // Check tier and get validated embedding model
  const tier = await getUserTier(input.userId);
  const limits = getTierLimits(tier);
  const embeddingModel = await getValidatedEmbeddingModel(input.userId, input.embeddingModel);

  // Calculate content size
  const contentBytes = new Blob([input.content]).size;

  // Check storage limits
  const storageCheck = await canAddStorageToProject(input.projectId, input.userId, contentBytes);

  if (!storageCheck.allowed) {
    const maxMB = Math.round(storageCheck.maxBytes / (1024 * 1024));
    const usedMB = Math.round(storageCheck.currentBytes / (1024 * 1024));
    throw new Error(`Storage limit exceeded. Project uses ${usedMB}MB of ${maxMB}MB allowed.`);
  }

  // Check document count limit
  const existingDocs = await getProjectDocuments(input.projectId, input.userId);
  if (existingDocs.length >= limits.maxDocsPerProject) {
    throw new Error(
      `Document limit reached. Maximum ${limits.maxDocsPerProject} documents per project.`
    );
  }

  // Create document record (status: processing)
  const { data: doc, error: createError } = await supabase
    .from("knowledge_documents")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      filename: input.filename,
      mime_type: input.mimeType || getMimeType(input.filename),
      size_bytes: contentBytes,
      embedding_model: embeddingModel,
      status: "processing",
    })
    .select()
    .single();

  if (createError || !doc) {
    kbLogger.error("Failed to create document", createError);
    throw new Error("Failed to create document");
  }

  try {
    // Chunk the content
    const chunks = chunkContent(input.content, input.filename);
    kbLogger.info(`Chunked ${input.filename} into ${chunks.length} chunks for ${embeddingModel}`);

    if (chunks.length === 0) {
      throw new Error("No content to process");
    }

    // Generate embeddings in batch
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingsBatch(chunkTexts, embeddingModel);

    // Insert chunks with embeddings
    const chunkInserts = chunks.map((chunk, i) => ({
      document_id: doc.id,
      project_id: input.projectId,
      user_id: input.userId,
      chunk_index: chunk.index,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: `[${embeddings[i].join(",")}]`, // pgvector format
    }));

    const { error: chunkError } = await supabase.from("knowledge_chunks").insert(chunkInserts);

    if (chunkError) {
      kbLogger.error("Failed to insert chunks", chunkError);
      throw new Error("Failed to process document chunks");
    }

    // Update document status to ready
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

    if (updateError) {
      kbLogger.error("Failed to update document status", updateError);
    }

    kbLogger.info(`Successfully processed ${input.filename}: ${chunks.length} chunks`);
    return updatedDoc || { ...doc, status: "ready", total_chunks: chunks.length };
  } catch (error) {
    // Mark document as error
    await supabase
      .from("knowledge_documents")
      .update({
        status: "error",
        error_message: error instanceof Error ? error.message : "Processing failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    throw error;
  }
}

// ============================================
// SEARCH
// ============================================

/**
 * Search knowledge base for a project using semantic similarity
 */
export async function searchKnowledge(
  projectId: string,
  userId: string,
  query: string,
  options?: {
    threshold?: number;
    limit?: number;
    embeddingModel?: EmbeddingModel;
  }
): Promise<KnowledgeSearchResult[]> {
  const supabase = getSupabaseAdmin();
  const threshold = options?.threshold ?? 0.7;
  const limit = options?.limit ?? 5;

  // Get the embedding model used for this project
  const { data: project } = await supabase
    .from("projects")
    .select("embedding_model")
    .eq("id", projectId)
    .single();

  const embeddingModel = (project?.embedding_model ||
    options?.embeddingModel ||
    "gemini-embedding-001") as EmbeddingModel;

  kbLogger.info(`Search: project=${projectId}, model=${embeddingModel}, threshold=${threshold}`);

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query, embeddingModel);
  kbLogger.info(`Query embedding generated: ${queryEmbedding.length} dimensions`);

  // First check if project has any chunks with embeddings
  const { data: sampleChunk, error: sampleError } = await supabase
    .from("knowledge_chunks")
    .select("id, embedding")
    .eq("project_id", projectId)
    .limit(1)
    .single();

  if (sampleError || !sampleChunk) {
    kbLogger.warn(`Project ${projectId} has no knowledge chunks`);
    return [];
  }

  // Check if chunk has embedding - Supabase returns vector as string "[0.1,0.2,...]"
  const hasEmbedding = sampleChunk.embedding !== null && sampleChunk.embedding !== undefined;
  let embeddingDims = 0;

  if (hasEmbedding) {
    // Handle both array and string formats from Supabase
    if (Array.isArray(sampleChunk.embedding)) {
      embeddingDims = sampleChunk.embedding.length;
    } else if (typeof sampleChunk.embedding === "string") {
      // Parse vector string format: "[0.1,0.2,...]"
      try {
        const parsed = JSON.parse(sampleChunk.embedding);
        embeddingDims = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        // Count commas + 1 as rough estimate
        const str = sampleChunk.embedding as string;
        embeddingDims = str.split(",").length;
      }
    }
  }

  kbLogger.info(
    `Chunk sample: hasEmbedding=${hasEmbedding}, dims=${embeddingDims}, queryDims=${queryEmbedding.length}`
  );

  // CRITICAL: Check for dimension mismatch
  if (hasEmbedding && embeddingDims > 0 && embeddingDims !== queryEmbedding.length) {
    kbLogger.error(
      `DIMENSION MISMATCH! Chunks have ${embeddingDims} dims, query has ${queryEmbedding.length} dims`
    );
    kbLogger.error(`Documents need to be re-uploaded with the same embedding model`);
    return [];
  }

  if (!hasEmbedding) {
    kbLogger.warn(`Chunks exist but have no embeddings - need to re-embed`);
    return [];
  }

  // Search using the RPC function
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

  kbLogger.info(`RPC returned ${data?.length ?? 0} results`);
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

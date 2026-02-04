/**
 * RAG Context Builder for Chat Stream
 * Injects knowledge base context into chat conversations
 */
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { searchKnowledge } from "@/lib/features/projects/knowledge.server";
import { logger } from "@/lib/utils/logger";
import type { KnowledgeSearchResult } from "@/types/projects";

const ragLogger = logger.withContext("rag");

export interface RAGContext {
  /** Knowledge chunks to inject into system prompt */
  contextChunks: string;
  /** Sources for citation */
  sources: Array<{
    filename: string;
    documentId: string;
    chunkId: string;
    similarity: number;
  }>;
  /** Whether RAG was used */
  ragEnabled: boolean;
  /** Project ID if any */
  projectId: string | null;
}

/**
 * Get project ID for a conversation (if any)
 */
export async function getConversationProjectId(conversationId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("project_id")
    .eq("id", conversationId)
    .single();

  if (error || !data?.project_id) return null;
  return data.project_id;
}

/**
 * Build RAG context for a chat message
 * Searches the project's knowledge base and returns formatted context
 */
export async function buildRAGContext(
  userId: string,
  conversationId: string,
  userMessage: string,
  options?: {
    maxChunks?: number;
    minSimilarity?: number;
  }
): Promise<RAGContext> {
  const emptyContext: RAGContext = {
    contextChunks: "",
    sources: [],
    ragEnabled: false,
    projectId: null,
  };

  try {
    // Check if conversation has a project
    const projectId = await getConversationProjectId(conversationId);
    ragLogger.info(`Conversation ${conversationId} projectId: ${projectId || "NULL"}`);
    if (!projectId) {
      ragLogger.info(`No project linked to conversation ${conversationId}`);
      return emptyContext;
    }

    // Search knowledge base
    const maxChunks = options?.maxChunks ?? 5;
    // Threshold: 0.5 provides good balance between precision and recall
    const minSimilarity = options?.minSimilarity ?? 0.5;

    ragLogger.info(
      `Searching KB for project ${projectId}, query: "${userMessage.slice(0, 50)}..."`
    );

    const results = await searchKnowledge(projectId, userId, userMessage, {
      threshold: minSimilarity,
      limit: maxChunks,
    });

    if (results.length === 0) {
      ragLogger.info(
        `No KB results for conversation ${conversationId} (project: ${projectId}, threshold: ${minSimilarity})`
      );
      return { ...emptyContext, ragEnabled: true, projectId };
    }

    // Format context chunks
    const contextChunks = formatKnowledgeChunks(results);
    const sources = results.map((r) => ({
      filename: r.filename,
      documentId: r.document_id,
      chunkId: r.id,
      similarity: r.similarity,
    }));

    ragLogger.info(
      `RAG: Found ${results.length} relevant chunks for conversation ${conversationId}`
    );

    return {
      contextChunks,
      sources,
      ragEnabled: true,
      projectId,
    };
  } catch (error) {
    ragLogger.error("RAG context build failed", error);
    return emptyContext;
  }
}

/**
 * Format knowledge chunks into a context string
 */
function formatKnowledgeChunks(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) return "";

  const header = `
[KNOWLEDGE BASE CONTEXT]
The following information is from the project's knowledge base. Use this to inform your response when relevant.
Do not make up information - if you can't find the answer in the context, say so.
`;

  const chunks = results
    .map((r, i) => {
      const source = `[Source ${i + 1}: ${r.filename}]`;
      return `${source}\n${r.content}`;
    })
    .join("\n\n---\n\n");

  return `${header}\n${chunks}\n[END KNOWLEDGE BASE CONTEXT]\n`;
}

/**
 * Inject RAG context into system prompt
 * KB context is appended AFTER GEM instructions to preserve persona priority
 */
export function injectRAGIntoSystemPrompt(sysPrompt: string, ragContext: RAGContext): string {
  if (!ragContext.ragEnabled || !ragContext.contextChunks) {
    return sysPrompt;
  }

  // GEM instructions come first (persona), KB context comes after (reference data)
  return (sysPrompt || "") + "\n\n" + ragContext.contextChunks;
}

/**
 * Embedding Service - Tier-based embedding generation
 * Uses text-embedding-004 (free/768d) and gemini-embedding-2 (3072d/multimodal)
 */
import { GoogleGenAI } from "@google/genai";
import { EmbeddingModel, PROJECT_LIMITS, UserTier } from "@/types/projects";
import { getUserTier } from "./projects.server";
import { logger } from "@/lib/utils/logger";

const embeddingLogger = logger.withContext("embedding");

// Singleton clients
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Google AI API key");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// Model dimensions (default output)
const MODEL_DIMENSIONS: Record<EmbeddingModel, number> = {
  "text-embedding-004": 768,
  "gemini-embedding-2": 3072, // supports 768, 1536, 3072 via outputDimensionality
};

/**
 * Whether a model is the new gemini-embedding-2 (uses task prefix format).
 */
function isEmbedding2(model: EmbeddingModel): boolean {
  return model === "gemini-embedding-2";
}

/**
 * Format content with task prefix for gemini-embedding-2 RAG queries.
 * Embedding-2 uses inline text prefixes instead of task_type config.
 * @see https://ai.google.dev/gemini-api/docs/embeddings#task-types-embeddings-2
 */
export function formatQueryForRAG(query: string): string {
  return `task: question answering | query: ${query}`;
}

/**
 * Format document content with title prefix for gemini-embedding-2 indexing.
 */
export function formatDocumentForRAG(content: string, title?: string): string {
  const safeTitle = title || "none";
  return `title: ${safeTitle} | text: ${content}`;
}

/**
 * Get the default embedding model for a user tier
 */
export function getDefaultEmbeddingModel(tier: UserTier): EmbeddingModel {
  const models = PROJECT_LIMITS[tier].embeddingModels as readonly string[];
  // Default to best available model for the tier
  if (models.includes("gemini-embedding-2")) {
    return "gemini-embedding-2";
  }
  return "text-embedding-004";
}

/**
 * Validate that a model is available for a tier
 */
export function isModelAvailableForTier(model: EmbeddingModel, tier: UserTier): boolean {
  return (PROJECT_LIMITS[tier].embeddingModels as readonly string[]).includes(model);
}

/**
 * Get embedding dimension for a model
 */
export function getEmbeddingDimension(model: EmbeddingModel): number {
  return MODEL_DIMENSIONS[model];
}

/**
 * Generate embeddings for text content
 */
export async function generateEmbedding(content: string, model: EmbeddingModel): Promise<number[]> {
  const client = getClient();

  try {
    // Build config for embedding-2 (supports outputDimensionality)
    const config = isEmbedding2(model)
      ? { outputDimensionality: MODEL_DIMENSIONS[model] }
      : undefined;

    const result = await client.models.embedContent({
      model,
      contents: content,
      ...(config ? { config } : {}),
    });

    if (!result.embeddings || result.embeddings.length === 0) {
      throw new Error("No embeddings returned");
    }

    const embedding = result.embeddings[0].values;
    if (!embedding) {
      throw new Error("Empty embedding values");
    }

    return embedding;
  } catch (error) {
    embeddingLogger.error(`Failed to generate embedding with ${model}`, error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple chunks in batch
 * More efficient than generating one at a time
 */
export async function generateEmbeddingsBatch(
  contents: string[],
  model: EmbeddingModel
): Promise<number[][]> {
  const client = getClient();
  const embeddings: number[][] = [];

  // Process in batches of 100 (API limit)
  const batchSize = 100;
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize);

    try {
      // Process batch in parallel with some concurrency limit
      const batchResults = await Promise.all(
        batch.map(async (content) => {
          const result = await client.models.embedContent({
            model,
            contents: content,
          });
          return result.embeddings?.[0]?.values || [];
        })
      );

      embeddings.push(...batchResults);
    } catch (error) {
      embeddingLogger.error(
        `Failed to generate batch embeddings (batch ${i / batchSize + 1})`,
        error
      );
      throw error;
    }
  }

  return embeddings;
}

/**
 * Get embedding model for a user, validating against their tier
 */
export async function getValidatedEmbeddingModel(
  userId: string,
  requestedModel?: EmbeddingModel
): Promise<EmbeddingModel> {
  const tier = await getUserTier(userId);

  if (requestedModel) {
    if (isModelAvailableForTier(requestedModel, tier)) {
      return requestedModel;
    }
    embeddingLogger.warn(
      `User ${userId} (${tier}) requested unavailable model ${requestedModel}, falling back`
    );
  }

  return getDefaultEmbeddingModel(tier);
}

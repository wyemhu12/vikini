/**
 * Embedding Service - Tier-based embedding generation
 * Uses text-embedding-004 (free) for Basic, gemini-embedding-001 for Pro/Admin
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

// Model dimensions
const MODEL_DIMENSIONS: Record<EmbeddingModel, number> = {
  "text-embedding-004": 768,
  "gemini-embedding-001": 3072,
};

/**
 * Get the default embedding model for a user tier
 */
export function getDefaultEmbeddingModel(tier: UserTier): EmbeddingModel {
  const models = PROJECT_LIMITS[tier].embeddingModels as readonly string[];
  // Default to best available model for the tier
  if (models.includes("gemini-embedding-001")) {
    return "gemini-embedding-001";
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
    const result = await client.models.embedContent({
      model,
      contents: content,
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

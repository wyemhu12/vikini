/**
 * Embedding Service - Unified Gemini Embedding 2 (3072d)
 * Model API: gemini-embedding-2-preview
 */
import { GoogleGenAI, ApiError } from "@google/genai";
import { logger } from "@/lib/utils/logger";

const embeddingLogger = logger.withContext("embedding");

export const GEMINI_EMBEDDING_API_MODEL = "gemini-embedding-2-preview";
export const EMBEDDING_DIMENSION = 3072;
export const NATIVE_BATCH_SIZE = 50; // Tối đa 50 texts trong 1 request
export const UPLOAD_MAX_RETRIES = 3; // Upload tài liệu retry tối đa 3 lần
export const SEARCH_MAX_RETRIES = 1; // Search query chỉ retry tối đa 1 lần để tối ưu latency
export const EMBEDDING_INITIAL_RETRY_DELAY_MS = 1000;

// Singleton clients (lazy initialization)
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

/**
 * Format content with task prefix for gemini-embedding-2 RAG queries.
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
 * Checks whether an error from Google GenAI is transient and retryable.
 */
export function isRetryableApiError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 429 || error.status === 503 || error.status === 500;
  }
  return false;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

/**
 * Executes an embedding operation with exponential backoff and jitter.
 */
export async function withEmbeddingRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? UPLOAD_MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? EMBEDDING_INITIAL_RETRY_DELAY_MS;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !isRetryableApiError(error)) {
        throw error;
      }
      const jitter = initialDelayMs === 0 ? 0 : Math.random() * 200;
      const delay =
        initialDelayMs === 0
          ? 0
          : Math.min(initialDelayMs * Math.pow(2, attempt - 1) + jitter, 10000);
      embeddingLogger.warn(
        `Gemini Embedding transient error. Retrying attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms...`
      );
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

/**
 * Generate embedding for a single text query (Search RAG, max 1 retry).
 */
export async function generateEmbedding(
  content: string,
  retryOptions?: RetryOptions
): Promise<number[]> {
  const genaiClient = getClient();
  const options: RetryOptions = {
    maxRetries: retryOptions?.maxRetries ?? SEARCH_MAX_RETRIES,
    initialDelayMs: retryOptions?.initialDelayMs,
  };

  return withEmbeddingRetry(async () => {
    const result = await genaiClient.models.embedContent({
      model: GEMINI_EMBEDDING_API_MODEL,
      contents: content,
      config: { outputDimensionality: EMBEDDING_DIMENSION },
    });

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Invalid embedding returned: expected ${EMBEDDING_DIMENSION} dimensions, got ${values?.length ?? 0}`
      );
    }
    return values;
  }, options);
}

/**
 * Generate embeddings for multiple text chunks using native batching with Content parts.
 */
export async function generateEmbeddingsBatch(
  contents: string[],
  retryOptions?: RetryOptions
): Promise<number[][]> {
  if (contents.length === 0) return [];
  const genaiClient = getClient();
  const allEmbeddings: number[][] = [];
  const options: RetryOptions = {
    maxRetries: retryOptions?.maxRetries ?? UPLOAD_MAX_RETRIES,
    initialDelayMs: retryOptions?.initialDelayMs,
  };

  for (let i = 0; i < contents.length; i += NATIVE_BATCH_SIZE) {
    const subBatch = contents.slice(i, i + NATIVE_BATCH_SIZE);

    const batchResults = await withEmbeddingRetry(async () => {
      // BẮT BUỘC: Truyền mảng Content objects với parts: [{ text }]
      // Tránh SDK gom string[] thành 1 Content duy nhất dẫn đến trả về 1 embedding!
      const result = await genaiClient.models.embedContent({
        model: GEMINI_EMBEDDING_API_MODEL,
        contents: subBatch.map((text) => ({
          role: "user",
          parts: [{ text }],
        })),
        config: { outputDimensionality: EMBEDDING_DIMENSION },
      });

      if (!result.embeddings || result.embeddings.length !== subBatch.length) {
        throw new Error(
          `Batch embedding length mismatch: expected ${subBatch.length}, got ${result.embeddings?.length ?? 0}`
        );
      }

      return result.embeddings.map((emb, idx) => {
        const values = emb.values;
        if (!values || values.length !== EMBEDDING_DIMENSION) {
          throw new Error(
            `Invalid embedding at index ${idx}: expected ${EMBEDDING_DIMENSION} dimensions, got ${values?.length ?? 0}`
          );
        }
        return values;
      });
    }, options);

    allEmbeddings.push(...batchResults);
  }

  return allEmbeddings;
}

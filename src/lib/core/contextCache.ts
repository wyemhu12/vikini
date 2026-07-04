// /lib/core/contextCache.ts
// Explicit Context Caching for Gemini API
//
// Strategy B: Composite Cache - caches system instruction + tools + toolConfig together
// Strategy D: Content Cache - caches large KB/RAG documents for project conversations
//
// Gemini API constraint: cachedContent cannot coexist with system_instruction,
// tools, or tool_config in generateContent requests. ALL must be inside the cache.
//
// @see https://ai.google.dev/gemini-api/docs/caching

import { getGenAIClient } from "@/lib/core/genaiClient";
import { logger } from "@/lib/utils/logger";

const cacheLogger = logger.withContext("contextCache");

/**
 * Minimum input token count for explicit caching to be effective.
 * Gemini 2.5+: varies per model, generally ~1024-2048 tokens minimum.
 * Below this threshold, caching overhead exceeds the savings.
 */
const MIN_CACHEABLE_CHARS = 4096; // ~1024 tokens (rough estimate at 4 chars/token)

/**
 * Default TTL for cached content in seconds.
 * GEM personas are typically stable across sessions - 1 hour is a good balance
 * between cost savings and storage fees.
 */
const DEFAULT_CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * TTL for KB content caches - shorter since RAG results vary per query.
 * KB documents themselves don't change often, but the injected chunks differ per conversation.
 */
const KB_CACHE_TTL_SECONDS = 1800; // 30 minutes

/**
 * In-memory map of cache names keyed by a composite key.
 * Format: `{type}:{model}:{hash}` -> `cachedContents/{id}`
 *
 * This avoids recreating caches for the same content on every request.
 * In a multi-instance deployment, each instance maintains its own map,
 * which is acceptable since Gemini API also deduplicates server-side.
 */
const activeCacheNames = new Map<string, { name: string; expiresAt: number }>();

/**
 * Simple hash for cache key deduplication.
 * Uses djb2 algorithm - fast, low collision for our use case.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ============================================
// Strategy B: Composite Cache (SysInstruction + Tools)
// ============================================

/**
 * Configuration for composite cache creation.
 * Includes system instruction, tools, and toolConfig - all fields that
 * CANNOT be sent alongside cachedContent in generateContent requests.
 */
export interface CompositeCacheConfig {
  model: string;
  systemInstruction: string;
  tools?: Array<Record<string, unknown>>;
  toolConfig?: Record<string, unknown>;
}

interface CacheResult {
  /** The cache name to pass to generateContent config */
  cacheName: string;
  /** Whether this was a cache hit (reused) or miss (newly created) */
  cacheHit: boolean;
}

/**
 * Build a composite cache key from model + system instruction + tools fingerprint.
 * Different tool combinations (web search on/off) produce different cache keys.
 */
function buildCompositeCacheKey(config: CompositeCacheConfig): string {
  const sysHash = hashString(config.systemInstruction);
  const toolsHash = config.tools?.length ? hashString(JSON.stringify(config.tools)) : "nt"; // no-tools
  const toolConfigHash = config.toolConfig ? hashString(JSON.stringify(config.toolConfig)) : "nc"; // no-config
  return `comp:${config.model}:${sysHash}:${toolsHash}:${toolConfigHash}`;
}

/**
 * Get or create a composite cache containing system instruction + tools.
 *
 * Strategy B: By including tools in the cache, we avoid the API conflict
 * where cachedContent + tools in the same request causes 400 error.
 *
 * Flow:
 * 1. Build composite key from model + sysInstruction + tools hash
 * 2. Check in-memory map for active cache
 * 3. If miss, create via `ai.caches.create()` with all fields
 * 4. Store cache name in memory
 *
 * @param config - Model, system instruction, tools, and toolConfig
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 * @returns CacheResult with cache name, or null if caching is not applicable
 */
export async function getOrCreateCompositeCache(
  config: CompositeCacheConfig,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
): Promise<CacheResult | null> {
  // Guard: skip if content is too short for caching to be cost-effective
  if (!config.systemInstruction || config.systemInstruction.length < MIN_CACHEABLE_CHARS) {
    cacheLogger.info(
      `[COMPOSITE] Skipping: content too short (${config.systemInstruction?.length || 0} chars < ${MIN_CACHEABLE_CHARS} min)`
    );
    return null;
  }

  // Guard: only Gemini models support explicit caching
  if (!config.model.startsWith("gemini-")) {
    return null;
  }

  const cacheKey = buildCompositeCacheKey(config);
  const now = Date.now();

  // Check in-memory map for active cache
  const existing = activeCacheNames.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    cacheLogger.info(`[COMPOSITE] Cache HIT: ${cacheKey} → ${existing.name}`);
    return { cacheName: existing.name, cacheHit: true };
  }

  // Cache miss - create new
  try {
    const ai = getGenAIClient();

    const cacheConfig: Record<string, unknown> = {
      systemInstruction: config.systemInstruction,
      ttl: `${ttlSeconds}s`,
    };

    // Include tools in cache if provided
    if (config.tools && config.tools.length > 0) {
      cacheConfig.tools = config.tools;
    }

    // Include toolConfig in cache if provided
    if (config.toolConfig) {
      cacheConfig.toolConfig = config.toolConfig;
    }

    const cache = await ai.caches.create({
      model: config.model,
      config: cacheConfig,
    });

    if (!cache?.name) {
      cacheLogger.error("[COMPOSITE] Cache creation returned no name");
      return null;
    }

    // Store in memory with expiration
    const expiresAt = now + ttlSeconds * 1000;
    activeCacheNames.set(cacheKey, { name: cache.name, expiresAt });

    const toolNames = (config.tools || []).map((t) => Object.keys(t).join(",")).join("; ");
    cacheLogger.info(
      `[COMPOSITE] Cache CREATED: ${cacheKey} → ${cache.name} (TTL: ${ttlSeconds}s, chars: ${config.systemInstruction.length}, tools: [${toolNames}])`
    );

    return { cacheName: cache.name, cacheHit: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    cacheLogger.error(`[COMPOSITE] Cache creation failed: ${message}`);
    // Non-fatal: fall back to standard (uncached) request
    return null;
  }
}

// ============================================
// Strategy D: Content Cache (KB Documents)
// ============================================

/**
 * Build cache key for KB content caching.
 * Key is based on projectId + hash of the RAG content (which varies per query).
 */
function buildContentCacheKey(model: string, projectId: string, contentHash: string): string {
  return `kb:${model}:${projectId}:${contentHash}`;
}

/**
 * Get or create a content cache for KB/RAG documents.
 *
 * Strategy D: Cache large KB document chunks that are injected into contents.
 * Unlike composite cache, this caches the CONTENTS (user messages with KB data),
 * not the system instruction. Useful when KB documents are large (10K-100K tokens)
 * and reused across multiple turns in the same project conversation.
 *
 * @param model - Gemini model ID
 * @param projectId - Project ID for cache key scoping
 * @param kbContents - The KB document contents to cache (as Gemini content parts)
 * @param ttlSeconds - Time to live in seconds (default: 30 minutes)
 * @returns CacheResult with cache name, or null if not applicable
 */
export async function getOrCreateKBCache(
  model: string,
  projectId: string,
  kbContents: unknown[],
  ttlSeconds: number = KB_CACHE_TTL_SECONDS
): Promise<CacheResult | null> {
  // Guard: only Gemini models
  if (!model.startsWith("gemini-")) {
    return null;
  }

  // Guard: need meaningful content to cache
  const contentStr = JSON.stringify(kbContents);
  if (contentStr.length < MIN_CACHEABLE_CHARS) {
    cacheLogger.info(
      `[KB CACHE] Skipping: content too short (${contentStr.length} chars < ${MIN_CACHEABLE_CHARS} min)`
    );
    return null;
  }

  const contentHash = hashString(contentStr);
  const cacheKey = buildContentCacheKey(model, projectId, contentHash);
  const now = Date.now();

  // Check in-memory map
  const existing = activeCacheNames.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    cacheLogger.info(`[KB CACHE] HIT: ${cacheKey} → ${existing.name}`);
    return { cacheName: existing.name, cacheHit: true };
  }

  // Cache miss - create
  try {
    const ai = getGenAIClient();

    // Cast contents to SDK-compatible type at the boundary
    const cache = await ai.caches.create({
      model,
      config: {
        contents: kbContents as Array<{ role: string; parts: Array<{ text: string }> }>,
        ttl: `${ttlSeconds}s`,
      },
    });

    if (!cache?.name) {
      cacheLogger.error("[KB CACHE] Creation returned no name");
      return null;
    }

    const expiresAt = now + ttlSeconds * 1000;
    activeCacheNames.set(cacheKey, { name: cache.name, expiresAt });

    cacheLogger.info(
      `[KB CACHE] CREATED: ${cacheKey} → ${cache.name} (TTL: ${ttlSeconds}s, project: ${projectId}, contentChars: ${contentStr.length})`
    );

    return { cacheName: cache.name, cacheHit: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    cacheLogger.error(`[KB CACHE] Creation failed: ${message}`);
    return null;
  }
}

// ============================================
// Legacy API (backward compat - delegates to composite)
// ============================================

/**
 * @deprecated Use getOrCreateCompositeCache instead.
 * Kept for backward compatibility - delegates to composite cache without tools.
 */
export async function getOrCreateSystemCache(
  model: string,
  systemInstruction: string,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
): Promise<CacheResult | null> {
  return getOrCreateCompositeCache({ model, systemInstruction }, ttlSeconds);
}

// ============================================
// Utilities
// ============================================

/**
 * Cleanup expired entries from the in-memory cache map.
 * Called periodically to prevent memory leaks in long-running processes.
 */
export function cleanupExpiredCaches(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of activeCacheNames) {
    if (entry.expiresAt <= now) {
      activeCacheNames.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    cacheLogger.info(`Cleaned up ${cleaned} expired cache entries`);
  }

  return cleaned;
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): {
  activeCaches: number;
  compositeCaches: number;
  kbCaches: number;
  oldestExpiresIn: number | null;
} {
  const now = Date.now();
  let oldestExpiresIn: number | null = null;
  let compositeCaches = 0;
  let kbCaches = 0;

  for (const [key, entry] of activeCacheNames) {
    const remaining = entry.expiresAt - now;
    if (remaining > 0) {
      if (key.startsWith("comp:")) compositeCaches++;
      if (key.startsWith("kb:")) kbCaches++;
      if (oldestExpiresIn === null || remaining < oldestExpiresIn) {
        oldestExpiresIn = remaining;
      }
    }
  }

  return {
    activeCaches: activeCacheNames.size,
    compositeCaches,
    kbCaches,
    oldestExpiresIn,
  };
}

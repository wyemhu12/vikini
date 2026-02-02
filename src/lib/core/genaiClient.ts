// /lib/core/genaiClient.ts
// Lazy, cached GoogleGenAI client (Node/server only)
// Validate environment variables on import
import "@/lib/env";

import { GoogleGenAI } from "@google/genai";

function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

let cachedClient: GoogleGenAI | null = null;
let cachedKey = "";
let cachedCreatedAt = 0;

/**
 * Returns a cached GoogleGenAI client for interacting with Gemini models.
 *
 * **Features:**
 * - Lazy initialization (no top-level environment variable access)
 * - Singleton pattern - returns the same instance if API key hasn't changed
 * - Automatic caching per runtime
 *
 * **Environment Variables:**
 * - `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Google AI API key
 *
 * **Usage:**
 * The client is cached per runtime. If the API key changes, a new client
 * will be created automatically.
 *
 * @returns Configured GoogleGenAI client instance
 * @throws {Error} If `GEMINI_API_KEY` or `GOOGLE_API_KEY` is missing
 *
 * @example
 * ```typescript
 * const client = getGenAIClient();
 * const response = await client.models.generateContent({
 *   model: 'gemini-pro',
 *   contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
 * });
 * ```
 */
export function getGenAIClient(): GoogleGenAI {
  const apiKey = pickFirstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (!apiKey) {
    // SECURITY: Use generic error message to avoid leaking env var names
    throw new Error("AI service configuration is missing");
  }

  if (cachedClient && cachedKey === apiKey) return cachedClient;

  cachedKey = apiKey;
  cachedCreatedAt = Date.now();
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/**
 * Returns information about the cached GoogleGenAI client.
 *
 * Useful for debugging and monitoring client initialization.
 *
 * @returns Object with:
 *   - `cached`: Whether a client instance is currently cached
 *   - `createdAt`: Timestamp (ms) when the client was created, or 0 if not cached
 *
 * @example
 * ```typescript
 * const info = getGenAIClientInfo();
 * console.log(`Client cached: ${info.cached}, created at: ${new Date(info.createdAt)}`);
 * ```
 */
export function getGenAIClientInfo(): { cached: boolean; createdAt: number } {
  return {
    cached: Boolean(cachedClient),
    createdAt: cachedCreatedAt || 0,
  };
}

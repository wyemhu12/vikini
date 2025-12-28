// /lib/core/genaiClient.ts
// Lazy, cached GoogleGenAI client (Node/server only)

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
 * Returns a cached GoogleGenAI client.
 * - Lazy init (no top-level env access)
 * - Singleton cache per runtime
 */
export function getGenAIClient(): GoogleGenAI {
  const apiKey = pickFirstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY/GOOGLE_API_KEY");
  }

  if (cachedClient && cachedKey === apiKey) return cachedClient;

  cachedKey = apiKey;
  cachedCreatedAt = Date.now();
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function getGenAIClientInfo(): { cached: boolean; createdAt: number } {
  return {
    cached: Boolean(cachedClient),
    createdAt: cachedCreatedAt || 0,
  };
}


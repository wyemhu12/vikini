// /lib/core/genaiClient.js
// Lazy, cached GoogleGenAI client (Node/server only)

import { GoogleGenAI } from "@google/genai";

function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

let cachedClient = null;
let cachedKey = "";
let cachedCreatedAt = 0;

/**
 * Returns a cached GoogleGenAI client.
 * - Lazy init (no top-level env access)
 * - Singleton cache per runtime
 */
export function getGenAIClient() {
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

export function getGenAIClientInfo() {
  return {
    cached: Boolean(cachedClient),
    createdAt: cachedCreatedAt || 0,
  };
}

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

// =====================================================================================
// Deep Research Interactions API
// =====================================================================================

/**
 * Minimal interface for Interaction objects returned by the Interactions API.
 * Defined locally to avoid dependency on SDK types that may not be exported.
 */
interface InteractionResult {
  id: string;
  status?: string;
  output_text?: string;
  error?: string;
}

/**
 * Minimal interface for the Interactions namespace on GoogleGenAI.
 * The SDK v2.x exposes `client.interactions.create()` and `client.interactions.get()`.
 */
interface InteractionsClient {
  create(params: Record<string, unknown>): Promise<InteractionResult>;
  get(interactionId: string): Promise<InteractionResult>;
}

/**
 * Safely access the interactions API from the GenAI client.
 * @throws {Error} If the SDK version doesn't support the Interactions API
 */
function getInteractionsClient(): InteractionsClient {
  const client = getGenAIClient();
  const interactions = (client as unknown as { interactions?: InteractionsClient }).interactions;
  if (!interactions) {
    throw new Error("Interactions API not available. Ensure @google/genai >= 2.3.0 is installed.");
  }
  return interactions;
}

/**
 * Creates a Deep Research interaction via Gemini Interactions API.
 */
export async function createResearchInteraction(options: {
  input: string;
  agent: string;
  collaborativePlanning: boolean;
  previousInteractionId?: string;
}): Promise<{ id: string; status: string; outputText?: string }> {
  const interactions = getInteractionsClient();

  const params: Record<string, unknown> = {
    input: options.input,
    agent: options.agent,
    background: true,
    agent_config: {
      type: "deep-research",
      collaborative_planning: options.collaborativePlanning,
    },
  };

  if (options.previousInteractionId) {
    params.previous_interaction_id = options.previousInteractionId;
  }

  const interaction = await interactions.create(params);
  return {
    id: interaction.id,
    status: interaction.status ?? "in_progress",
    outputText: interaction.output_text ?? undefined,
  };
}

/**
 * Gets the current status of a Deep Research interaction.
 */
export async function getResearchInteraction(interactionId: string): Promise<{
  id: string;
  status: string;
  outputText?: string;
  error?: string;
}> {
  const interactions = getInteractionsClient();
  const result = await interactions.get(interactionId);
  return {
    id: result.id,
    status: result.status ?? "in_progress",
    outputText: result.output_text ?? undefined,
    error: result.error ?? undefined,
  };
}

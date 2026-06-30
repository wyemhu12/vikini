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
  steps?: Array<Record<string, unknown>>;
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
  // SDK v2.4.0 does not export InteractionsClient type directly.
  // This double cast is required until the SDK exposes the type properly.
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
  thinkingText?: string;
  searchedSources?: Array<{ url: string; title: string; favicon?: string }>;
  reportSources?: Array<{ url: string; title: string }>;
  currentStep?: "searching" | "analyzing" | "writing";
}> {
  const interactions = getInteractionsClient();
  const result = await interactions.get(interactionId);

  let thinkingText = "";
  const sources: Array<{ url: string; title: string; favicon?: string }> = [];
  const reportSources: Array<{ url: string; title: string }> = [];

  let hasThought = false;
  let currentStep: "searching" | "analyzing" | "writing" = "analyzing";

  // Parse steps if available
  if (result.steps && Array.isArray(result.steps)) {
    for (const rawStep of result.steps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const step = rawStep as any; // Type-cast for easy parsing since SDK types are complex
      if (step.type === "thought") {
        hasThought = true;
        currentStep = "analyzing";
        if (Array.isArray(step.summary) && step.summary.length > 0) {
          for (const item of step.summary) {
            if (item.type === "text" && item.text) {
              thinkingText += item.text + "\n\n";
            }
          }
        } else {
          // Fallback if summary is empty but model is thinking
          thinkingText += "_Đang suy nghĩ..._\n\n";
        }
      } else if (step.type === "model_output" && Array.isArray(step.content)) {
        currentStep = "writing";
        // Extract annotations/citations from text content if available
        for (const content of step.content) {
          if (Array.isArray(content.parts)) {
            for (const part of content.parts) {
              if (Array.isArray(part.annotations)) {
                for (const annotation of part.annotations) {
                  if (annotation.type === "url_citation" && annotation.url) {
                    reportSources.push({
                      url: annotation.url,
                      title: annotation.title || annotation.url,
                    });
                  }
                }
              }
            }
          }
        }
      } else if (
        step.type === "google_search_call" &&
        step.arguments &&
        Array.isArray(step.arguments.queries)
      ) {
        hasThought = true;
        currentStep = "searching";
        // As a fallback, if we only get queries, we show them as sources
        for (const query of step.arguments.queries) {
          sources.push({
            url: `https://google.com/search?q=${encodeURIComponent(String(query))}`,
            title: String(query),
          });
        }
      }
    }
  }

  // Fallback for when the agent is starting up and hasn't emitted thoughts yet
  if (!hasThought && result.status === "in_progress") {
    thinkingText = "_Đang khởi tạo Agent, chuẩn bị môi trường nghiên cứu..._\n\n";
    currentStep = "searching";
  }

  // Deduplicate sources by URL
  const uniqueSources = sources.filter(
    (source, index, self) => index === self.findIndex((s) => s.url === source.url)
  );

  // Deduplicate reportSources by URL
  const uniqueReportSources = reportSources.filter(
    (source, index, self) => index === self.findIndex((s) => s.url === source.url)
  );

  return {
    id: result.id,
    status: result.status ?? "in_progress",
    outputText: result.output_text ?? undefined,
    error: result.error ?? undefined,
    thinkingText: thinkingText.trim() || undefined,
    searchedSources: uniqueSources.length > 0 ? uniqueSources : undefined,
    reportSources: uniqueReportSources.length > 0 ? uniqueReportSources : undefined,
    currentStep,
  };
}

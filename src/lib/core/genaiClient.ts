// /lib/core/genaiClient.ts
// Lazy, cached GoogleGenAI client (Node/server only)
// Validate environment variables on import
import "@/lib/env";

import { GoogleGenAI } from "@google/genai";
import { logger } from "@/lib/utils/logger";

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
 * Expanded interface for Interaction objects returned by the Interactions API.
 * Maps all currently-known fields from SDK v2.x responses.
 */
interface InteractionResult {
  id: string;
  status?: string;
  output_text?: string;
  error?: string;
  /** Ordered list of steps the agent executed (thought, google_search_call, model_output, etc.) */
  steps?: Array<Record<string, unknown>>;
  /** Additional metadata fields that may appear in future SDK versions */
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
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
 * Performs a runtime capability check instead of a blind double-cast,
 * so SDK internal restructuring fails loudly instead of silently.
 * @throws {Error} If the SDK version doesn't support the Interactions API
 */
function getInteractionsClient(): InteractionsClient {
  const client = getGenAIClient();
  // Access via string key to avoid TypeScript prototype chain issues with SDK types.
  // We then validate the shape at runtime rather than relying on compile-time casting.
  const maybeInteractions = (client as unknown as Record<string, unknown>)["interactions"];
  if (
    !maybeInteractions ||
    typeof (maybeInteractions as Record<string, unknown>)["create"] !== "function" ||
    typeof (maybeInteractions as Record<string, unknown>)["get"] !== "function"
  ) {
    throw new Error(
      "Interactions API not available or incompatible. " +
        "Ensure @google/genai ~2.10.0 is installed and provides interactions.create() / interactions.get()."
    );
  }
  return maybeInteractions as InteractionsClient;
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
    // Deep Research agents MUST run asynchronously. Per Google docs, background:true
    // REQUIRES store:true — omitting store causes the interaction to be rejected.
    background: true,
    store: true,
    agent_config: {
      type: "deep-research",
      collaborative_planning: options.collaborativePlanning,
    },
  };

  if (options.previousInteractionId) {
    params.previous_interaction_id = options.previousInteractionId;
  }

  try {
    const interaction = await interactions.create(params);
    return {
      id: interaction.id,
      status: interaction.status ?? "in_progress",
      outputText: interaction.output_text ?? undefined,
    };
  } catch (err: unknown) {
    // SDK errors (e.g. 403) often stringify to an empty body. Extract the richest
    // detail available so logs and the surfaced message are actionable.
    throw new Error(describeGenAIError(err, options.agent));
  }
}

/**
 * Builds an actionable error message from a GenAI SDK error.
 * The raw SDK error frequently stringifies to `403 API error occurred: {...empty...}`,
 * which hides the actual cause. This digs through common SDK error shapes and, for
 * known status codes, appends the most likely fix.
 */
function describeGenAIError(err: unknown, agent: string): string {
  const e = err as Record<string, unknown> | null;
  const status =
    (e?.["status"] as number | undefined) ??
    (e?.["code"] as number | undefined) ??
    (typeof e?.["message"] === "string" && /\b(\d{3})\b/.exec(e["message"] as string)
      ? Number(/\b(\d{3})\b/.exec(e["message"] as string)?.[1])
      : undefined);

  // Try to pull a nested message from various SDK error shapes
  const nested =
    (
      (e?.["response"] as Record<string, unknown> | undefined)?.["data"] as
        | Record<string, unknown>
        | undefined
    )?.["error"] ??
    (e?.["error"] as Record<string, unknown> | undefined) ??
    undefined;
  const nestedMessage =
    (nested as Record<string, unknown> | undefined)?.["message"] ??
    (typeof e?.["message"] === "string" ? e["message"] : undefined);

  const baseMessage =
    typeof nestedMessage === "string" && nestedMessage.trim()
      ? nestedMessage
      : "Unknown Gemini error";

  if (status === 403) {
    return (
      `403 Forbidden — the API key does not have access to the Deep Research agent "${agent}". ` +
      `This preview agent requires a Google AI project with billing enabled (pay-as-you-go); ` +
      `it is not available on the free tier. Verify GEMINI_API_KEY belongs to a paid project ` +
      `and that the Interactions API is enabled. (${baseMessage})`
    );
  }
  if (status === 404) {
    return (
      `404 Not Found — agent "${agent}" is not recognized. The preview model name may have ` +
      `changed or is unavailable in your region. (${baseMessage})`
    );
  }
  if (status === 429) {
    return `429 Rate limit exceeded for Deep Research. Try again later. (${baseMessage})`;
  }
  return baseMessage;
}

/**
 * Step types that echo the request rather than represent research progress.
 * The Interactions API emits a `user_input` step (the original query) which must
 * NOT be treated as active work — otherwise the catch-all sets currentStep to
 * "searching" and suppresses the "Initializing…" fallback, leaving the UI stuck
 * at "Searching the web / Processing: user_input" indefinitely.
 */
const PASSIVE_STEP_TYPES = new Set(["user_input", "input", "user_message"]);

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
  // Only set currentStep when there's actual activity — undefined means "not yet started"
  let currentStep: "searching" | "analyzing" | "writing" | undefined;

  // Parse steps if available
  if (result.steps && Array.isArray(result.steps)) {
    // Log the step types for debugging Deep Research "stuck" issues
    const stepTypes = result.steps.map((s) => (s as Record<string, unknown>)["type"]).join(", ");
    logger.info(
      `[getResearchInteraction] interactionId=${interactionId}, status=${result.status}, steps=${result.steps.length}, types=[${stepTypes}]`
    );

    for (const rawStep of result.steps) {
      const step = rawStep as Record<string, unknown>;
      const stepType = step["type"];

      if (stepType === "thought") {
        hasThought = true;
        currentStep = "analyzing";
        const summary = step["summary"];
        if (Array.isArray(summary) && summary.length > 0) {
          for (const item of summary as Array<Record<string, unknown>>) {
            if (item["type"] === "text" && typeof item["text"] === "string") {
              thinkingText += item["text"] + "\n\n";
            }
          }
        } else {
          // Fallback if summary is empty but model is thinking
          thinkingText += "_Thinking..._\n\n";
        }
      } else if (stepType === "model_output") {
        currentStep = "writing";
        const content = step["content"];
        if (Array.isArray(content)) {
          // Extract annotations/citations from text content if available
          for (const c of content as Array<Record<string, unknown>>) {
            const parts = c["parts"];
            if (Array.isArray(parts)) {
              for (const part of parts as Array<Record<string, unknown>>) {
                const annotations = part["annotations"];
                if (Array.isArray(annotations)) {
                  for (const annotation of annotations as Array<Record<string, unknown>>) {
                    if (
                      annotation["type"] === "url_citation" &&
                      typeof annotation["url"] === "string"
                    ) {
                      reportSources.push({
                        url: annotation["url"],
                        title:
                          typeof annotation["title"] === "string"
                            ? annotation["title"]
                            : annotation["url"],
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } else if (stepType === "google_search_call") {
        hasThought = true;
        currentStep = "searching";
        const args = step["arguments"] as Record<string, unknown> | undefined;
        if (args && Array.isArray(args["queries"])) {
          // Show search queries as interim sources so user sees search activity
          for (const query of args["queries"] as unknown[]) {
            sources.push({
              url: `https://google.com/search?q=${encodeURIComponent(String(query))}`,
              title: String(query),
            });
          }
        }
      } else if (typeof stepType === "string" && PASSIVE_STEP_TYPES.has(stepType)) {
        // Passive/echo steps (e.g. `user_input` echoing the query back) are NOT progress.
        // Skipping them lets the "Initializing…" fallback show instead of a false
        // "_Processing: user_input..._" that makes the agent look stuck before it starts.
        continue;
      } else if (stepType) {
        // Catch-all for genuinely unknown ACTIVE step types (e.g. tool_call, function_call
        // in future SDK versions). Treat as active progress to avoid false "stuck" UI.
        hasThought = true;
        if (!currentStep) currentStep = "searching";
        const actionName =
          (step["name"] as string | undefined) ||
          (step["functionName"] as string | undefined) ||
          String(stepType);
        thinkingText += `_Processing: ${actionName}..._\n\n`;
      }
    }
  }

  // Fallback for when the agent is starting up and hasn't emitted any steps yet.
  // Only add fallback text while the interaction is still running (not for terminal states).
  if (!hasThought && result.status === "in_progress") {
    thinkingText =
      "_Initializing research agent..._\n\n" +
      "_Note: Deep Research typically takes 3–10 minutes. The agent is working in the background — please wait._\n\n";
    // Leave currentStep as undefined so the progress card shows ALL steps as "pending" (gray).
    // Previously this was set to "analyzing" which falsely showed "Searching the web"
    // as completed (green checkmark) before the agent even started.
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

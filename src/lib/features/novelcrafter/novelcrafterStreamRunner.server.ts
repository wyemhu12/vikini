// /lib/features/novelcrafter/novelcrafterStreamRunner.server.ts
// Standalone multi-provider SSE stream runner for Novelcrafter Studio
// Calls singleton clients in src/lib/core/ directly without Chat side-effects

import { HarmBlockThreshold, HarmCategory, ThinkingLevel } from "@google/genai";
import { getGenAIClient } from "@/lib/core/genaiClient";
import { getClaudeClient } from "@/lib/core/claudeClient";
import { getDeepSeekClient } from "@/lib/core/deepseekClient";
import { getGroqClient } from "@/lib/core/groqClient";
import { getOpenRouterClient } from "@/lib/core/openRouterClient";
import {
  clampGeminiThinkingLevel,
  getModelMaxOutputTokens,
  isDeepSeekDirectModel,
  isGemini4Model,
  modelSupportsThinking,
  normalizeModelForApi,
  SELECTABLE_MODELS,
} from "@/lib/core/modelRegistry";
import { getGemsForUser } from "@/lib/features/gems/gems";
import { getPersonasForUser } from "@/lib/features/personas/personas";
import type { PersonaPromptInput } from "@/lib/features/personas/prompt-builder";
import { CLAUDE_API_MODELS, MODEL_IDS } from "@/lib/utils/constants";
import { sanitizeError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import type { PersonaTone } from "@/types/persona";
import {
  buildNovelcrafterSystemInstruction,
  buildNovelcrafterUserPrompt,
  resolveEffectivePersonaId,
} from "./promptBuilder";
import type {
  NovelcrafterFeatureSlot,
  NovelcrafterRoutingConfig,
  NovelcrafterStreamRequest,
} from "./types";

const streamLogger = logger.withContext("novelcrafterStreamRunner");

const VALID_PERSONA_TONES: ReadonlySet<string> = new Set([
  "default",
  "professional",
  "friendly",
  "candid",
  "quirky",
  "efficient",
  "cynical",
  "lawyer",
]);

function isValidPersonaTone(tone: string): tone is PersonaTone {
  return VALID_PERSONA_TONES.has(tone);
}

export type NovelcrafterSseEventType = "meta" | "thinking" | "token" | "done" | "error";

export function formatSseEvent(
  event: NovelcrafterSseEventType,
  data: Record<string, unknown>
): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

export interface ResolvedNovelcrafterRouting {
  systemInstruction: string;
  gemName: string | null;
  personaName: string | null;
}

export async function resolveNovelcrafterRouting(
  userId: string,
  feature: NovelcrafterFeatureSlot,
  routing: NovelcrafterRoutingConfig
): Promise<ResolvedNovelcrafterRouting> {
  let masterGemInstructions: string | null = null;
  let gemName: string | null = null;

  const masterGemId = routing.masterGemId?.trim();
  if (masterGemId) {
    try {
      const gems = await getGemsForUser(userId);
      const foundGem = gems.find((g) => g.id === masterGemId);
      if (foundGem) {
        gemName = typeof foundGem.name === "string" ? foundGem.name : null;
        masterGemInstructions =
          (typeof foundGem.instructions === "string" && foundGem.instructions) ||
          (typeof foundGem.instruction === "string" && foundGem.instruction) ||
          null;
      }
    } catch (err: unknown) {
      streamLogger.warn("Failed to load Master GEM, falling back to default:", err);
    }
  }

  let personaInput: PersonaPromptInput | null = null;
  let personaName: string | null = null;

  const effectivePersonaId = resolveEffectivePersonaId(feature, routing);
  if (effectivePersonaId) {
    try {
      const personas = await getPersonasForUser(userId);
      const foundPersona = personas.find((p) => p.id === effectivePersonaId);
      if (foundPersona) {
        personaName = foundPersona.name || null;
        personaInput = {
          tone: isValidPersonaTone(foundPersona.tone) ? foundPersona.tone : "default",
          useEmojis: foundPersona.use_emojis ?? true,
          useHeadersLists: foundPersona.use_headers_lists ?? true,
          userContext: foundPersona.user_context ?? "",
          customInstructions: foundPersona.custom_instructions ?? "",
        };
      }
    } catch (err: unknown) {
      streamLogger.warn("Failed to load Persona, falling back to null:", err);
    }
  }

  const systemInstruction = buildNovelcrafterSystemInstruction({
    masterGemInstructions,
    persona: personaInput,
  });

  return { systemInstruction, gemName, personaName };
}

export interface RunNovelcrafterStreamOptions {
  userId: string;
  request: NovelcrafterStreamRequest;
  signal?: AbortSignal;
  onFirstModelOutput?: () => void;
  onStreamComplete?: () => Promise<void> | void;
}

const GEMINI_SDK_THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const DEFAULT_NOVELCRAFTER_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

type EmitModelOutputFn = (type: "thinking" | "token", content: string) => void;

function normalizeFinishReason(raw?: string): "stop" | "length" | "safety" {
  const upper = (raw || "").toUpperCase();
  if (upper.includes("MAX_TOKENS") || upper.includes("LENGTH")) return "length";
  if (upper.includes("SAFETY") || upper.includes("BLOCK") || upper.includes("PROHIBITED")) {
    return "safety";
  }
  return "stop";
}

async function streamGeminiProvider(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  emitModelOutput: EmitModelOutputFn,
  signal?: AbortSignal
): Promise<"stop" | "length" | "safety"> {
  const client = getGenAIClient();
  const maxOutputTokens = getModelMaxOutputTokens(model);

  let thinkingConfig:
    | { thinkingLevel?: ThinkingLevel; thinkingBudget?: number; includeThoughts: boolean }
    | undefined;
  if (isGemini4Model(model)) {
    const clamped = clampGeminiThinkingLevel(model, "medium");
    thinkingConfig = {
      thinkingLevel: GEMINI_SDK_THINKING_LEVEL_MAP[clamped] || ThinkingLevel.MEDIUM,
      includeThoughts: true,
    };
  } else if (modelSupportsThinking(model) && model.startsWith("gemini-3")) {
    const clamped = clampGeminiThinkingLevel(model, "low");
    thinkingConfig = {
      thinkingLevel: GEMINI_SDK_THINKING_LEVEL_MAP[clamped] || ThinkingLevel.LOW,
      includeThoughts: true,
    };
  } else if (model.startsWith("gemini-2.5")) {
    thinkingConfig = {
      thinkingBudget: -1,
      includeThoughts: true,
    };
  }

  const responseStream = await client.models.generateContentStream({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      maxOutputTokens,
      thinkingConfig,
      safetySettings: DEFAULT_NOVELCRAFTER_SAFETY_SETTINGS,
      abortSignal: signal,
    },
  });

  let emittedTokenChunks = 0;
  let lastFinishReason: string | undefined;
  let lastBlockReason: string | undefined;

  for await (const chunk of responseStream) {
    if (signal?.aborted) break;

    const typedChunk = chunk as {
      text?: string;
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: unknown[] };
      }>;
    };

    if (typedChunk.promptFeedback?.blockReason) {
      lastBlockReason = String(typedChunk.promptFeedback.blockReason);
    }

    const candidate = typedChunk.candidates?.[0];
    if (candidate?.finishReason) {
      lastFinishReason = String(candidate.finishReason);
    }

    const parts = candidate?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      for (const rawPart of parts) {
        const part = rawPart as { text?: string; thought?: boolean };
        if (typeof part.text === "string" && part.text.length > 0) {
          if (part.thought) {
            emitModelOutput("thinking", part.text);
          } else {
            emittedTokenChunks += 1;
            emitModelOutput("token", part.text);
          }
        }
      }
    } else if (typeof typedChunk.text === "string" && typedChunk.text.length > 0) {
      emittedTokenChunks += 1;
      emitModelOutput("token", typedChunk.text);
    }
  }

  if (!signal?.aborted && emittedTokenChunks === 0) {
    const reasonDetail = lastBlockReason || lastFinishReason || "EMPTY_RESPONSE";
    throw new Error(
      `Model ${model} returned an empty response (reason: ${reasonDetail}). Please adjust the scene or switch models.`
    );
  }

  return normalizeFinishReason(lastBlockReason || lastFinishReason);
}

async function streamAnthropicProvider(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  emitModelOutput: EmitModelOutputFn,
  signal?: AbortSignal
): Promise<"stop" | "length" | "safety"> {
  const client = getClaudeClient();
  const anthropicMap = CLAUDE_API_MODELS.ANTHROPIC as Record<string, string>;
  const apiModel = anthropicMap[model] || model;

  const stream = await client.messages.create(
    {
      model: apiModel,
      max_tokens: 8192,
      system: systemInstruction,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    },
    { signal }
  );

  let emittedTokenChunks = 0;
  let lastStopReason: string | undefined;

  for await (const event of stream) {
    if (signal?.aborted) break;
    const ev = event as {
      type?: string;
      delta?: { type?: string; text?: string; thinking?: string; stop_reason?: string };
    };
    if (ev.delta?.stop_reason) {
      lastStopReason = String(ev.delta.stop_reason);
    }
    if (ev.type === "content_block_delta" && ev.delta) {
      if (ev.delta.type === "thinking_delta" && typeof ev.delta.thinking === "string") {
        emitModelOutput("thinking", ev.delta.thinking);
      } else if (ev.delta.type === "text_delta" && typeof ev.delta.text === "string") {
        if (ev.delta.text.length > 0) {
          emittedTokenChunks += 1;
          emitModelOutput("token", ev.delta.text);
        }
      }
    }
  }

  if (!signal?.aborted && emittedTokenChunks === 0) {
    throw new Error(
      `Model ${model} returned an empty response (reason: ${lastStopReason || "EMPTY_RESPONSE"}). Please adjust the scene or switch models.`
    );
  }

  return normalizeFinishReason(lastStopReason);
}

async function streamOpenAICompatibleProvider(
  providerId: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  emitModelOutput: EmitModelOutputFn,
  signal?: AbortSignal
): Promise<"stop" | "length" | "safety"> {
  const client = isDeepSeekDirectModel(model)
    ? getDeepSeekClient()
    : providerId === "groq"
      ? getGroqClient()
      : getOpenRouterClient();

  const stream = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    },
    { signal }
  );

  let emittedTokenChunks = 0;
  let lastFinishReason: string | undefined;

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const choice = (
      chunk as {
        choices?: Array<{
          finish_reason?: string | null;
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            reasoning?: string | null;
          };
        }>;
      }
    ).choices?.[0];
    if (choice?.finish_reason) {
      lastFinishReason = String(choice.finish_reason);
    }
    const delta = choice?.delta;
    if (!delta) continue;

    const reasoningText = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoningText === "string" && reasoningText.length > 0) {
      emitModelOutput("thinking", reasoningText);
    }
    if (typeof delta.content === "string" && delta.content.length > 0) {
      emittedTokenChunks += 1;
      emitModelOutput("token", delta.content);
    }
  }

  if (!signal?.aborted && emittedTokenChunks === 0) {
    throw new Error(
      `Model ${model} returned an empty response (reason: ${lastFinishReason || "EMPTY_RESPONSE"}). Please adjust the scene or switch models.`
    );
  }

  return normalizeFinishReason(lastFinishReason);
}

export function runNovelcrafterStream({
  userId,
  request,
  signal,
  onFirstModelOutput,
  onStreamComplete,
}: RunNovelcrafterStreamOptions): ReadableStream<Uint8Array> {
  const normalizedModel = normalizeModelForApi(request.model);
  const modelMeta = SELECTABLE_MODELS.find((m) => m.id === normalizedModel);
  const providerId = modelMeta?.providerId ?? "gemini";

  const openRouterMap = CLAUDE_API_MODELS.OPENROUTER as Record<string, string>;
  const routedModel =
    providerId === "anthropic" && !process.env.ANTHROPIC_API_KEY
      ? openRouterMap[normalizedModel] ||
        openRouterMap[MODEL_IDS.CLAUDE_HAIKU_45] ||
        normalizedModel
      : normalizedModel;

  const userPrompt = buildNovelcrafterUserPrompt(request);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let hasEmittedFirstOutput = false;
      const emitModelOutput: EmitModelOutputFn = (type, content) => {
        if (!content) return;
        if (type === "token" && !hasEmittedFirstOutput) {
          hasEmittedFirstOutput = true;
          try {
            onFirstModelOutput?.();
          } catch {
            // Ignore callback errors
          }
        }
        controller.enqueue(formatSseEvent(type, { t: content }));
      };

      try {
        if (signal?.aborted) {
          controller.close();
          return;
        }

        const { systemInstruction, gemName, personaName } = await resolveNovelcrafterRouting(
          userId,
          request.feature,
          request.routing
        );

        if (signal?.aborted) {
          controller.close();
          return;
        }

        controller.enqueue(
          formatSseEvent("meta", {
            model: normalizedModel,
            routedModel,
            gemName,
            personaName,
            feature: request.feature,
          })
        );

        let finishReason: "stop" | "length" | "safety" = "stop";

        if (providerId === "gemini") {
          finishReason = await streamGeminiProvider(
            normalizedModel,
            systemInstruction,
            userPrompt,
            emitModelOutput,
            signal
          );
        } else if (providerId === "anthropic") {
          if (process.env.ANTHROPIC_API_KEY) {
            finishReason = await streamAnthropicProvider(
              normalizedModel,
              systemInstruction,
              userPrompt,
              emitModelOutput,
              signal
            );
          } else {
            streamLogger.info(
              `ANTHROPIC_API_KEY not set. Routing Claude model "${normalizedModel}" via OpenRouter ("${routedModel}").`
            );
            finishReason = await streamOpenAICompatibleProvider(
              "openrouter-pay",
              routedModel,
              systemInstruction,
              userPrompt,
              emitModelOutput,
              signal
            );
          }
        } else {
          finishReason = await streamOpenAICompatibleProvider(
            providerId,
            normalizedModel,
            systemInstruction,
            userPrompt,
            emitModelOutput,
            signal
          );
        }

        if (!signal?.aborted) {
          controller.enqueue(
            formatSseEvent("done", {
              model: normalizedModel,
              routedModel,
              feature: request.feature,
              finishReason,
            })
          );
        }
      } catch (err: unknown) {
        if (!signal?.aborted) {
          const rawMsg = err instanceof Error ? err.message : "Failed to generate story content";
          streamLogger.error("Novelcrafter stream failed:", rawMsg);
          const safeMsg = sanitizeError(err, true);
          controller.enqueue(
            formatSseEvent("error", {
              message: safeMsg,
              code: "STREAM_ERROR",
            })
          );
        }
      } finally {
        try {
          await onStreamComplete?.();
        } catch (completeErr: unknown) {
          streamLogger.error("onStreamComplete failed:", completeErr);
        }
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      }
    },
  });
}

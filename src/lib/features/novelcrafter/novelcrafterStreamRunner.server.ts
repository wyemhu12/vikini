// /lib/features/novelcrafter/novelcrafterStreamRunner.server.ts
// Standalone multi-provider SSE stream runner for Novelcrafter Studio
// Calls singleton clients in src/lib/core/ directly without Chat side-effects

import { getGenAIClient } from "@/lib/core/genaiClient";
import { getClaudeClient } from "@/lib/core/claudeClient";
import { getDeepSeekClient } from "@/lib/core/deepseekClient";
import { getGroqClient } from "@/lib/core/groqClient";
import { getOpenRouterClient } from "@/lib/core/openRouterClient";
import {
  isDeepSeekDirectModel,
  normalizeModelForApi,
  SELECTABLE_MODELS,
} from "@/lib/core/modelRegistry";
import { getGemsForUser } from "@/lib/features/gems/gems";
import { getPersonasForUser } from "@/lib/features/personas/personas";
import type { PersonaPromptInput } from "@/lib/features/personas/prompt-builder";
import { CLAUDE_API_MODELS } from "@/lib/utils/constants";
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

/**
 * Load the user's Master GEM and effective Feature Persona from DB/cache
 * and build the Layered Mode systemInstruction.
 * Gracefully falls back to null if a referenced GEM or Persona was deleted.
 */
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

  return {
    systemInstruction,
    gemName,
    personaName,
  };
}

export interface RunNovelcrafterStreamOptions {
  userId: string;
  request: NovelcrafterStreamRequest;
  signal?: AbortSignal;
}

async function streamGeminiProvider(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal?: AbortSignal
): Promise<void> {
  const client = getGenAIClient();
  const responseStream = await client.models.generateContentStream({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      abortSignal: signal,
    },
  });

  for await (const chunk of responseStream) {
    if (signal?.aborted) break;

    const candidate = (chunk as { candidates?: Array<{ content?: { parts?: unknown[] } }> })
      .candidates?.[0];
    const parts = candidate?.content?.parts;

    if (Array.isArray(parts) && parts.length > 0) {
      for (const rawPart of parts) {
        const part = rawPart as { text?: string; thought?: boolean };
        if (typeof part.text === "string" && part.text.length > 0) {
          if (part.thought) {
            controller.enqueue(formatSseEvent("thinking", { t: part.text }));
          } else {
            controller.enqueue(formatSseEvent("token", { t: part.text }));
          }
        }
      }
    } else {
      const directText = (chunk as { text?: string }).text;
      if (typeof directText === "string" && directText.length > 0) {
        controller.enqueue(formatSseEvent("token", { t: directText }));
      }
    }
  }
}

async function streamAnthropicProvider(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal?: AbortSignal
): Promise<void> {
  const client = getClaudeClient();
  const anthropicMap = CLAUDE_API_MODELS.ANTHROPIC as Record<string, string>;
  const apiModel = anthropicMap[model] || model;

  const stream = await client.messages.create({
    model: apiModel,
    max_tokens: 8192,
    system: systemInstruction,
    messages: [{ role: "user", content: userPrompt }],
    stream: true,
  });

  for await (const event of stream) {
    if (signal?.aborted) break;
    const ev = event as {
      type?: string;
      delta?: { type?: string; text?: string; thinking?: string };
    };
    if (ev.type === "content_block_delta" && ev.delta) {
      if (ev.delta.type === "thinking_delta" && typeof ev.delta.thinking === "string") {
        controller.enqueue(formatSseEvent("thinking", { t: ev.delta.thinking }));
      } else if (ev.delta.type === "text_delta" && typeof ev.delta.text === "string") {
        controller.enqueue(formatSseEvent("token", { t: ev.delta.text }));
      }
    }
  }
}

async function streamOpenAICompatibleProvider(
  providerId: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal?: AbortSignal
): Promise<void> {
  const client = isDeepSeekDirectModel(model)
    ? getDeepSeekClient()
    : providerId === "groq"
      ? getGroqClient()
      : getOpenRouterClient();

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const choice = (
      chunk as {
        choices?: Array<{
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            reasoning?: string | null;
          };
        }>;
      }
    ).choices?.[0];
    const delta = choice?.delta;
    if (!delta) continue;

    const reasoningText = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoningText === "string" && reasoningText.length > 0) {
      controller.enqueue(formatSseEvent("thinking", { t: reasoningText }));
    }
    if (typeof delta.content === "string" && delta.content.length > 0) {
      controller.enqueue(formatSseEvent("token", { t: delta.content }));
    }
  }
}

/**
 * Create a standalone SSE ReadableStream for Novelcrafter Studio.
 * Does NOT write chat messages or overwrite conversation titles.
 */
export function runNovelcrafterStream({
  userId,
  request,
  signal,
}: RunNovelcrafterStreamOptions): ReadableStream<Uint8Array> {
  const normalizedModel = normalizeModelForApi(request.model);
  const modelMeta = SELECTABLE_MODELS.find((m) => m.id === normalizedModel);
  const providerId = modelMeta?.providerId ?? "gemini";

  const userPrompt = buildNovelcrafterUserPrompt({
    feature: request.feature,
    storyBible: request.storyBible,
    chapterTitle: request.chapterTitle,
    chapterScenes: request.chapterScenes,
    chapterProse: request.chapterProse,
    previousChapterProseTail: request.previousChapterProseTail,
    selectedText: request.selectedText,
    bibleTarget: request.bibleTarget,
    actionMode: request.actionMode,
    writeMode: request.writeMode,
    rewriteMode: request.rewriteMode,
    expandMode: request.expandMode,
    describeSenses: request.describeSenses,
    brainstormCategory: request.brainstormCategory,
    customInstruction: request.customInstruction,
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
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
            gemName,
            personaName,
            feature: request.feature,
          })
        );

        if (providerId === "gemini") {
          await streamGeminiProvider(
            normalizedModel,
            systemInstruction,
            userPrompt,
            controller,
            signal
          );
        } else if (providerId === "anthropic") {
          await streamAnthropicProvider(
            normalizedModel,
            systemInstruction,
            userPrompt,
            controller,
            signal
          );
        } else {
          await streamOpenAICompatibleProvider(
            providerId,
            normalizedModel,
            systemInstruction,
            userPrompt,
            controller,
            signal
          );
        }

        if (!signal?.aborted) {
          controller.enqueue(
            formatSseEvent("done", {
              model: normalizedModel,
              feature: request.feature,
            })
          );
        }
      } catch (err: unknown) {
        if (!signal?.aborted) {
          const rawMsg = err instanceof Error ? err.message : "Failed to generate story content";
          streamLogger.error("Novelcrafter stream failed:", rawMsg);
          controller.enqueue(
            formatSseEvent("error", {
              message: rawMsg,
              code: "STREAM_ERROR",
            })
          );
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      }
    },
  });
}

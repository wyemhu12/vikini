// /lib/features/novelcrafter/novelcrafterStrataProvider.server.ts
// Local Strata LLM provider adapter for Novelcrafter Studio SSE stream runner

import type OpenAI from "openai";
import { countStrataPromptTokens, getStrataClient } from "@/lib/core/strataClient";
import { getStrataConfig, type StrataConfig } from "@/lib/core/strataConfig";
import { getStrataQueue, type StrataQueue } from "@/lib/core/strataQueue";
import { StrataDisabledError, StrataOfflineError } from "@/lib/features/local-llm/errors";
import { fitStrataPrompt } from "@/lib/features/local-llm/strataContextFit";
import {
  buildStrataRequestBody,
  resolveStrataThinkingPlan,
  type StrataChatMessage,
  type StrataChatRequestBody,
  type StrataSamplingInput,
  type StrataThinkingLevel,
  type StrataThinkingPlan,
} from "@/lib/features/local-llm/strataThinking";
import {
  consumeOpenAICompatibleChunks,
  type EmitModelOutputFn,
} from "./novelcrafterStreamRunner.server";

export const NOVELCRAFTER_STRATA_THINKING_LEVEL: StrataThinkingLevel = "low";
export const NOVELCRAFTER_STRATA_SAMPLING: StrataSamplingInput = { mode: "creative" };

export interface StrataProviderDeps {
  getConfig: () => StrataConfig;
  getQueue: () => StrataQueue;
  getClient: () => OpenAI;
  countTokens: (
    messages: StrataChatMessage[],
    options: { plan: StrataThinkingPlan; signal?: AbortSignal }
  ) => Promise<number>;
}

export interface StreamStrataProviderParams {
  systemInstruction: string;
  userPrompt: string;
  emitModelOutput: EmitModelOutputFn;
  signal?: AbortSignal;
  deps?: Partial<StrataProviderDeps>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOfflineConnectionError(err: unknown): boolean {
  const rawMessage =
    err instanceof Error
      ? err.message
      : isRecord(err) && typeof err.message === "string"
        ? err.message
        : "";
  const codeProp = isRecord(err) && typeof err.code === "string" ? err.code : "";
  const causeCode =
    isRecord(err) && isRecord(err.cause) && typeof err.cause.code === "string"
      ? err.cause.code
      : "";
  const lowerMsg = rawMessage.toLowerCase();

  return (
    codeProp === "ECONNREFUSED" ||
    causeCode === "ECONNREFUSED" ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("connection error")
  );
}

async function createStreamOrThrowOffline(
  client: OpenAI,
  requestBody: StrataChatRequestBody,
  signal?: AbortSignal
): Promise<AsyncIterable<unknown>> {
  try {
    const stream = await client.chat.completions.create(
      requestBody as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      { signal }
    );
    return stream as AsyncIterable<unknown>;
  } catch (err: unknown) {
    if (isOfflineConnectionError(err)) {
      throw new StrataOfflineError("Local Strata server is offline");
    }
    throw err;
  }
}

export async function streamStrataProvider(
  params: StreamStrataProviderParams
): Promise<"stop" | "length" | "safety"> {
  const getConfig = params.deps?.getConfig ?? getStrataConfig;
  const getQueue = params.deps?.getQueue ?? getStrataQueue;
  const getClient = params.deps?.getClient ?? getStrataClient;
  const countTokens = params.deps?.countTokens ?? countStrataPromptTokens;

  const cfg = getConfig();
  if (!cfg.enabled) {
    throw new StrataDisabledError();
  }

  const queue = getQueue();
  const release = await queue.acquire({
    signal: params.signal,
    maxWaitMs: cfg.queueMaxWaitMs,
  });

  try {
    const plan = resolveStrataThinkingPlan(NOVELCRAFTER_STRATA_THINKING_LEVEL, cfg.contextWindow);
    const fit = await fitStrataPrompt({
      systemPrompt: params.systemInstruction,
      contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
      promptBudgetTokens: plan.promptBudgetTokens,
      countTokens: (msgs) => countTokens(msgs, { plan, signal: params.signal }),
    });

    const requestBody = buildStrataRequestBody({
      apiModel: cfg.modelId,
      messages: fit.messages,
      plan,
      samplingConfig: NOVELCRAFTER_STRATA_SAMPLING,
    });

    const client = getClient();
    const stream = await createStreamOrThrowOffline(client, requestBody, params.signal);

    return await consumeOpenAICompatibleChunks(
      stream,
      params.emitModelOutput,
      "strata-local",
      params.signal
    );
  } finally {
    release();
  }
}

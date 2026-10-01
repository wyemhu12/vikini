// src/app/api/chat-stream/streaming/deepseek-request-builder.ts
import type OpenAI from "openai";
import {
  isDeepSeekV4ProModel,
  isDeepSeekV41FlashModel,
  getModelMaxOutputTokens,
} from "@/lib/core/modelRegistry";

export type DeepSeekEffort = "high" | "max" | "low" | "xhigh" | "none";

export interface DeepSeekStreamRequestBody extends Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  "reasoning_effort"
> {
  provider?: {
    order?: string[];
    allow_fallbacks?: boolean;
  };
  include_reasoning?: boolean;
  reasoning?: {
    effort: DeepSeekEffort;
  };
  reasoning_effort?: DeepSeekEffort | null;
  thinking?: {
    type: "enabled" | "disabled";
  };
}

export interface DeepSeekEffortMapping {
  reasoningEffort: DeepSeekEffort;
  isThinkingEnabled: boolean;
  effectiveSysPromptPrefix: string;
}

export function mapDeepSeekEffort(
  model: string,
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal"
): DeepSeekEffortMapping {
  const isThinkingEnabled = thinkingLevel !== "off";

  let reasoningEffort: DeepSeekEffort;
  let effectiveSysPromptPrefix = "";

  if (isDeepSeekV41FlashModel(model)) {
    if (!isThinkingEnabled) {
      reasoningEffort = "none";
    } else if (thinkingLevel === "high") {
      reasoningEffort = "high";
    } else if (thinkingLevel === "low") {
      reasoningEffort = "low";
    } else {
      // "medium", "minimal", undefined -> map to "low"
      reasoningEffort = "low";
    }
  } else if (isDeepSeekV4ProModel(model)) {
    if (!isThinkingEnabled) {
      reasoningEffort = "none";
    } else if (thinkingLevel === "high") {
      reasoningEffort = "xhigh";
    } else if (thinkingLevel === "low") {
      reasoningEffort = "high";
    } else {
      // "medium", "minimal", undefined -> map to "high"
      reasoningEffort = "high";
    }
  } else {
    // Direct DeepSeek API
    if (!isThinkingEnabled) {
      reasoningEffort = "none";
    } else if (thinkingLevel === "high") {
      reasoningEffort = "max";
    } else {
      // "low", "medium", "minimal", undefined -> map to "high"
      reasoningEffort = "high";
    }

    if (reasoningEffort === "max" && isThinkingEnabled) {
      effectiveSysPromptPrefix =
        "Reasoning Effort: High depth deliberation.\n" +
        "Be thorough and rigorous in your analysis: decompose the problem, address the root cause, " +
        "and verify logic against relevant edge cases.\n" +
        "Maintain focused deliberation and proceed directly to producing a complete, high-quality final response without redundant looping.\n\n";
    }
  }

  return {
    reasoningEffort,
    isThinkingEnabled,
    effectiveSysPromptPrefix,
  };
}

export function buildDeepSeekRequestBody(params: {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
  modelMeta?: { maxOutputTokens?: number };
}): DeepSeekStreamRequestBody {
  const { model, messages, thinkingLevel, modelMeta } = params;
  const { reasoningEffort, isThinkingEnabled } = mapDeepSeekEffort(model, thinkingLevel);
  const isOpenRouterRoute = isDeepSeekV4ProModel(model) || isDeepSeekV41FlashModel(model);

  const registeredMaxOutput = getModelMaxOutputTokens(model);
  const effectiveMaxTokens = Math.max(
    registeredMaxOutput || modelMeta?.maxOutputTokens || 8192,
    isThinkingEnabled ? 16384 : 8192
  );

  const requestBody: DeepSeekStreamRequestBody = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: effectiveMaxTokens,
  };

  // Provider routing for OpenRouter DeepSeek models
  if (isDeepSeekV41FlashModel(model)) {
    requestBody.provider = {
      order: ["Relace", "Together", "Novita", "DeepSeek"],
      allow_fallbacks: true,
    };
  } else if (isDeepSeekV4ProModel(model)) {
    requestBody.provider = {
      order: ["StreamLake"],
      allow_fallbacks: true,
    };
  }

  // Thinking configuration
  if (isThinkingEnabled) {
    if (isOpenRouterRoute) {
      requestBody.include_reasoning = true;
      requestBody.reasoning = { effort: reasoningEffort };
    } else {
      requestBody.thinking = { type: "enabled" };
    }
    requestBody.reasoning_effort = reasoningEffort;
  } else {
    if (isOpenRouterRoute) {
      requestBody.include_reasoning = false;
      requestBody.reasoning = { effort: "none" };
      requestBody.reasoning_effort = "none";
    } else {
      requestBody.thinking = { type: "disabled" };
      requestBody.reasoning_effort = null;
    }
    requestBody.temperature = 0.7;
  }

  return requestBody;
}

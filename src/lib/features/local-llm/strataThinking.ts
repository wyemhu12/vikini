import { STRATA_DEFAULTS } from "@/lib/utils/constants";
import { AppError } from "@/lib/utils/errors";

export type StrataThinkingLevel = "off" | "low" | "medium" | "high";
export type StrataReasoningEffort = "none" | "low" | "medium" | "high";
export type StrataSamplingMode = "default" | "creative" | "custom";

export interface StrataSamplingInput {
  mode?: StrataSamplingMode;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  presence_penalty?: number;
}

export interface StrataSamplingValues {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  presence_penalty: number;
}

export interface StrataPlanSampling {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p?: number;
  presence_penalty?: number;
}

export interface StrataThinkingPlan {
  level: StrataThinkingLevel;
  thinking: boolean;
  reasoningEffort: StrataReasoningEffort;
  reasoningBudgetTokens: number;
  answerReserveTokens: number;
  maxTokens: number;
  promptBudgetTokens: number;
  sampling: StrataPlanSampling;
}

export interface StrataChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StrataChatRequestBody {
  model: string;
  messages: StrataChatMessage[];
  stream: true;
  max_tokens: number;
  reasoning_effort: StrataReasoningEffort;
  reasoning_budget_tokens?: number;
  temperature: number;
  top_p: number;
  top_k: number;
  min_p?: number;
  presence_penalty?: number;
  return_progress: true;
}

interface ThinkingTableEntry {
  thinking: boolean;
  reasoningEffort: StrataReasoningEffort;
  reasoningBudgetTokens: number;
  answerReserveTokens: number;
  maxTokens: number;
  sampling: StrataPlanSampling;
}

export const STRATA_SAMPLING_PRESETS: Record<
  "default" | "creative",
  { thinkingOff: StrataSamplingValues; thinkingOn: StrataSamplingValues }
> = {
  default: {
    thinkingOff: {
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      min_p: 0,
      presence_penalty: 1.5,
    },
    thinkingOn: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
      presence_penalty: 0,
    },
  },
  creative: {
    thinkingOff: {
      temperature: 0.85,
      top_p: 0.92,
      top_k: 30,
      min_p: 0.05,
      presence_penalty: 0.6,
    },
    thinkingOn: {
      temperature: 0.95,
      top_p: 0.95,
      top_k: 25,
      min_p: 0.03,
      presence_penalty: 0.2,
    },
  },
};

export const STRATA_THINKING_TABLE: Record<StrataThinkingLevel, ThinkingTableEntry> = {
  off: {
    thinking: false,
    reasoningEffort: "none",
    reasoningBudgetTokens: 0,
    answerReserveTokens: 4096,
    maxTokens: 4096,
    sampling: {
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
    },
  },
  low: {
    thinking: true,
    reasoningEffort: "low",
    reasoningBudgetTokens: 4096,
    answerReserveTokens: 2048,
    maxTokens: 6144,
    sampling: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
    },
  },
  medium: {
    thinking: true,
    reasoningEffort: "medium",
    reasoningBudgetTokens: 8192,
    answerReserveTokens: 3072,
    maxTokens: 11264,
    sampling: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
    },
  },
  high: {
    thinking: true,
    reasoningEffort: "high",
    reasoningBudgetTokens: 12288,
    answerReserveTokens: 4096,
    maxTokens: 16384,
    sampling: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
    },
  },
};

function normalizeStrataThinkingLevel(level: unknown): StrataThinkingLevel {
  if (level === "minimal" || level === "low") return "low";
  if (level === "medium") return "medium";
  if (level === "high") return "high";
  return "off";
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps user-provided sampling parameters into Strata's valid ranges (`server.py:7917`).
 */
export function sanitizeStrataSampling(
  input?: StrataSamplingInput,
  thinking: boolean = false
): StrataSamplingValues {
  const base = thinking
    ? STRATA_SAMPLING_PRESETS.default.thinkingOn
    : STRATA_SAMPLING_PRESETS.default.thinkingOff;

  return {
    temperature: clampNumber(input?.temperature, base.temperature, 0, 2),
    top_p: clampNumber(input?.top_p, base.top_p, 0.05, 1),
    top_k: Math.round(clampNumber(input?.top_k, base.top_k, 0, 64)),
    min_p: clampNumber(input?.min_p, base.min_p, 0, 0.5),
    presence_penalty: clampNumber(input?.presence_penalty, base.presence_penalty, 0, 2),
  };
}

/**
 * Resolves the token budget and default sampling plan for a given UI thinking level.
 */
export function resolveStrataThinkingPlan(
  level?: unknown,
  contextWindow: number = STRATA_DEFAULTS.CONTEXT_WINDOW
): StrataThinkingPlan {
  const normalizedLevel = normalizeStrataThinkingLevel(level);
  const entry = STRATA_THINKING_TABLE[normalizedLevel];

  // Verify Strata rule #984 reserve invariant (`serve/server.py:5022-5029`)
  const requiredReserve = Math.min(
    Math.max(512, Math.floor(entry.maxTokens / 4)),
    Math.floor(entry.maxTokens / 2)
  );
  if (entry.answerReserveTokens < requiredReserve) {
    throw new AppError("Strata answer reserve violates rule #984 invariant", 500, "CONFIG_ERROR");
  }

  const promptBudgetTokens =
    contextWindow -
    STRATA_DEFAULTS.CTX_SLACK -
    entry.maxTokens -
    STRATA_DEFAULTS.PROMPT_SAFETY_TOKENS;

  if (promptBudgetTokens <= 1024) {
    throw new AppError("Strata context window too small for thinking level", 500, "CONFIG_ERROR");
  }

  return {
    level: normalizedLevel,
    thinking: entry.thinking,
    reasoningEffort: entry.reasoningEffort,
    reasoningBudgetTokens: entry.reasoningBudgetTokens,
    answerReserveTokens: entry.answerReserveTokens,
    maxTokens: entry.maxTokens,
    promptBudgetTokens,
    sampling: { ...entry.sampling },
  };
}

export interface BuildStrataRequestBodyParams {
  apiModel: string;
  messages: StrataChatMessage[];
  plan: StrataThinkingPlan;
  samplingConfig?: StrataSamplingInput;
}

/**
 * Builds the OpenAI `/v1/chat/completions` request payload for Strata.
 */
export function buildStrataRequestBody({
  apiModel,
  messages,
  plan,
  samplingConfig,
}: BuildStrataRequestBodyParams): StrataChatRequestBody {
  const mode: StrataSamplingMode = samplingConfig?.mode ?? "default";

  const baseBody: StrataChatRequestBody = {
    model: apiModel,
    messages,
    stream: true,
    max_tokens: plan.maxTokens,
    reasoning_effort: plan.reasoningEffort,
    ...(plan.thinking && plan.reasoningBudgetTokens > 0
      ? { reasoning_budget_tokens: plan.reasoningBudgetTokens }
      : {}),
    temperature: plan.sampling.temperature,
    top_p: plan.sampling.top_p,
    top_k: plan.sampling.top_k,
    ...(typeof plan.sampling.min_p === "number" ? { min_p: plan.sampling.min_p } : {}),
    return_progress: true,
  };

  if (mode === "creative") {
    const preset = plan.thinking
      ? STRATA_SAMPLING_PRESETS.creative.thinkingOn
      : STRATA_SAMPLING_PRESETS.creative.thinkingOff;
    return {
      ...baseBody,
      temperature: preset.temperature,
      top_p: preset.top_p,
      top_k: preset.top_k,
      min_p: preset.min_p,
      presence_penalty: preset.presence_penalty,
    };
  }

  if (mode === "custom") {
    const sanitized = sanitizeStrataSampling(samplingConfig, plan.thinking);
    return {
      ...baseBody,
      temperature: sanitized.temperature,
      top_p: sanitized.top_p,
      top_k: sanitized.top_k,
      min_p: sanitized.min_p,
      presence_penalty: sanitized.presence_penalty,
    };
  }

  return baseBody;
}

import OpenAI from "openai";
import { STRATA_DEFAULTS } from "@/lib/utils/constants";
import { getStrataConfig } from "./strataConfig";
import type {
  StrataChatMessage,
  StrataThinkingPlan,
} from "@/lib/features/local-llm/strataThinking";

export interface StrataHealthCheckResult {
  online: boolean;
  loaded: boolean;
  model: string | null;
  maxContext: number | null;
}

export interface StrataCountTokensRequestBody {
  model: string;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  thinking: { type: "disabled" } | { type: "enabled"; budget_tokens: number };
  output_config?: { effort: "low" | "medium" | "high" };
}

interface CachedClientEntry {
  key: string;
  client: OpenAI;
}

interface CachedHealthEntry {
  expiresAt: number;
  origin: string;
  result: StrataHealthCheckResult;
}

let cachedClientEntry: CachedClientEntry | null = null;
let cachedHealthEntry: CachedHealthEntry | null = null;
let inflightHealthPromise: Promise<StrataHealthCheckResult> | null = null;

/**
 * Returns an OpenAI SDK client configured for the local Strata server with `maxRetries: 0`.
 */
export function getStrataClient(env: NodeJS.ProcessEnv = process.env): OpenAI {
  const cfg = getStrataConfig(env);
  const key = `${cfg.baseUrl}|${cfg.apiKey}|${cfg.requestTimeoutMs}`;

  if (cachedClientEntry && cachedClientEntry.key === key) {
    return cachedClientEntry.client;
  }

  const client = new OpenAI({
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey || "strata-local",
    maxRetries: 0,
    timeout: cfg.requestTimeoutMs,
  });

  cachedClientEntry = { key, client };
  return client;
}

export function resetStrataClientCacheForTests(): void {
  cachedClientEntry = null;
  cachedHealthEntry = null;
  inflightHealthPromise = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function combineSignals(userSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!userSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, timeoutSignal]);
  }
  return userSignal.aborted ? userSignal : timeoutSignal;
}

/**
 * Queries Strata's `GET /health` endpoint with a 5-second cache and in-flight deduplication.
 * Never throws; returns `online: false` if the server is unreachable.
 */
export async function checkStrataHealth(options?: {
  forceRefresh?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<StrataHealthCheckResult> {
  let healthUrl: string;
  let origin: string;
  try {
    const cfg = getStrataConfig(options?.env ?? process.env);
    healthUrl = cfg.healthUrl;
    origin = cfg.origin;
  } catch {
    return { online: false, loaded: false, model: null, maxContext: null };
  }

  const now = Date.now();
  if (
    !options?.forceRefresh &&
    cachedHealthEntry &&
    cachedHealthEntry.origin === origin &&
    cachedHealthEntry.expiresAt > now
  ) {
    return cachedHealthEntry.result;
  }

  if (!options?.forceRefresh && inflightHealthPromise) {
    return inflightHealthPromise;
  }

  const runFetch = async (): Promise<StrataHealthCheckResult> => {
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(STRATA_DEFAULTS.HEALTH_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        return { online: false, loaded: false, model: null, maxContext: null };
      }

      const raw: unknown = await response.json();
      if (!isRecord(raw) || raw.status !== "ok") {
        return { online: false, loaded: false, model: null, maxContext: null };
      }

      const result: StrataHealthCheckResult = {
        online: true,
        loaded: raw.loaded === true,
        model: typeof raw.model === "string" ? raw.model : null,
        maxContext:
          typeof raw.max_context === "number" && Number.isFinite(raw.max_context)
            ? raw.max_context
            : null,
      };

      cachedHealthEntry = {
        origin,
        expiresAt: Date.now() + STRATA_DEFAULTS.HEALTH_CACHE_TTL_MS,
        result,
      };
      return result;
    } catch {
      const offlineResult: StrataHealthCheckResult = {
        online: false,
        loaded: false,
        model: null,
        maxContext: null,
      };
      return offlineResult;
    } finally {
      inflightHealthPromise = null;
    }
  };

  inflightHealthPromise = runFetch();
  return inflightHealthPromise;
}

/**
 * Calls Strata's `POST /v1/messages/count_tokens` with exact Jinja template parity (`m-1`).
 */
export async function countStrataPromptTokens(
  messages: StrataChatMessage[],
  options: {
    plan: StrataThinkingPlan;
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
  }
): Promise<number> {
  const cfg = getStrataConfig(options.env ?? process.env);
  const systemParts: string[] = [];
  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content.trim()) {
        systemParts.push(msg.content);
      }
    } else {
      chatMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const systemText = systemParts.join("\n\n").trim();
  const plan = options.plan;
  const effort =
    plan.reasoningEffort === "low" ||
    plan.reasoningEffort === "medium" ||
    plan.reasoningEffort === "high"
      ? plan.reasoningEffort
      : "low";

  const body: StrataCountTokensRequestBody =
    plan.thinking && plan.reasoningBudgetTokens > 0
      ? {
          model: cfg.modelId,
          ...(systemText ? { system: systemText } : {}),
          messages: chatMessages,
          thinking: {
            type: "enabled",
            budget_tokens: plan.reasoningBudgetTokens,
          },
          output_config: {
            effort,
          },
        }
      : {
          model: cfg.modelId,
          ...(systemText ? { system: systemText } : {}),
          messages: chatMessages,
          thinking: {
            type: "disabled",
          },
        };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) {
    headers["x-api-key"] = cfg.apiKey;
  }

  const response = await fetch(cfg.countTokensUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: combineSignals(options.signal, STRATA_DEFAULTS.COUNT_TOKENS_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strata count_tokens failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    typeof data.input_tokens !== "number" ||
    !Number.isFinite(data.input_tokens)
  ) {
    throw new Error("Invalid input_tokens response from Strata");
  }

  return data.input_tokens;
}

import { STRATA_DEFAULTS } from "@/lib/utils/constants";
import { AppError } from "@/lib/utils/errors";

export interface StrataConfig {
  enabled: boolean;
  baseUrl: string;
  origin: string;
  healthUrl: string;
  countTokensUrl: string;
  modelId: string;
  apiKey: string;
  contextWindow: number;
  requestTimeoutMs: number;
  idleTimeoutMs: number;
  queueMaxPending: number;
  queueMaxWaitMs: number;
  allowRemote: boolean;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function validateAndParseBaseUrl(
  rawUrl: string,
  allowRemote: boolean
): {
  baseUrl: string;
  origin: string;
  healthUrl: string;
  countTokensUrl: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("Invalid STRATA_BASE_URL", 500, "CONFIG_ERROR");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("Invalid STRATA_BASE_URL", 500, "CONFIG_ERROR");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!allowRemote && !LOOPBACK_HOSTS.has(hostname)) {
    throw new AppError("Invalid STRATA_BASE_URL", 500, "CONFIG_ERROR");
  }

  const normalizedBase = rawUrl.trim().replace(/\/+$/, "");
  const origin = parsed.origin;
  const healthUrl = `${origin}/health`;
  const countTokensUrl = `${normalizedBase}/messages/count_tokens`;

  return {
    baseUrl: normalizedBase,
    origin,
    healthUrl,
    countTokensUrl,
  };
}

/**
 * Reads and validates runtime configuration for the local Strata inference server.
 */
export function getStrataConfig(env: NodeJS.ProcessEnv = process.env): StrataConfig {
  const enabled = env.STRATA_ENABLED?.trim() === "true";
  const allowRemote = env.STRATA_ALLOW_REMOTE?.trim() === "true";
  const rawBaseUrl = env.STRATA_BASE_URL?.trim() || STRATA_DEFAULTS.BASE_URL;

  const { baseUrl, origin, healthUrl, countTokensUrl } = validateAndParseBaseUrl(
    rawBaseUrl,
    allowRemote
  );

  const modelId = env.STRATA_MODEL_ID?.trim() || STRATA_DEFAULTS.MODEL_ID;
  const apiKey = env.STRATA_API_KEY?.trim() || "";
  const contextWindow = parsePositiveInt(env.STRATA_CONTEXT_WINDOW, STRATA_DEFAULTS.CONTEXT_WINDOW);
  const requestTimeoutMs = parsePositiveInt(
    env.STRATA_REQUEST_TIMEOUT_MS,
    STRATA_DEFAULTS.REQUEST_TIMEOUT_MS
  );
  const idleTimeoutMs = parsePositiveInt(
    env.STRATA_IDLE_TIMEOUT_MS,
    STRATA_DEFAULTS.IDLE_TIMEOUT_MS
  );
  const queueMaxPending = parseNonNegativeInt(
    env.STRATA_QUEUE_MAX_PENDING,
    STRATA_DEFAULTS.QUEUE_MAX_PENDING
  );
  const queueMaxWaitMs = parsePositiveInt(
    env.STRATA_QUEUE_MAX_WAIT_MS,
    STRATA_DEFAULTS.QUEUE_MAX_WAIT_MS
  );

  return {
    enabled,
    baseUrl,
    origin,
    healthUrl,
    countTokensUrl,
    modelId,
    apiKey,
    contextWindow,
    requestTimeoutMs,
    idleTimeoutMs,
    queueMaxPending,
    queueMaxWaitMs,
    allowRemote,
  };
}

export function isStrataEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STRATA_ENABLED?.trim() === "true";
}

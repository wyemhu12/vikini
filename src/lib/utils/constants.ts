// Centralized constants for the application
// This file contains magic strings and numbers used throughout the codebase

/**
 * Message roles
 */
export const MESSAGE_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;

export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];

/**
 * Model identifiers (avoid magic strings)
 */
export const MODEL_IDS = {
  IMAGE_STUDIO: "vikini-image-studio",
  NOVELCRAFTER: "vikini-novelcrafter",
  USER_TEMPLATES_STORE: "user_templates_store",
  // Gemini 4 models
  GEMINI_4_HYDROGEN: "gemini-4-hydrogen",
  GEMINI_4_NEON: "gemini-4-neon",
  // Claude 5.5 models
  CLAUDE_SONNET_55: "claude-sonnet-5-5",
  CLAUDE_HAIKU_55: "claude-haiku-5-5",
  // DeepSeek models (all via OpenRouter)
  DEEPSEEK_V4_PRO: "deepseek/deepseek-v4-pro",
  DEEPSEEK_V41_FLASH: "deepseek/deepseek-v4.1-flash",
  DEEPSEEK_V32: "deepseek/deepseek-v3.2:floor",
  // Grok (via OpenRouter)
  GROK_47: "x-ai/grok-4.7",
  // Z.ai / GLM models (via OpenRouter)
  GLM_52: "z-ai/glm-5.2",
  // Groq (Free Tier)
  GROQ_GPT_OSS_120B: "openai/gpt-oss-120b",
  // Local LLM (Strata Engine)
  STRATA_LOCAL: "strata-local",
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

/**
 * Claude model mapping to API formats
 */
export const CLAUDE_API_MODELS = {
  // OpenRouter format
  OPENROUTER: {
    [MODEL_IDS.CLAUDE_SONNET_55]: "anthropic/claude-sonnet-5.5",
    [MODEL_IDS.CLAUDE_HAIKU_55]: "anthropic/claude-haiku-5.5",
  },
  // Native Anthropic format
  ANTHROPIC: {
    [MODEL_IDS.CLAUDE_SONNET_55]: "claude-sonnet-5-5",
    [MODEL_IDS.CLAUDE_HAIKU_55]: "claude-haiku-5-5",
  },
} as const;

/**
 * Server-side allowlists for image generation & editing models
 */
export const ALLOWED_GENERATE_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-3-pro-image-preview",
  "black-forest-labs/flux-schnell",
  "gpt-image-2",
  "dall-e-3",
] as const;

export const ALLOWED_EDIT_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-3-pro-image-preview",
] as const;

/**
 * Default limits and configurations
 */
export const DEFAULT_LIMITS = {
  RECENT_MESSAGES: 50,
  CONTEXT_MESSAGES: 100,
  MAX_TITLE_LENGTH: 100,
  MAX_CONTENT_LENGTH: 100000,
} as const;

export type DefaultLimit = (typeof DEFAULT_LIMITS)[keyof typeof DEFAULT_LIMITS];

/**
 * Cache TTLs in seconds
 */
export const CACHE_TTL = {
  CONVERSATIONS_LIST: 60, // 1 minute
  GEMS_LIST: 300, // 5 minutes
  GEM_INSTRUCTIONS: 3600, // 1 hour
} as const;

export type CacheTTL = (typeof CACHE_TTL)[keyof typeof CACHE_TTL];

/**
 * Conversation default values
 */
export const CONVERSATION_DEFAULTS = {
  TITLE: "New Chat",
  TITLE_VIETNAMESE: "New Chat", // Could be translated
} as const;

/**
 * Schema format types (for database column naming)
 */
export const SCHEMA_FORMAT = {
  SNAKE_CASE: "snake_case",
  CAMEL_CASE: "camelCase",
} as const;

export type SchemaFormat = (typeof SCHEMA_FORMAT)[keyof typeof SCHEMA_FORMAT];

/**
 * API response status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * Rate limit configurations
 */
export const RATE_LIMIT = {
  CHAT_STREAM_WINDOW_SECONDS: 60,
  CHAT_STREAM_MAX_REQUESTS: 30,
} as const;

/**
 * UUID v4 validation pattern
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feature flag for virtualized chat list (safe rollout: default false)
 */
export const ENABLE_VIRTUALIZED_CHAT = false;

/**
 * Default configurations for Strata Local LLM
 */
export const STRATA_DEFAULTS = {
  BASE_URL: "http://127.0.0.1:8080/v1",
  MODEL_ID: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
  DISPLAY_NAME: "Orcarouter-qwen3.8-flash-next-uncensored-iq3",
  CONTEXT_WINDOW: 32768,
  CTX_SLACK: 8,
  PROMPT_SAFETY_TOKENS: 512,
  RAW_CONTEXT_CEILING_TOKENS: 128000,
  REQUEST_TIMEOUT_MS: 300000,
  IDLE_TIMEOUT_MS: 120000,
  QUEUE_MAX_PENDING: 2,
  QUEUE_MAX_WAIT_MS: 120000,
  HEALTH_CACHE_TTL_MS: 5000,
  HEALTH_TIMEOUT_MS: 2000,
  COUNT_TOKENS_TIMEOUT_MS: 3000,
} as const;

// Centralized constants for the application
// This file contains magic strings and numbers used throughout the codebase

/**
 * Message roles
 */
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES];

/**
 * Default limits and configurations
 */
export const DEFAULT_LIMITS = {
  RECENT_MESSAGES: 50,
  CONTEXT_MESSAGES: 100,
  MAX_TITLE_LENGTH: 100,
  MAX_CONTENT_LENGTH: 100000,
} as const;

export type DefaultLimit = typeof DEFAULT_LIMITS[keyof typeof DEFAULT_LIMITS];

/**
 * Cache TTLs in seconds
 */
export const CACHE_TTL = {
  CONVERSATIONS_LIST: 60,      // 1 minute
  GEMS_LIST: 300,              // 5 minutes
  GEM_INSTRUCTIONS: 3600,      // 1 hour
} as const;

export type CacheTTL = typeof CACHE_TTL[keyof typeof CACHE_TTL];

/**
 * Conversation default values
 */
export const CONVERSATION_DEFAULTS = {
  TITLE: 'New Chat',
  TITLE_VIETNAMESE: 'New Chat', // Could be translated
} as const;

/**
 * Schema format types (for database column naming)
 */
export const SCHEMA_FORMAT = {
  SNAKE_CASE: 'snake_case',
  CAMEL_CASE: 'camelCase',
} as const;

export type SchemaFormat = typeof SCHEMA_FORMAT[keyof typeof SCHEMA_FORMAT];

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
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

/**
 * Rate limit configurations
 */
export const RATE_LIMIT = {
  CHAT_STREAM_WINDOW_SECONDS: 60,
  CHAT_STREAM_MAX_REQUESTS: 30,
} as const;


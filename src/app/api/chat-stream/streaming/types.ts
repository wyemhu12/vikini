// /app/api/chat-stream/streaming/types.ts

// Type definitions for conversation objects
export interface CreatedConversation {
  id: string;
  title?: string;
  model?: string;
  gemId?: string | null;
  [key: string]: unknown;
}

// System instruction type for Gemini API
export interface SystemInstruction {
  role: "system";
  parts: { text: string }[];
}

export interface Message {
  role: string;
  content: string;
  /** @deprecated Use thoughtSignatures array instead */
  thoughtSignature?: string;
  /** Gemini 3 thought signatures for multi-step reasoning */
  thoughtSignatures?: string[];
  [key: string]: unknown;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
  thoughtSignature?: string;
}

export interface MappedMessage {
  role: "user" | "model";
  parts: MessagePart[];
}

/**
 * Token usage metadata from Gemini API response.
 * @see https://ai.google.dev/gemini-api/docs/gemini-3
 */
export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface StreamResult {
  full: string;
  groundingMetadata: unknown;
  urlContextMetadata: unknown;
  promptFeedback: unknown;
  finishReason: string;
  safetyRatings: unknown;
  /** @deprecated Use thoughtSignatures array instead */
  thoughtSignature?: string;
  /** All thought signatures collected during streaming (for multi-step function calling) */
  thoughtSignatures: string[];
  /** Token usage metadata from Gemini API */
  usageMetadata?: UsageMetadata;
  /** All response parts from Gemini 3 tool context circulation (toolCall, toolResponse, etc.) */
  allResponseParts?: unknown[];
}

export type ThinkingLevel = "off" | "low" | "medium" | "high" | "minimal";

// =====================================================
// TIMEOUT CONFIGURATION
// =====================================================

/**
 * Model-specific timeouts for AI API calls in milliseconds.
 * Pro models need more time for complex reasoning.
 * Deep Thinking (thinkingLevel: "high") requires significantly longer timeouts.
 * Can be overridden via STREAM_TIMEOUT_MS environment variable.
 */
export const TIMEOUT_CONFIG = {
  PRO: 300000, // 5 minutes for Pro models
  PRO_DEEP_THINKING: 600000, // 10 minutes for Pro + Deep Thinking
  FLASH: 240000, // 4 minutes for Flash models
  FLASH_DEEP_THINKING: 480000, // 8 minutes for Flash + Deep Thinking
  DEFAULT: 180000, // 3 minutes for other models
} as const;

/**
 * Custom error for stream timeout
 */
export class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI stream timed out after ${timeoutMs}ms`);
    this.name = "StreamTimeoutError";
  }
}

/**
 * Dummy signature for model migration scenarios.
 * Per Gemini 3 docs: use this when migrating from Gemini 2.5 or injecting custom function calls.
 * @see https://ai.google.dev/gemini-api/docs/gemini-3#thought_signatures
 */
export const DUMMY_THOUGHT_SIGNATURE = "context_engineering_is_the_way_to_go";

export interface ChatStreamParams {
  ai: {
    models: {
      generateContentStream: (params: {
        model: string;
        contents: unknown[];
        config: {
          systemInstruction?: string | unknown;
          temperature?: number;
          tools?: unknown[];
          toolConfig?: unknown;
          safetySettings?: unknown[];
          maxOutputTokens?: number;
          thinkingConfig?: unknown;
          cachedContent?: string;
        };
      }) => Promise<AsyncGenerator<unknown, unknown, unknown>> | AsyncIterable<unknown>;
    };
  };
  model: string;
  contents: unknown[];
  sysPrompt: string;
  tools: unknown[];
  safetySettings: unknown[] | null;
  /** Tool config for Gemini 3 Tool Context Circulation */
  toolConfig?: Record<string, unknown>;
  gemMeta: {
    gemId?: string | null;
    hasSystemInstruction?: boolean;
    systemInstructionChars?: number;
    error?: string;
  };
  modelMeta: {
    model?: string;
    requestedModel?: string;
    apiModel?: string;
    normalized?: boolean;
    isDefault?: boolean;
  };
  createdConversation: unknown | null;
  shouldGenerateTitle: boolean;
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
  cookieWeb: string;
  regenerate: boolean;
  content: string;
  conversationId: string;
  userId: string;
  contextMessages: Message[];
  appendToContext: (
    conversationId: string,
    message: {
      role: string;
      content: string;
      thoughtSignature?: string;
      thoughtSignatures?: string[];
    }
  ) => Promise<void>;
  saveMessage: (params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    meta?: Record<string, unknown>;
  }) => Promise<unknown>;
  setConversationAutoTitle: (
    userId: string,
    conversationId: string,
    title: string
  ) => Promise<void>;
  generateOptimisticTitle: (content: string) => Promise<string | null>;
  generateFinalTitle: (params: {
    userId: string;
    conversationId: string;
    messages: Message[];
  }) => Promise<string | null>;
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
  /** Explicit context cache name (from contextCache.ts). When set, system instruction is omitted (it's in the cache). */
  cachedContent?: string;
}

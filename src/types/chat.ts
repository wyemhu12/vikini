// src/types/chat.d.ts
// Centralized type definitions for chat feature

/**
 * Typed metadata for messages - used for image generation and other features.
 */
export interface MessageMeta {
  type?: "image_gen" | "text" | "chart";
  imageUrl?: string;
  prompt?: string;
  attachment?: {
    storagePath: string;
    mimeType?: string;
    filename?: string;
  };
  /** @deprecated Use thoughtSignatures array instead for multi-step function calling */
  thoughtSignature?: string;
  /** Gemini 3 thought signatures for multi-step reasoning continuity */
  thoughtSignatures?: string[];
  /** Token count from Gemini API (input tokens) */
  promptTokenCount?: number;
  /** Token count from Gemini API (output tokens) */
  candidatesTokenCount?: number;
  /** Token count from reasoning/thinking */
  thoughtsTokenCount?: number;
  /** Total tokens used in this response */
  totalTokenCount?: number;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string | null;
  meta: MessageMeta;
}

export interface MessageRow {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  role: string;
  content: string;
  created_at?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastMessagePreview: string | null;
  gemId: string | null;
  model: string;
  gem: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export interface ConversationRow {
  id: string;
  user_id?: string;
  userId?: string;
  user?: string;
  owner?: string;
  created_by?: string;
  title?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  last_message_preview?: string;
  lastMessagePreview?: string;
  gem_id?: string | null;
  gemId?: string | null;
  model?: string;
  gems?: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export interface ConversationPayload {
  title?: string;
  model?: string;
  lastMessagePreview?: string | null;
  gemId?: string | null;
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedConversations {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

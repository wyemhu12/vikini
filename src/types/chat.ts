// src/types/chat.ts
// Facade: re-exports authoritative types from lib/features/chat/*

export type { MessageMeta, Message } from "@/lib/features/chat/messages";
export type {
  Conversation,
  ListConversationsOptions,
  PaginatedConversations,
} from "@/lib/features/chat/conversations";

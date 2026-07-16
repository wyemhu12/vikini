// /app/api/chat-stream/conversationLoader.ts

import { CONVERSATION_DEFAULTS } from "@/lib/utils/constants";
import { DEFAULT_MODEL, normalizeModelForApi, getModelTokenLimit } from "@/lib/core/modelRegistry";
import { getConversation, saveConversation } from "@/lib/features/chat/conversations";
import {
  deleteLastAssistantMessage,
  deleteMessagesIncludingAndAfter,
} from "@/lib/features/chat/messages";
import { coreLogger, type ConversationContext } from "./chatStreamHelpers";

export async function loadOrCreateConversation(
  userId: string,
  conversationIdRaw: string | null | undefined
): Promise<ConversationContext> {
  let convo: import("@/lib/features/chat/conversations").Conversation | null = null;
  const requestedConversationId = conversationIdRaw || null;

  if (requestedConversationId) {
    try {
      convo = await getConversation(requestedConversationId);
    } catch {
      convo = null;
    }
  }

  let createdConversation: import("@/lib/features/chat/conversations").Conversation | null = null;
  if (!convo) {
    try {
      convo = await saveConversation(userId, { title: CONVERSATION_DEFAULTS.TITLE });
      createdConversation = convo;
    } catch (e) {
      const error = e as Error;
      throw new Error(error?.message || "Failed to create conversation");
    }
  }

  if (!convo) {
    throw new Error("Conversation missing");
  }

  const conversationId = convo.id;
  if (!conversationId) {
    throw new Error("Conversation missing id");
  }

  const isNew = Boolean(createdConversation);
  const isUntitled =
    convo.title === CONVERSATION_DEFAULTS.TITLE ||
    convo.title === CONVERSATION_DEFAULTS.TITLE.toLowerCase();
  const shouldGenerateTitle = isNew || isUntitled;

  const requestedModel = convo.model || DEFAULT_MODEL;
  const model = normalizeModelForApi(requestedModel);
  const modelLimitTokens = getModelTokenLimit(requestedModel);

  return {
    conversation: convo,
    conversationId,
    isNew,
    isUntitled,
    shouldGenerateTitle,
    requestedModel,
    model,
    modelLimitTokens,
  };
}

export async function handleMessageTruncation(
  userId: string,
  conversationId: string,
  truncateMessageId: string | null | undefined,
  regenerate: boolean | undefined
): Promise<void> {
  if (truncateMessageId) {
    try {
      await deleteMessagesIncludingAndAfter(userId, conversationId, truncateMessageId);
    } catch (e) {
      coreLogger.error("Failed to truncate messages:", e);
    }
  } else if (regenerate) {
    try {
      await deleteLastAssistantMessage(userId, conversationId);
    } catch {
      // ignore
    }
  }
}

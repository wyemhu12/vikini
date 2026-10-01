// lib/features/chat/messages.ts
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { encryptText, decryptText } from "@/lib/core/encryption";
import { logger } from "@/lib/utils/logger";
import { NotFoundError, ForbiddenError } from "@/lib/utils/errors";
import { balanceThinkTags } from "./thinkTags";
import { removeOwnedStoragePaths } from "./storageCleanup";

const messagesLogger = logger.withContext("messages");

/**
 * Typed metadata for messages - used for image generation and other features.
 * Avoids `any` type for type safety.
 */
export interface MessageMeta {
  type?: "image_gen" | "image_edit" | "text" | "chart";
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
  /** IDs of files attached to this message */
  fileIds?: string[];
  [key: string]: unknown; // Allow additional properties
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string | null;
  meta: MessageMeta;
}

interface MessageRow {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  role: string;
  content: string;
  created_at?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

function mapMessageRow(row: MessageRow | null): Message | null {
  if (!row) return null;

  // Safe Decrypt: Không bao giờ crash khi map dữ liệu
  let content = row.content;
  try {
    content = decryptText(row.content);
  } catch (e) {
    messagesLogger.warn("Map Error:", e);
  }

  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId ?? "",
    role: row.role,
    content: content,
    createdAt: row.created_at ?? row.createdAt ?? null,
    meta: row.meta || {},
  };
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: string,
  content: string,
  meta: Record<string, unknown> = {}
): Promise<Message | null> {
  const supabase = getSupabaseAdmin();

  // 1. Safe Encrypt
  let contentToSave = content;
  try {
    const encrypted = encryptText(content);
    if (encrypted) contentToSave = encrypted;
  } catch (e) {
    messagesLogger.error("Encrypt failed in saveMessage:", e);
  }

  // 2. Insert DB with Logging
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content: contentToSave,
      meta,
    })
    .select("*")
    .single();

  if (error) {
    // In lỗi chi tiết ra Log Vercel để bạn debug nếu cần
    messagesLogger.error("[Supabase Error] saveMessage:", error);
    throw new Error(error.message);
  }

  return mapMessageRow(data);
}

/**
 * In-memory tombstone cache to prevent race conditions where a delayed serverless
 * abort save inserts a message that was just deleted by regenerate/edit/delete.
 * Key: clientMessageId, Value: timestamp (TTL 60s).
 */
const deletedClientMessageIds = new Map<string, number>();
const TOMBSTONE_TTL_MS = 60_000;

export function recordTombstone(clientMessageId: string | undefined): void {
  if (!clientMessageId) return;
  const now = Date.now();
  if (deletedClientMessageIds.size > 200) {
    for (const [id, ts] of deletedClientMessageIds.entries()) {
      if (now - ts > TOMBSTONE_TTL_MS) {
        deletedClientMessageIds.delete(id);
      }
    }
  }
  deletedClientMessageIds.set(clientMessageId, now);
}

export function isTombstoned(clientMessageId: string | undefined): boolean {
  if (!clientMessageId) return false;
  const ts = deletedClientMessageIds.get(clientMessageId);
  if (!ts) return false;
  if (Date.now() - ts > TOMBSTONE_TTL_MS) {
    deletedClientMessageIds.delete(clientMessageId);
    return false;
  }
  return true;
}

export interface UpsertResult {
  message: Message | null;
  alreadyComplete?: boolean;
}

export async function upsertMessage(
  userId: string,
  conversationId: string,
  role: string,
  content: string,
  meta: Record<string, unknown> = {},
  clientMessageId?: string
): Promise<UpsertResult> {
  const effectiveClientId = (clientMessageId || meta.clientMessageId) as string | undefined;

  // 1. Check tombstone: if this clientMessageId was recently deleted, reject insertion
  if (effectiveClientId && isTombstoned(effectiveClientId)) {
    messagesLogger.info(
      `[upsertMessage] Rejected insert for tombstoned clientMessageId: ${effectiveClientId}`
    );
    return { message: null };
  }

  const supabase = getSupabaseAdmin();

  // 2. Ensure meta has clientMessageId
  const enrichedMeta: Record<string, unknown> = {
    ...meta,
    ...(effectiveClientId ? { clientMessageId: effectiveClientId } : {}),
  };

  // 3. Balance think tags on the content before saving
  const balancedContent = balanceThinkTags(content);

  // 4. If we have a clientMessageId, check if an existing message row exists with this clientMessageId
  if (effectiveClientId) {
    const { data: existingRows } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("meta->>clientMessageId", effectiveClientId)
      .limit(1);

    const existingRow = existingRows?.[0] as MessageRow | undefined;

    if (existingRow) {
      const existingMeta = existingRow.meta || {};
      const existingIsPartial = existingMeta.isPartial === true;
      const incomingIsPartial = enrichedMeta.isPartial === true;

      // Rule: Complete always wins over Partial.
      // If DB already has a complete message, and incoming is partial, do not overwrite with partial.
      if (!existingIsPartial && incomingIsPartial) {
        messagesLogger.info(
          `[upsertMessage] Skipped partial update because complete message already exists: ${existingRow.id}`
        );
        return {
          message: mapMessageRow(existingRow),
          alreadyComplete: true,
        };
      }

      // Safe encrypt new content
      let contentToSave = balancedContent;
      try {
        const encrypted = encryptText(balancedContent);
        if (encrypted) contentToSave = encrypted;
      } catch (e) {
        messagesLogger.error("Encrypt failed in upsertMessage:", e);
      }

      const { data: updated, error: updateError } = await supabase
        .from("messages")
        .update({
          content: contentToSave,
          meta: enrichedMeta,
        })
        .eq("id", existingRow.id)
        .select("*")
        .single();

      if (updateError) {
        messagesLogger.error("[Supabase Error] upsertMessage update:", updateError);
        throw new Error(updateError.message);
      }

      return { message: mapMessageRow(updated) };
    }
  }

  // 5. No existing message found: insert new message
  const inserted = await saveMessage(userId, conversationId, role, balancedContent, enrichedMeta);
  return { message: inserted };
}

export async function deleteMessageByClientMessageId(
  userId: string,
  conversationId: string,
  clientMessageId: string
): Promise<void> {
  recordTombstone(clientMessageId);

  const supabase = getSupabaseAdmin();

  // Verify conversation ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) {
    messagesLogger.warn(
      { userId, conversationId },
      "Unauthorized attempt to delete message in unowned conversation"
    );
    return;
  }

  const { data: targetMsg } = await supabase
    .from("messages")
    .select("id, meta")
    .eq("conversation_id", conversationId)
    .eq("meta->>clientMessageId", clientMessageId)
    .maybeSingle();

  if (!targetMsg) return;

  const meta = targetMsg.meta as MessageMeta | undefined;
  if (
    (meta?.type === "image_gen" || meta?.type === "image_edit") &&
    meta?.attachment?.storagePath
  ) {
    await removeOwnedStoragePaths(supabase, userId, [meta.attachment.storagePath]);
  }

  await supabase.from("messages").delete().eq("id", targetMsg.id);
}

// Giữ nguyên các hàm Get/Delete cũ nhưng đảm bảo dùng mapMessageRow
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(mapMessageRow).filter((m): m is Message => m !== null);
}

export async function getRecentMessages(
  conversationId: string,
  limit: number = 50
): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  const n = Number(limit) > 0 ? Number(limit) : 50;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);

  const rows = (data || []).map(mapMessageRow).filter((m): m is Message => m !== null);
  rows.reverse();
  return rows;
}

export async function deleteLastAssistantMessage(
  userId: string,
  conversationId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("id, meta")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMsg) {
    const meta = lastMsg.meta as MessageMeta | undefined;
    if (meta?.clientMessageId) {
      recordTombstone(meta.clientMessageId as string);
    }
    await supabase.from("messages").delete().eq("id", lastMsg.id);
  }
}

export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch message and verify conversation ownership
  const { data: msg, error } = await supabase
    .from("messages")
    .select("id, meta, conversation_id, conversations!inner(user_id)")
    .eq("id", messageId)
    .maybeSingle();

  if (error || !msg) {
    throw new NotFoundError("Message");
  }

  const conv = msg.conversations as unknown as { user_id: string };
  if (conv.user_id !== userId) {
    throw new ForbiddenError("You do not have permission to delete this message");
  }

  if (msg.meta) {
    const meta = msg.meta as MessageMeta;
    if (meta.clientMessageId) {
      recordTombstone(meta.clientMessageId as string);
    }
    // Check if it's a generated or edited image with a storage path
    if ((meta.type === "image_gen" || meta.type === "image_edit") && meta.attachment?.storagePath) {
      await removeOwnedStoragePaths(supabase, userId, [meta.attachment.storagePath]);
    }
  }

  // 2. Delete message from DB
  await supabase.from("messages").delete().eq("id", messageId);
}

export async function deleteMessagesIncludingAndAfter(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Verify conversation ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conv) {
    messagesLogger.warn(
      { userId, conversationId },
      "Unauthorized attempt to truncate messages in unowned conversation"
    );
    return;
  }

  // 1. Get target message to find its creation time
  const { data: targetMsg } = await supabase
    .from("messages")
    .select("created_at")
    .eq("id", messageId)
    .eq("conversation_id", conversationId) // Ensure it belongs to the convo
    .maybeSingle();

  if (!targetMsg) return;

  // 2. Identify messages with generated images to clean up and record tombstones for all clientMessageIds
  const { data: messagesToDelete } = await supabase
    .from("messages")
    .select("meta")
    .eq("conversation_id", conversationId)
    .gte("created_at", targetMsg.created_at);

  if (messagesToDelete && messagesToDelete.length > 0) {
    const pathsToRemove: string[] = [];

    for (const msg of messagesToDelete) {
      const meta = msg.meta as MessageMeta;
      if (meta?.clientMessageId) {
        recordTombstone(meta.clientMessageId as string);
      }
      if (
        (meta?.type === "image_gen" || meta?.type === "image_edit") &&
        meta?.attachment?.storagePath
      ) {
        pathsToRemove.push(meta.attachment.storagePath);
      }
    }

    if (pathsToRemove.length > 0) {
      await removeOwnedStoragePaths(supabase, userId, pathsToRemove);
    }
  }

  // 3. Delete target message and everything created after it in this conversation
  // Note: Using gte (>=) to include the message itself.
  await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gte("created_at", targetMsg.created_at);
}
// ... existing code ...

/**
 * Deletes a SINGLE message by ID.
 * Used for Gallery/Studio mode where we don't want to wipe future history.
 */
export async function deleteSingleMessage(userId: string, messageId: string) {
  const supabase = getSupabaseAdmin();

  // Verify ownership matches by joining with conversations table
  // Since we are using admin client, we MUST manually verify user_id of the conversation
  const { data: msg, error } = await supabase
    .from("messages")
    .select("conversation_id, meta, conversations!inner(user_id)")
    .eq("id", messageId)
    .single();

  if (error || !msg) {
    messagesLogger.error("deleteSingleMessage Fetch Error:", error);
    throw new Error("Message not found");
  }

  // Type assertion for joined data
  const conversation = msg.conversations as unknown as { user_id: string };

  if (conversation.user_id !== userId) {
    messagesLogger.error(
      `deleteSingleMessage Unauthorized: ReqUser=${userId} vs ConvUser=${conversation.user_id}`
    );
    throw new Error("Unauthorized or message not found");
  }

  // 1. Delete Storage File if exists
  if (msg.meta?.imageUrl) {
    const path = msg.meta.imageUrl.split("/storage/v1/object/public/images/").pop();
    if (path) {
      await supabase.storage.from("images").remove([path]);
    }
  }
  const meta = msg.meta as MessageMeta | undefined;
  if (
    (meta?.type === "image_gen" || meta?.type === "image_edit") &&
    meta?.attachment?.storagePath
  ) {
    await removeOwnedStoragePaths(supabase, userId, [meta.attachment.storagePath]);
  }

  // 2. Delete Record
  await supabase.from("messages").delete().eq("id", messageId);
}

// /lib/features/chat/conversations.ts
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { deleteAttachmentsByConversation } from "@/lib/features/attachments/attachments";
import { CONVERSATION_DEFAULTS } from "@/lib/utils/constants";
import {
  DEFAULT_MODEL,
  SELECTABLE_MODELS,
  coerceStoredModel,
  isSelectableModelId,
  type SelectableModel,
} from "@/lib/core/modelRegistry";
import {
  getCachedConversations,
  setCachedConversations,
  invalidateConversationsCache,
} from "@/lib/core/cache";

// ------------------------------
// Deduplication: Prevent race conditions when creating conversations
// ------------------------------

interface PendingCreate {
  promise: Promise<Conversation | null>;
  timestamp: number;
}

// Map of userId -> pending conversation creation promise
// This prevents duplicate conversations when users spam-click "New Chat"
const pendingCreates = new Map<string, PendingCreate>();

// Cleanup stale pending entries (older than 30 seconds)
const PENDING_TTL_MS = 30000;

function cleanupPendingCreates(): void {
  const now = Date.now();
  for (const [key, entry] of pendingCreates.entries()) {
    if (now - entry.timestamp > PENDING_TTL_MS) {
      pendingCreates.delete(key);
    }
  }
}

// ------------------------------
// Constants (single source of truth: /lib/core/modelRegistry.ts)
// ------------------------------

// Backward-compatible exports
export { DEFAULT_MODEL };
export const AVAILABLE_MODELS: readonly SelectableModel[] = SELECTABLE_MODELS;

// ------------------------------
// Types
// ------------------------------

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

interface ConversationRow {
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

interface ConversationPayload {
  title?: string;
  model?: string;
  lastMessagePreview?: string | null;
  gemId?: string | null;
}

// ------------------------------
// Row mappers
// ------------------------------
export function mapConversationRow(row: ConversationRow | null): Conversation | null {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? row.user ?? row.owner ?? row.created_by ?? "",
    title: row.title ?? CONVERSATION_DEFAULTS.TITLE,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    lastMessagePreview: row.last_message_preview ?? row.lastMessagePreview ?? null,
    gemId: row.gem_id ?? row.gemId ?? null,
    // NEW: model field for per-chat model selection
    model: coerceStoredModel(row.model ?? DEFAULT_MODEL),
    gem: row.gems
      ? {
          name: row.gems.name,
          icon: row.gems.icon,
          color: row.gems.color,
        }
      : null,
  };
}

export async function getConversationSafe(conversationId: string): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();

  // Try join on gems (supabase can join by relationship)
  const q1 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!q1.error) return mapConversationRow(q1.data);

  // Fallback: no relation or join not supported
  const q2 = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (q2.error) throw new Error(`getConversation failed: ${q2.error.message}`);
  return mapConversationRow(q2.data);
}

// Pagination options for listing conversations
export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
}

// Default pagination values
const DEFAULT_CONVERSATIONS_LIMIT = 50;
const MAX_CONVERSATIONS_LIMIT = 200;

// Result type for paginated conversations
export interface PaginatedConversations {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

async function listConversationsSafe(
  userId: string,
  options: ListConversationsOptions = {}
): Promise<PaginatedConversations> {
  const supabase = getSupabaseAdmin();

  // Validate and clamp pagination values
  const limit = Math.min(
    Math.max(1, options.limit || DEFAULT_CONVERSATIONS_LIMIT),
    MAX_CONVERSATIONS_LIMIT
  );
  const offset = Math.max(0, options.offset || 0);

  // Try primary schema: user_id with pagination
  const q1 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)", { count: "exact" })
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!q1.error) {
    const conversations = (q1.data || [])
      .map(mapConversationRow)
      .filter((c): c is Conversation => c !== null);
    const total = q1.count || 0;
    return {
      conversations,
      total,
      limit,
      offset,
      hasMore: offset + conversations.length < total,
    };
  }

  // Fallback schema: userId with pagination
  const q2 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)", { count: "exact" })
    .eq("userId", userId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q2.error) throw new Error(`listConversations failed: ${q2.error.message}`);

  const conversations = (q2.data || [])
    .map(mapConversationRow)
    .filter((c): c is Conversation => c !== null);
  const total = q2.count || 0;

  return {
    conversations,
    total,
    limit,
    offset,
    hasMore: offset + conversations.length < total,
  };
}

// ------------------------------
// Conversations
// ------------------------------

/**
 * Retrieves a conversation by ID.
 *
 * Includes related gem information (name, icon, color) if available.
 *
 * @param conversationId - UUID of the conversation to retrieve
 * @returns Conversation object with gem info, or null if not found
 * @throws {Error} If database query fails
 *
 * @example
 * ```typescript
 * const conv = await getConversation('123e4567-e89b-12d3-a456-426614174000');
 * if (conv) {
 *   console.log(`Title: ${conv.title}, Model: ${conv.model}`);
 * }
 * ```
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  return getConversationSafe(conversationId);
}

/**
 * Creates a new conversation or updates an existing one.
 *
 * **Schema Compatibility:**
 * Supports both snake_case (`user_id`, `created_at`) and camelCase (`userId`, `createdAt`)
 * database schemas for backward compatibility.
 *
 * @param userId - User ID (email) who owns the conversation
 * @param payload - Conversation data:
 *   - `title`: Optional conversation title (defaults to "New Chat")
 *   - `model`: Optional AI model to use (defaults to DEFAULT_MODEL)
 *   - `lastMessagePreview`: Optional preview of last message
 *   - `gemId`: Optional gem ID to associate with conversation
 * @returns Created/updated conversation object, or null on error
 * @throws {Error} If database insert fails
 *
 * @example
 * ```typescript
 * const conv = await saveConversation('user@example.com', {
 *   title: 'My Chat',
 *   model: 'gemini-pro'
 * });
 * ```
 */
export async function saveConversation(
  userId: string,
  payload: ConversationPayload = {}
): Promise<Conversation | null> {
  // Cleanup stale pending entries
  cleanupPendingCreates();

  // Generate a deduplication key based on userId and title
  // This prevents duplicate "New Chat" creations when users spam-click
  const title = typeof payload?.title === "string" ? payload.title : CONVERSATION_DEFAULTS.TITLE;
  const isDefaultTitle = title === CONVERSATION_DEFAULTS.TITLE;

  // Only deduplicate for default-titled conversations (new chat scenario)
  // Custom-titled conversations should always be created
  if (isDefaultTitle) {
    const dedupKey = `${userId}:new-chat`;
    const pending = pendingCreates.get(dedupKey);

    if (pending) {
      // Return the existing pending promise to avoid duplicate creation
      return pending.promise;
    }

    // Create the promise and store it before execution
    const createPromise = doSaveConversation(userId, payload);
    pendingCreates.set(dedupKey, {
      promise: createPromise,
      timestamp: Date.now(),
    });

    try {
      const result = await createPromise;
      return result;
    } finally {
      // Clean up after completion (success or failure)
      pendingCreates.delete(dedupKey);
    }
  }

  // For custom-titled conversations, create directly
  return doSaveConversation(userId, payload);
}

/**
 * Internal function that performs the actual conversation creation.
 * Separated from saveConversation to enable deduplication logic.
 */
async function doSaveConversation(
  userId: string,
  payload: ConversationPayload = {}
): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();
  const title = typeof payload?.title === "string" ? payload.title : CONVERSATION_DEFAULTS.TITLE;
  const model = coerceStoredModel(payload?.model);
  const now = new Date().toISOString();

  const attempt1 = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      model,
      created_at: now,
      updated_at: now,
      last_message_preview: payload?.lastMessagePreview ?? null,
      gem_id: payload?.gemId ?? null,
    })
    .select("*")
    .single();

  let result: Conversation | null = null;
  if (!attempt1.error) {
    result = mapConversationRow(attempt1.data);
  } else {
    // Fallback for different schema
    const attempt2 = await supabase
      .from("conversations")
      .insert({
        userId,
        title,
        model,
        createdAt: now,
        updatedAt: now,
        lastMessagePreview: payload?.lastMessagePreview ?? null,
        gemId: payload?.gemId ?? null,
      })
      .select("*")
      .single();

    if (attempt2.error) throw new Error(`saveConversation failed: ${attempt2.error.message}`);
    result = mapConversationRow(attempt2.data);
  }

  // Invalidate cache after creating conversation
  await invalidateConversationsCache(userId);

  return result;
}

export async function setConversationGem(
  userId: string,
  conversationId: string,
  gemId: string | null
): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // PERFORMANCE: Use RETURNING clause to avoid extra query
  const { data, error } = await supabase
    .from("conversations")
    .update({ gem_id: gemId || null, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("*,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`setConversationGem failed: ${error.message}`);

  // Invalidate cache after update
  await invalidateConversationsCache(userId);

  return mapConversationRow(data);
}

// NEW: Set model for a conversation
export async function setConversationModel(
  userId: string,
  conversationId: string,
  model: string
): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // Validate model is in allowed list
  const finalModel = isSelectableModelId(model) ? model : DEFAULT_MODEL;

  // PERFORMANCE: Use RETURNING clause to avoid extra query
  const { data, error } = await supabase
    .from("conversations")
    .update({ model: finalModel, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("*,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`setConversationModel failed: ${error.message}`);

  // Invalidate cache after update
  await invalidateConversationsCache(userId);

  return mapConversationRow(data);
}

export async function renameConversation(
  userId: string,
  id: string,
  title: string
): Promise<Conversation | null> {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // PERFORMANCE: Use RETURNING clause to avoid extra query
  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`renameConversation failed: ${error.message}`);

  // Invalidate cache after update
  await invalidateConversationsCache(userId);

  return mapConversationRow(data);
}

export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // Delete attachments (storage + db) before deleting conversation row
  await deleteAttachmentsByConversation({ userId, conversationId });

  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error(`deleteConversation failed: ${error.message}`);

  // Invalidate cache after deletion
  await invalidateConversationsCache(userId);

  return { ok: true };
}

// ------------------------------
// Compatibility exports (expected by your routes)
// ------------------------------

/**
 * Get user's conversations (backward compatible - returns all conversations).
 * Uses caching for performance.
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  // Try to get from cache first
  const cached = await getCachedConversations<Conversation[]>(userId);
  if (cached !== null) {
    return cached;
  }

  // Cache miss: fetch from database (get all for caching)
  const result = await listConversationsSafe(userId, { limit: MAX_CONVERSATIONS_LIMIT });

  // Store in cache (non-blocking) - only cache the conversations array
  await setCachedConversations(userId, result.conversations);

  return result.conversations;
}

/**
 * Get user's conversations with pagination.
 * Does not use caching to ensure accurate counts.
 *
 * @param userId - The user's ID
 * @param options - Pagination options (limit, offset)
 * @returns Paginated conversations with metadata
 */
export async function getUserConversationsPaginated(
  userId: string,
  options: ListConversationsOptions = {}
): Promise<PaginatedConversations> {
  return listConversationsSafe(userId, options);
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  title: string
): Promise<Conversation | null> {
  return renameConversation(userId, conversationId, title);
}

export async function setConversationAutoTitle(
  userId: string,
  id: string,
  title: string
): Promise<Conversation | null> {
  // same as renameConversation but kept for semantic clarity
  return renameConversation(userId, id, title);
}

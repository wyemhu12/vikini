// src/lib/features/chat/storageValidation.ts
/**
 * Storage Path Validation & Authorization
 * Prevents directory traversal (%2e%2e, ..), special characters, and cross-user image reference attacks.
 */

import { ValidationError, ForbiddenError } from "@/lib/utils/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates storage path syntax and authorizes ownership in database.
 * Path must match exact format: {userId}/{conversationId}/{filename}
 * and must correspond to an existing record in messages table.
 */
export async function validateAndAuthorizeStoragePath(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  storagePath: string
): Promise<void> {
  if (!storagePath || typeof storagePath !== "string" || storagePath.length > 500) {
    throw new ValidationError("Invalid storage path length or format");
  }

  // Reject paths containing forbidden URL / traversal characters or control chars
  // eslint-disable-next-line no-control-regex
  if (/[%\\?#\x00-\x1f\x7f]/.test(storagePath)) {
    throw new ValidationError("Invalid characters in storage path");
  }

  const decoded = decodeURIComponent(storagePath);
  if (decoded.includes("..")) {
    throw new ValidationError("Directory traversal detected in storage path");
  }

  // Exactly 3 segments: [userId, conversationId, filename]
  const segments = decoded.split("/");
  if (segments.length !== 3 || !segments[0] || !segments[1] || !segments[2]) {
    throw new ValidationError(
      "Invalid storage path structure: expected userId/conversationId/filename"
    );
  }

  if (segments[0] !== userId) {
    throw new ForbiddenError("Storage path user mismatch");
  }

  if (segments[1] !== conversationId) {
    throw new ForbiddenError("Storage path conversation mismatch");
  }

  // Verify that this image was generated or saved in this conversation
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("meta->attachment->>storagePath", storagePath)
    .limit(1);

  if (error || !data || data.length === 0) {
    throw new ForbiddenError("Access denied to storage path");
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/utils/logger";

const storageLogger = logger.withContext("storageCleanup");

/**
 * Safely removes storage paths belonging to the specified user from the 'attachments' bucket.
 * Rejects paths that do not start with `${userId}/` or contain directory traversal `..`.
 */
export async function removeOwnedStoragePaths(
  supabase: SupabaseClient,
  userId: string,
  paths: (string | null | undefined)[]
): Promise<void> {
  if (!paths || paths.length === 0) return;

  const prefix = `${userId}/`;
  const validPaths: string[] = [];

  for (const rawPath of paths) {
    if (!rawPath || typeof rawPath !== "string") continue;
    const cleanPath = rawPath.trim();

    // Check directory traversal
    if (cleanPath.includes("..") || cleanPath.startsWith("../") || cleanPath.includes("/../")) {
      storageLogger.warn(
        { userId, path: cleanPath },
        "Rejected storage cleanup path containing path traversal"
      );
      continue;
    }

    // Verify ownership prefix
    if (!cleanPath.startsWith(prefix)) {
      storageLogger.warn(
        { userId, path: cleanPath },
        "Rejected storage cleanup path not matching user prefix"
      );
      continue;
    }

    validPaths.push(cleanPath);
  }

  if (validPaths.length > 0) {
    storageLogger.info({ count: validPaths.length, userId }, "Removing owned storage files");
    const { error } = await supabase.storage.from("attachments").remove(validPaths);
    if (error) {
      storageLogger.error({ error: error.message, userId }, "Failed to remove files from storage");
    }
  }
}

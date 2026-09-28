/**
 * Reconciler for merging server (remote) messages with local client messages.
 * Prevents SWR revalidation or reload from wiping out in-flight or partial assistant messages.
 */

export interface ReconcilableMessage {
  id?: string;
  role: string;
  content: string;
  meta?: Record<string, unknown>;
  sources?: unknown[];
  urlContext?: unknown[];
  [key: string]: unknown;
}

/**
 * Merges remote messages (from database/SWR) with local messages (from React state).
 * - Remote messages are the primary source of truth.
 * - Local messages with temp- IDs or unsynced clientMessageIds are preserved and anchored.
 * - Messages sharing the same clientMessageId are deduplicated, prioritizing remote records with real IDs
 *   unless remote is partial and local is complete.
 */
export function mergeMessages<T extends ReconcilableMessage>(
  remoteMessages: T[],
  localMessages: T[]
): T[] {
  if (!localMessages || localMessages.length === 0) {
    return remoteMessages || [];
  }
  if (!remoteMessages || remoteMessages.length === 0) {
    return localMessages;
  }

  // 1. Build a set of clientMessageIds and IDs that exist in remote messages
  const remoteClientIds = new Set<string>();
  const remoteIds = new Set<string>();

  for (const m of remoteMessages) {
    if (m.id) remoteIds.add(m.id);
    const clientMsgId = m.meta?.clientMessageId as string | undefined;
    if (clientMsgId) remoteClientIds.add(clientMsgId);
  }

  // 2. Identify unsynced local messages
  // - Starts with "temp-" id
  // - Has a clientMessageId that does NOT exist in remoteClientIds
  // - Legacy assistant messages with NO id and NO clientMessageId
  const unsyncedWithPredecessors: { message: T; predecessor: T | null }[] = [];

  for (let i = 0; i < localMessages.length; i++) {
    const m = localMessages[i];
    const isTempId = typeof m.id === "string" && m.id.startsWith("temp-");
    const clientMsgId = m.meta?.clientMessageId as string | undefined;
    const hasUnsyncedClientId = Boolean(clientMsgId && !remoteClientIds.has(clientMsgId));
    const isLegacyNoIdNoClient = !m.id && !clientMsgId && m.role === "assistant";

    if (isTempId || hasUnsyncedClientId || isLegacyNoIdNoClient) {
      const predecessor = i > 0 ? localMessages[i - 1] : null;
      unsyncedWithPredecessors.push({ message: m, predecessor });
    }
  }

  // 3. Start with remote messages
  const result: T[] = [...remoteMessages];

  // 4. Anchor unsynced messages into result
  for (const { message, predecessor } of unsyncedWithPredecessors) {
    let insertIndex = -1;

    if (predecessor) {
      const predId = predecessor.id;
      const predClientId = predecessor.meta?.clientMessageId as string | undefined;

      insertIndex = result.findIndex((r) => {
        if (predId && r.id === predId) return true;
        const rClientId = r.meta?.clientMessageId as string | undefined;
        if (predClientId && rClientId && rClientId === predClientId) return true;
        return false;
      });
    }

    if (insertIndex !== -1) {
      result.splice(insertIndex + 1, 0, message);
    } else {
      result.push(message);
    }
  }

  // 5. Deduplicate by clientMessageId
  const seenClientIds = new Map<string, number>();
  const finalMessages: T[] = [];

  for (const m of result) {
    const clientMsgId = m.meta?.clientMessageId as string | undefined;
    if (!clientMsgId) {
      finalMessages.push(m);
      continue;
    }

    const existingIndex = seenClientIds.get(clientMsgId);
    if (existingIndex === undefined) {
      seenClientIds.set(clientMsgId, finalMessages.length);
      finalMessages.push(m);
    } else {
      const existing = finalMessages[existingIndex];
      const existingIsPartial = existing.meta?.isPartial === true;
      const mIsPartial = m.meta?.isPartial === true;

      const isRealId = (id?: string) => Boolean(id && !id.startsWith("temp-"));
      const resolvedId = isRealId(existing.id)
        ? existing.id
        : isRealId(m.id)
          ? m.id
          : m.id || existing.id;

      // If existing is partial but m is complete: prefer complete content while retaining real ID
      if (existingIsPartial && !mIsPartial) {
        finalMessages[existingIndex] = {
          ...m,
          id: resolvedId,
        };
      } else if (!existing.id || existing.id.startsWith("temp-")) {
        // If m has real ID and existing has no real ID: use m's ID
        finalMessages[existingIndex] = {
          ...existing,
          id: resolvedId,
          meta: {
            ...m.meta,
            ...existing.meta,
          },
        };
      }
    }
  }

  return finalMessages;
}

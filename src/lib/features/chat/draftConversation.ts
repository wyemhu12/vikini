// src/lib/features/chat/draftConversation.ts
/**
 * Sentinel value indicating that draft conversation creation is currently in flight.
 */
export const DRAFT_PENDING = "__draft_pending__";

/**
 * Predicate to decide whether the file upload queue should be cleared.
 *
 * Rules:
 * 1. If nextId is DRAFT_PENDING -> do not clear (transitioning to a new conversation for upload).
 * 2. If prevId is null/undefined and the upload was self-initiated -> do not clear (preserve files attached in New Chat mode).
 * 3. If prevId !== nextId -> clear (user switched conversations).
 * 4. If prevId === nextId -> do not clear.
 */
export function shouldClearQueue(
  prevId: string | null | undefined,
  nextId: string | null | undefined,
  isSelfInitiated: boolean
): boolean {
  if (nextId === DRAFT_PENDING) return false;
  if (!prevId && isSelfInitiated) return false;
  return prevId !== nextId;
}

export interface DraftCoordinatorOptions {
  createConversation: () => Promise<{ id: string } | null>;
  onConversationCreated?: (id: string) => void;
}

export interface DraftCoordinator {
  ensureConversationId: () => Promise<string>;
  isCreating: () => boolean;
  reset: () => void;
}

/**
 * Single-flight draft conversation coordinator.
 * Ensures that multiple simultaneous file uploads or rapid actions in New Chat mode
 * trigger conversation creation exactly once and resolve to the same conversation ID.
 */
export function createDraftCoordinator(options: DraftCoordinatorOptions): DraftCoordinator {
  let inFlightPromise: Promise<string> | null = null;
  let createdId: string | null = null;

  const ensureConversationId = async (): Promise<string> => {
    if (createdId) return createdId;
    if (inFlightPromise) return inFlightPromise;

    inFlightPromise = (async () => {
      try {
        const conv = await options.createConversation();
        if (!conv?.id) {
          throw new Error("Failed to create conversation");
        }
        createdId = conv.id;
        options.onConversationCreated?.(conv.id);
        return conv.id;
      } finally {
        inFlightPromise = null;
      }
    })();

    return inFlightPromise;
  };

  return {
    ensureConversationId,
    isCreating: () => inFlightPromise !== null,
    reset: () => {
      createdId = null;
      inFlightPromise = null;
    },
  };
}

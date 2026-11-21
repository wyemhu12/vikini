import type { Conversation } from "./conversations";
import type { ThinkingStatsSnapshot, LocalStreamProgress } from "./thinkingStats";

export interface ConversationResponse {
  conversations?: Conversation[];
  [key: string]: unknown;
}

export interface FrontendConversation {
  id: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  model?: string;
  gem?: { name: string; icon: string | null; color: string | null } | null;
  persona?: { name: string; icon: string | null; color: string | null } | null;
  projectId?: string | null;
  parentConversationId?: string | null;
  forkedFromMessageId?: string | null;
  [key: string]: unknown;
}

export interface FrontendMessage {
  id?: string;
  role: string;
  content: string;
  sources?: unknown[];
  urlContext?: unknown[];
  meta?: {
    imageUrl?: string;
    prompt?: string;
    thinkingStats?: ThinkingStatsSnapshot;
    localProgress?: LocalStreamProgress;
    originalOptions?: {
      aspectRatio?: string;
      style?: string;
      model?: string;
      enhancer?: boolean;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type CreateConversationOptions =
  | {
      title?: string;
      model?: string;
      projectId?: string | null;
      onBeforeActivate?: (conversationId: string) => void;
    }
  | string;

export function toTs(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Converts a backend Conversation (ISO string dates) into FrontendConversation (numeric timestamps).
 */
export function convertConversationToFrontend(conv: Conversation): FrontendConversation {
  const convertDate = (dateStr: string | null | undefined): number | undefined => {
    if (!dateStr || typeof dateStr !== "string") return undefined;
    const timestamp = Date.parse(dateStr);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  };

  return {
    id: conv.id,
    title: conv.title,
    createdAt: convertDate(conv.createdAt),
    updatedAt: convertDate(conv.updatedAt),
    model: conv.model,
    gem: conv.gem,
    persona: conv.persona,
    projectId: conv.projectId,
    parentConversationId: conv.parentConversationId,
    forkedFromMessageId: conv.forkedFromMessageId,
  };
}

export function getTs(c: FrontendConversation | null | undefined): number {
  return toTs(c?.updatedAt ?? c?.createdAt ?? 0);
}

export function normalizeConv(
  c: FrontendConversation | null | undefined
): FrontendConversation | null {
  if (!c) return null;
  const createdAt = c.createdAt ?? 0;
  const updatedAt = c.updatedAt ?? createdAt;

  return {
    ...c,
    createdAt: typeof createdAt === "number" ? createdAt : toTs(createdAt),
    updatedAt: typeof updatedAt === "number" ? updatedAt : toTs(updatedAt),
  };
}

/**
 * Merges local optimistic state on top of remote SWR data without clobbering newer updates.
 * Filters out any tombstoned IDs if provided, and sorts descending by latest activity.
 */
export function mergeConversations(
  local: FrontendConversation[] = [],
  remote: FrontendConversation[] = [],
  deletedIds?: ReadonlySet<string>
): FrontendConversation[] {
  const map = new Map<string, FrontendConversation>();

  for (const r of remote) {
    const rr = normalizeConv(r);
    if (rr?.id && !deletedIds?.has(rr.id)) {
      map.set(rr.id, rr);
    }
  }

  for (const l of local) {
    const ll = normalizeConv(l);
    if (!ll?.id || deletedIds?.has(ll.id)) continue;

    const ex = map.get(ll.id);
    if (!ex) {
      map.set(ll.id, ll);
      continue;
    }

    const lts = getTs(ll);
    const rts = getTs(ex);

    map.set(ll.id, {
      ...ex,
      ...ll,
      updatedAt: Math.max(lts, rts),
      createdAt: Math.min(toTs(ll.createdAt ?? lts), toTs(ex.createdAt ?? rts)),
    });
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => getTs(b) - getTs(a));
  return merged;
}

/**
 * Optimistically patches a single conversation item and re-sorts descending by activity.
 */
export function patchConversationListItem(
  list: FrontendConversation[],
  id: string,
  patch: Partial<FrontendConversation>,
  updatedAt: number = Date.now()
): FrontendConversation[] {
  const next = list.map((c) =>
    c.id === id ? normalizeConv({ ...c, ...patch, updatedAt }) || c : normalizeConv(c) || c
  );
  next.sort((a, b) => getTs(b) - getTs(a));
  return next;
}

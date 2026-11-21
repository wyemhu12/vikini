import type { LocalStreamProgress, ThinkingStatsSnapshot } from "./thinkingStats";

export interface ChatFrontendMessage {
  id?: string;
  role: string;
  content: string;
  sources?: unknown[];
  urlContext?: unknown[];
  meta?: {
    thinkingStats?: ThinkingStatsSnapshot;
    localProgress?: LocalStreamProgress;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface StreamError {
  message: string;
  code?: string;
  status?: number;
  isTokenLimit?: boolean;
  tokenInfo?: { limit?: number; requested?: number } | null;
}

export interface CoreSendOptions {
  regenerate?: boolean;
  skipUserAppend?: boolean;
  truncateFromIndex?: number;
  truncateMessageId?: string;
  truncateClientMessageId?: string;
  skipSaveUserMessage?: boolean;
  fileIds?: string[];
}

export interface ParsedSSEEvent {
  event: string;
  data: {
    type?: string;
    conversation?: { id?: string; [key: string]: unknown };
    conversationId?: string;
    title?: string;
    sources?: unknown[];
    urls?: unknown[];
    enabled?: boolean;
    available?: boolean;
    t?: string;
    thinking?: string;
    error?: string;
    message?: string;
    code?: string;
    status?: number;
    isTokenLimit?: boolean;
    tokenInfo?: { limit?: number; requested?: number } | null;
    reason?: string;
    position?: number;
    total?: number;
    cache?: number;
    processed?: number;
    time_ms?: number;
    [key: string]: unknown;
  };
}

export function safeArray<T>(v: T[] | unknown): T[] {
  return Array.isArray(v) ? v : [];
}

export function generateClientMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "cm-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export function parseSSEEvent(part: string): ParsedSSEEvent | null {
  const lines = part.split("\n").filter(Boolean);
  const eventLine = lines.find((l) => l.startsWith("event:"));
  const dataLine = lines.find((l) => l.startsWith("data:"));
  const event = eventLine?.replace("event:", "").trim();
  const dataStr = dataLine?.replace("data:", "").trim();

  if (!event || !dataStr) return null;

  try {
    const data = JSON.parse(dataStr) as ParsedSSEEvent["data"];
    return { event, data };
  } catch {
    return null;
  }
}

export function normalizeFrontendMessages(
  arr: ChatFrontendMessage[] | unknown
): ChatFrontendMessage[] {
  const safe = safeArray<ChatFrontendMessage>(arr);
  return safe
    .map((m): ChatFrontendMessage => {
      const meta = m?.meta as Record<string, unknown> | undefined;
      const sources =
        safeArray(m?.sources).length > 0 ? safeArray(m?.sources) : safeArray(meta?.sources);
      const urlContext =
        safeArray(m?.urlContext).length > 0
          ? safeArray(m?.urlContext)
          : safeArray(meta?.urlContext);

      return {
        id: m?.id,
        role: m?.role || "",
        content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
        sources,
        urlContext,
        meta: m?.meta,
      };
    })
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        !(m.meta as Record<string, unknown> | undefined)?.isContextOnly
    );
}

/**
 * Resolves a message index by object identity -> id -> role+content (falling back to reverse scan).
 */
export function findMessageIndex(
  messages: readonly ChatFrontendMessage[],
  target: ChatFrontendMessage
): number {
  const directIdx = messages.findIndex((m) => {
    if (m === target) return true;
    if (m.id && target.id && m.id === target.id) return true;
    if (!m.id && !target.id && m.role === target.role && m.content === target.content) {
      return true;
    }
    return false;
  });

  if (directIdx !== -1 || target.id) {
    return directIdx;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === target.role && messages[i].content === target.content) {
      return i;
    }
  }
  return -1;
}

const VALID_THINKING_LEVELS = new Set(["off", "high", "low", "medium", "minimal"]);

export function readStoredThinkingLevel(): string {
  try {
    const stored = localStorage.getItem("vikini.thinkingLevel");
    if (stored && VALID_THINKING_LEVELS.has(stored)) {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "off";
}

export function buildChatStreamPayload(params: {
  conversationId: string | null;
  content: string;
  clientMessageId: string | null;
  truncateMessageId?: string;
  truncateClientMessageId?: string;
  regenerate: boolean;
  skipSaveUserMessage?: boolean;
  thinkingLevel: string;
  strataSampling?: unknown;
  fileIds?: string[];
}): Record<string, unknown> {
  return {
    conversationId: params.conversationId,
    content: params.content,
    clientMessageId: params.clientMessageId,
    truncateMessageId: params.truncateMessageId,
    truncateClientMessageId: params.truncateClientMessageId,
    regenerate: params.regenerate,
    skipSaveUserMessage: params.skipSaveUserMessage,
    thinkingLevel: params.thinkingLevel,
    ...(params.strataSampling ? { strataSampling: params.strataSampling } : {}),
    ...(params.fileIds && params.fileIds.length > 0 ? { fileIds: params.fileIds } : {}),
  };
}

export async function extractStreamHttpError(res: Response): Promise<StreamError> {
  let errMsg = "Stream failed";
  let errCode: string | undefined;
  try {
    const rawJson: unknown = await res.json();
    if (typeof rawJson === "object" && rawJson !== null) {
      const errField = (rawJson as { error?: unknown }).error;
      if (typeof errField === "object" && errField !== null) {
        const msg = (errField as { message?: unknown }).message;
        const code = (errField as { code?: unknown }).code;
        if (typeof msg === "string" && msg) errMsg = msg;
        if (typeof code === "string" && code) errCode = code;
      } else if (typeof errField === "string" && errField) {
        errMsg = errField;
      }
    }
  } catch {
    // Ignore JSON parse error on non-JSON failure responses
  }

  return {
    message: errMsg,
    code: errCode,
    status: res.status,
  };
}

export function appendUserMessageWithTruncate(
  prev: unknown,
  text: string,
  options: { truncateFromIndex?: number; fileIds?: string[] }
): ChatFrontendMessage[] {
  let current = normalizeFrontendMessages(prev);
  if (typeof options.truncateFromIndex === "number") {
    current = current.slice(0, options.truncateFromIndex);
  }
  const userMsg: ChatFrontendMessage = {
    role: "user",
    content: text,
    meta: options.fileIds && options.fileIds.length > 0 ? { fileIds: options.fileIds } : undefined,
  };
  return [...current, userMsg];
}

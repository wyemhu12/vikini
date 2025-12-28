// /app/api/conversations/sanitize.ts

export interface Message {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
  sources?: unknown[];
  urlContext?: unknown[];
  [key: string]: unknown;
}

/**
 * Sanitize messages coming from the database so the client does not crash on
 * null/undefined content or invalid shapes.
 */
export function sanitizeMessages(messagesRaw: unknown[]): Message[] {
  return (Array.isArray(messagesRaw) ? messagesRaw : [])
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === "object" && m !== null))
    .filter((m) => typeof m.role === "string" && m.role.length > 0)
    .map((m) => ({
      ...m,
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    })) as Message[];
}


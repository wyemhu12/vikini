// /app/api/conversations/sanitize.js

/**
 * Sanitize messages coming from the database so the client does not crash on
 * null/undefined content or invalid shapes.
 */
export function sanitizeMessages(messagesRaw) {
  return (Array.isArray(messagesRaw) ? messagesRaw : [])
    .filter((m) => m && typeof m === "object")
    .filter((m) => typeof m.role === "string" && m.role.length > 0)
    .map((m) => ({
      ...m,
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    }));
}

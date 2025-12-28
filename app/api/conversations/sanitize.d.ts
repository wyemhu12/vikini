// Type definitions for sanitize helper

export interface Message {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
  sources?: unknown[];
  urlContext?: unknown[];
}

export function sanitizeMessages(messagesRaw: unknown[]): Message[];


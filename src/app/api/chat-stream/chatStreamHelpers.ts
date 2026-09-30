// /app/api/chat-stream/chatStreamHelpers.ts

import { logger } from "@/lib/utils/logger";

export const coreLogger = logger.withContext("chatStreamCore");

// --- MIME TYPE HELPERS ---

export function isOfficeDocMime(m: unknown): boolean {
  const mime = String(m || "").toLowerCase();
  return (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function isPdfMime(m: unknown): boolean {
  const mime = String(m || "").toLowerCase();
  return mime === "application/pdf";
}

// --- PARSING HELPERS ---

export function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  const parts = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    out[k] = decodeURIComponent(v || "");
  }
  return out;
}

export function envFlag(value: unknown, defaultValue: boolean = false): boolean {
  if (value === undefined || value === null) return defaultValue;
  let v = String(value).trim().toLowerCase();
  // Strip surrounding quotes (common in .env files / Vercel config)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

export function stripOuterQuotes(s: unknown): string {
  const v = String(s || "").trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return v.slice(1, -1).trim();
    }
  }
  return v;
}

// --- TOKEN ESTIMATION ---

export { estimateTokens } from "@/lib/utils/tokenEstimate";

// --- INTERFACES ---

export interface HandleChatStreamCoreParams {
  req: import("next/server").NextRequest;
  userId: string;
}

export interface ConversationContext {
  conversation: import("@/lib/features/chat/conversations").Conversation;
  conversationId: string;
  isNew: boolean;
  isUntitled: boolean;
  shouldGenerateTitle: boolean;
  requestedModel: string;
  model: string;
  modelLimitTokens: number;
}

export interface MessageContext {
  contextMessages: Array<{ role: string; content: string }>;
  contents: Array<{ role: string; parts: unknown[] }>;
  contentsMeta?: Array<{ messageId?: string; fileIds?: string[] }>;
  currentTokenCount: number;
}

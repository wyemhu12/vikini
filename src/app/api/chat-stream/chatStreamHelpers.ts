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

/**
 * Estimates the number of tokens in a string.
 *
 * Token estimation for different text types:
 * - English: ~4 chars/token (GPT-style BPE)
 * - Vietnamese: ~2-3 chars/token (more syllabic, diacritics)
 * - CJK (Chinese/Japanese/Korean): ~1-2 chars/token
 * - Code: ~3-4 chars/token (keywords, symbols)
 *
 * We use a weighted approach based on character analysis for better accuracy.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;

  // Count different character types
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || [])
    .length;
  const vietnameseChars = (
    text.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []
  ).length;
  const asciiChars = (text.match(/[\x20-\x7E]/g) || []).length;
  const otherChars = text.length - cjkChars - vietnameseChars - asciiChars;

  // Weighted token estimation:
  // - CJK: 1.5 chars/token (very character-dense)
  // - Vietnamese: 2.5 chars/token (syllabic with diacritics)
  // - ASCII (English): 4 chars/token (standard BPE)
  // - Other Unicode: 2 chars/token (conservative)
  const cjkTokens = cjkChars / 1.5;
  const vietTokens = vietnameseChars / 2.5;
  const asciiTokens = asciiChars / 4;
  const otherTokens = otherChars / 2;

  // Add 10% safety margin to avoid context overflow
  const total = cjkTokens + vietTokens + asciiTokens + otherTokens;
  return Math.ceil(total * 1.1);
}

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
  currentTokenCount: number;
}

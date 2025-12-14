// /lib/redisContext.js
import { Redis } from "@upstash/redis";

let redis;

function getRedis() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error("Missing Upstash Redis env vars");
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

// ====== Config ======
export const CONTEXT_MESSAGE_LIMIT = 20; // số message đưa vào model (user+assistant)
export const CONTEXT_TTL_SECONDS = 45 * 60; // 45 phút

// Chặn drift: giữ tối đa N entries trong Redis list để không phình vô hạn nếu checkpoint fail
const HARD_LIST_CAP = 120;

// ====== Keys ======
function bufferKey(conversationId) {
  return `chat:${conversationId}:buffer`;
}

function summaryKey(conversationId) {
  return `chat:${conversationId}:summary`;
}

// 🔒 ALWAYS stringify + hard cap + refresh TTL
export async function appendToContext(conversationId, message) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  const payload = JSON.stringify({
    role: message.role,
    content: message.content,
  });

  await r.rpush(k, payload);

  // Hard cap to prevent drift
  // Keep last HARD_LIST_CAP entries
  await r.ltrim(k, -HARD_LIST_CAP, -1);

  // Refresh TTL
  await r.expire(k, CONTEXT_TTL_SECONDS);
}

// 🛡️ SAFE parse (skip broken entries)
function safeParseList(items) {
  const parsed = [];
  for (const raw of items || []) {
    if (typeof raw !== "string") continue;
    try {
      const obj = JSON.parse(raw);
      if (
        obj &&
        typeof obj === "object" &&
        typeof obj.role === "string" &&
        typeof obj.content === "string"
      ) {
        parsed.push(obj);
      }
    } catch {
      // ❌ skip invalid JSON like "[object Object]"
      continue;
    }
  }
  return parsed;
}

export async function getContext(conversationId, limit = CONTEXT_MESSAGE_LIMIT) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  const items = await r.lrange(k, -limit, -1);
  return safeParseList(items);
}

export async function getContextLength(conversationId) {
  const r = getRedis();
  return await r.llen(bufferKey(conversationId));
}

/**
 * Lấy phần overflow (oldest messages) để đưa vào checkpoint summary:
 * - keepLast = 20 => lấy tất cả messages trừ 20 message cuối
 */
export async function getOverflowForSummary(
  conversationId,
  keepLast = CONTEXT_MESSAGE_LIMIT
) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  const len = await r.llen(k);
  const overflowCount = len - keepLast;

  if (overflowCount <= 0) return [];

  // old messages: index 0 .. overflowCount-1
  const raw = await r.lrange(k, 0, overflowCount - 1);
  return safeParseList(raw);
}

/**
 * Trim Redis buffer về chỉ còn keepLast messages (giữ đoạn “tail”).
 * Chỉ nên gọi khi bạn đã checkpoint summary thành công.
 */
export async function trimContextToLast(
  conversationId,
  keepLast = CONTEXT_MESSAGE_LIMIT
) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  if (!keepLast || keepLast <= 0) {
    await r.del(k);
    return;
  }

  await r.ltrim(k, -keepLast, -1);
  await r.expire(k, CONTEXT_TTL_SECONDS);
}

export async function clearContext(conversationId) {
  const r = getRedis();
  await r.del(bufferKey(conversationId));
}

export async function getSummary(conversationId) {
  const r = getRedis();
  const s = await r.get(summaryKey(conversationId));
  return typeof s === "string" && s.trim() ? s : null;
}

export async function setSummary(conversationId, summaryText) {
  const r = getRedis();
  const k = summaryKey(conversationId);

  const text = typeof summaryText === "string" ? summaryText.trim() : "";
  if (!text) return;

  await r.set(k, text);
  await r.expire(k, CONTEXT_TTL_SECONDS);
}

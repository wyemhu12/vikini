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

export const CONTEXT_MESSAGE_LIMIT = 20; // số message đưa vào model (user+assistant)
export const CONTEXT_TTL_SECONDS = 45 * 60; // 45 phút

function bufferKey(conversationId) {
  return `ctx:${conversationId}`;
}

function summaryKey(conversationId) {
  return `sum:${conversationId}`;
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
  // Keep last N
  await r.ltrim(k, -CONTEXT_MESSAGE_LIMIT * 5, -1);

  await r.expire(k, CONTEXT_TTL_SECONDS);
}

// Best-effort: remove last message if it matches role (used for regenerate)
export async function removeLastFromContextIfRole(conversationId, role) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  try {
    const last = await r.lrange(k, -1, -1);
    const raw = Array.isArray(last) ? last[0] : null;
    if (!raw) return { removed: false };

    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return { removed: false };
    }

    if (parsed?.role !== role) return { removed: false };

    await r.rpop(k);
    await r.expire(k, CONTEXT_TTL_SECONDS);
    return { removed: true };
  } catch {
    return { removed: false };
  }
}

export async function getContext(conversationId, limit = CONTEXT_MESSAGE_LIMIT) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  const raw = await r.lrange(k, -limit, -1);
  const messages = (raw || [])
    .map((x) => {
      try {
        return typeof x === "string" ? JSON.parse(x) : x;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  await r.expire(k, CONTEXT_TTL_SECONDS);
  return messages;
}

export async function getContextLength(conversationId) {
  const r = getRedis();
  const k = bufferKey(conversationId);
  try {
    const len = await r.llen(k);
    await r.expire(k, CONTEXT_TTL_SECONDS);
    return Number(len || 0);
  } catch {
    return 0;
  }
}

export async function getOverflowForSummary(conversationId, keepLast = CONTEXT_MESSAGE_LIMIT) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  const len = await getContextLength(conversationId);
  if (len <= keepLast) return [];

  const overflowCount = len - keepLast;
  const raw = await r.lrange(k, 0, overflowCount - 1);

  const messages = (raw || [])
    .map((x) => {
      try {
        return typeof x === "string" ? JSON.parse(x) : x;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return messages;
}

export async function trimContextToLast(conversationId, keepLast = CONTEXT_MESSAGE_LIMIT) {
  const r = getRedis();
  const k = bufferKey(conversationId);

  await r.ltrim(k, -keepLast, -1);
  await r.expire(k, CONTEXT_TTL_SECONDS);
}

export async function clearContext(conversationId) {
  const r = getRedis();
  const k = bufferKey(conversationId);
  await r.del(k);
  await r.del(summaryKey(conversationId));
}

export async function getSummary(conversationId) {
  const r = getRedis();
  const k = summaryKey(conversationId);
  try {
    const val = await r.get(k);
    return val ? String(val) : "";
  } catch {
    return "";
  }
}

export async function setSummary(conversationId, summaryText) {
  const r = getRedis();
  const k = summaryKey(conversationId);
  try {
    await r.set(k, String(summaryText || ""));
    await r.expire(k, CONTEXT_TTL_SECONDS);
  } catch {}
}

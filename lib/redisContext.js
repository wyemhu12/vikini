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

const TTL_SECONDS = 15 * 60; // 15 phút

function key(conversationId) {
  return `chat:${conversationId}:buffer`;
}

// 🔒 ALWAYS stringify
export async function appendToContext(conversationId, message) {
  const r = getRedis();
  const k = key(conversationId);

  const payload = JSON.stringify({
    role: message.role,
    content: message.content,
  });

  await r.rpush(k, payload);
  await r.expire(k, TTL_SECONDS);
}

// 🛡️ SAFE parse (skip broken entries)
export async function getContext(conversationId, limit = 12) {
  const r = getRedis();
  const k = key(conversationId);

  const items = await r.lrange(k, -limit, -1);

  const parsed = [];
  for (const raw of items) {
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

export async function clearContext(conversationId) {
  const r = getRedis();
  await r.del(key(conversationId));
}

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

export async function appendToContext(conversationId, message) {
  const r = getRedis();
  const k = key(conversationId);

  await r.rpush(k, JSON.stringify(message));
  await r.expire(k, TTL_SECONDS);
}

export async function getContext(conversationId, limit = 12) {
  const r = getRedis();
  const k = key(conversationId);

  const items = await r.lrange(k, -limit, -1);
  return items.map((x) => JSON.parse(x));
}

export async function clearContext(conversationId) {
  const r = getRedis();
  await r.del(key(conversationId));
}

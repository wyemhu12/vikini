// /app/api/conversations/validators.ts

import { NextRequest } from "next/server";

/**
 * Parse JSON body.
 * - If `fallback` is provided, invalid JSON will return `fallback`.
 * - If `fallback` is NOT provided, invalid JSON will throw (preserves current PATCH behavior).
 */
export async function parseJsonBody<T = unknown>(
  req: NextRequest,
  options?: { fallback?: T }
): Promise<T> {
  if (options?.fallback !== undefined) {
    return await req.json().catch(() => options.fallback as T);
  }
  return await req.json() as Promise<T>;
}


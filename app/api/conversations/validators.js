// /app/api/conversations/validators.js

/**
 * Parse JSON body.
 * - If `fallback` is provided, invalid JSON will return `fallback`.
 * - If `fallback` is NOT provided, invalid JSON will throw (preserves current PATCH behavior).
 */
export async function parseJsonBody(req, { fallback } = {}) {
  if (fallback !== undefined) {
    return await req.json().catch(() => fallback);
  }
  return await req.json();
}

// /app/api/conversations/validators.ts

import { NextRequest } from "next/server";
import { z } from "zod";

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
  return (await req.json()) as Promise<T>;
}

// Zod schemas for validation

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string().optional(),
});

export type CreateConversationRequest = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200).optional(),
  gemId: z.string().uuid().nullable().optional(),
  model: z.string().nullable().optional(),
});

export type UpdateConversationRequest = z.infer<typeof updateConversationSchema>;

export const deleteConversationSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteConversationRequest = z.infer<typeof deleteConversationSchema>;

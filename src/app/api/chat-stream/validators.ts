// /app/api/chat-stream/validators.ts

import { z } from "zod";

export const strataSamplingSchema = z.object({
  mode: z.enum(["default", "creative", "custom"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0.05).max(1).optional(),
  top_k: z.number().int().min(0).max(64).optional(),
  min_p: z.number().min(0).max(0.5).optional(),
  presence_penalty: z.number().min(0).max(2).optional(),
});

export const chatStreamRequestSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(100000),
  regenerate: z.boolean().optional(),
  truncateMessageId: z.string().uuid().optional().nullable(),
  truncateClientMessageId: z.string().max(100).optional().nullable(),
  clientMessageId: z.string().max(100).optional().nullable(),
  skipSaveUserMessage: z.boolean().optional(),
  thinkingLevel: z.enum(["off", "low", "medium", "high", "minimal"]).optional(),
  strataSampling: strataSamplingSchema.optional(),
  fileIds: z.array(z.string().uuid()).optional(),
});

export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;

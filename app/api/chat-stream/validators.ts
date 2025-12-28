// /app/api/chat-stream/validators.ts

import { z } from "zod";

export const chatStreamRequestSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(100000),
  regenerate: z.boolean().optional(),
  truncateMessageId: z.string().uuid().optional().nullable(),
  skipSaveUserMessage: z.boolean().optional(),
});

export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;


// /app/api/gems/validators.ts

import { z } from "zod";

export const createGemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  instruction: z.string().max(50000).optional(),
  instructions: z.string().max(50000).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
});

export type CreateGemRequest = z.infer<typeof createGemSchema>;

export const updateGemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  instruction: z.string().max(50000).optional(),
  instructions: z.string().max(50000).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
});

export type UpdateGemRequest = z.infer<typeof updateGemSchema>;

export const deleteGemSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteGemRequest = z.infer<typeof deleteGemSchema>;


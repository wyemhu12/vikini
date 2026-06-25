// /app/api/personas/validators.ts

import { z } from "zod";

const PERSONA_TONES = [
  "default",
  "professional",
  "friendly",
  "candid",
  "quirky",
  "efficient",
  "cynical",
  "lawyer",
] as const;

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  tone: z.enum(PERSONA_TONES).optional(),
  useEmojis: z.boolean().optional(),
  useHeadersLists: z.boolean().optional(),
  userContext: z.string().max(10000).optional(),
  customInstructions: z.string().max(50000).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
});

export type CreatePersonaRequest = z.infer<typeof createPersonaSchema>;

export const updatePersonaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  tone: z.enum(PERSONA_TONES).optional(),
  useEmojis: z.boolean().optional(),
  useHeadersLists: z.boolean().optional(),
  userContext: z.string().max(10000).optional(),
  customInstructions: z.string().max(50000).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
});

export type UpdatePersonaRequest = z.infer<typeof updatePersonaSchema>;

export const deletePersonaSchema = z.object({
  id: z.string().uuid(),
});

export type DeletePersonaRequest = z.infer<typeof deletePersonaSchema>;

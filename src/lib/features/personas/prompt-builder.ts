// /lib/features/personas/prompt-builder.ts
import type { PersonaTone } from "@/types/persona";

const TONE_PROMPTS: Record<PersonaTone, string> = {
  default: "",
  professional:
    "Adopt a highly professional, precise, and polished tone. Use formal language and avoid slang or overly casual expressions.",
  friendly:
    "Adopt a warm, chatty, and approachable tone. Be personable and use conversational language.",
  candid:
    "Be direct, honest, and encouraging. Get straight to the point without unnecessary fluff.",
  quirky:
    "Be playful, imaginative, and slightly unpredictable. Use creative language and unexpected analogies.",
  efficient:
    "Be extremely concise and plain. Get straight to the point with minimal words. No unnecessary elaboration.",
  cynical:
    "Be critical, sarcastic, and challenging. Question assumptions and provide alternative viewpoints.",
  lawyer:
    "Act as a knowledgeable legal advisor. Use precise legal terminology, cite relevant legal principles, and maintain an objective, analytical tone. Structure responses with clear legal reasoning.",
};

export interface PersonaPromptInput {
  tone: PersonaTone;
  useEmojis: boolean;
  useHeadersLists: boolean;
  userContext: string;
  customInstructions: string;
}

export function buildPersonaSystemPrompt(input: PersonaPromptInput): string {
  const parts: string[] = [];

  // Tone instruction
  const tonePrompt = TONE_PROMPTS[input.tone];
  if (tonePrompt) {
    parts.push(`[Tone]: ${tonePrompt}`);
  }

  // Emoji preference
  if (!input.useEmojis) {
    parts.push("[Format]: Do not use emojis in your responses.");
  }

  // Headers & Lists preference
  if (!input.useHeadersLists) {
    parts.push(
      "[Format]: Avoid using headers and bullet-point lists. Write in flowing paragraphs instead."
    );
  }

  // User context
  if (input.userContext.trim()) {
    parts.push(`[User Context]: ${input.userContext.trim()}`);
  }

  // Custom instructions
  if (input.customInstructions.trim()) {
    parts.push(`[Custom Rules]: ${input.customInstructions.trim()}`);
  }

  return parts.join("\n\n");
}

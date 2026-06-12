// /app/api/chat-stream/streaming/thought-signatures.ts
import {
  DUMMY_THOUGHT_SIGNATURE,
  type Message,
  type MessagePart,
  type MappedMessage,
} from "./types";

/**
 * Maps context messages to Gemini API format.
 * Handles Gemini 3 thought signatures for multi-turn reasoning continuity.
 *
 * Per Gemini 3 docs:
 * - Text/Chat: signatures not strictly validated but improve reasoning quality
 * - Function Calling: strictly validated, missing = 400 error
 * - Image Generation: strictly validated on all parts
 */
export function mapMessages(
  messages: Message[],
  useGemini3Fallback: boolean = false
): MappedMessage[] {
  return messages.map((m) => {
    const part: MessagePart = { text: m.content };

    // Only inject signatures for model/assistant messages
    if (m.role === "assistant") {
      // Priority: new array format > legacy single > fallback dummy
      const signatures =
        m.thoughtSignatures ?? (m.thoughtSignature ? [m.thoughtSignature] : undefined);

      if (signatures && signatures.length > 0) {
        // Use the last signature for the text part (most recent reasoning chain)
        part.thoughtSignature = signatures[signatures.length - 1];
      } else if (useGemini3Fallback) {
        // Fallback for model migration: inject dummy signature to bypass strict validation
        part.thoughtSignature = DUMMY_THOUGHT_SIGNATURE;
      }
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [part],
    };
  });
}

/**
 * Extract thoughtSignature from Gemini API response.
 * For streaming, the signature may come in the final chunk.
 * Returns the last found signature (most recent).
 * @deprecated Use extractAllThoughtSignatures for multi-step function calling support
 */
export function extractThoughtSignature(respOrChunk: unknown): string | undefined {
  try {
    const obj = respOrChunk as {
      thoughtSignature?: string;
      candidates?: unknown[];
    };

    // Direct signature on response
    if (typeof obj?.thoughtSignature === "string" && obj.thoughtSignature) {
      return obj.thoughtSignature;
    }

    // Check in candidates -> content -> parts
    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        // Get the last signature found in parts
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i] as { thoughtSignature?: string };
          if (typeof p.thoughtSignature === "string" && p.thoughtSignature) {
            return p.thoughtSignature;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Extract ALL thoughtSignatures from Gemini API response chunk.
 * For multi-step function calling (sequential), multiple signatures may exist.
 * Per Gemini 3 docs: parallel calls only have signature on first functionCall,
 * but sequential calls have signatures on each step.
 *
 * @returns Array of unique signatures found in the chunk (preserves order)
 */
export function extractAllThoughtSignatures(respOrChunk: unknown): string[] {
  const signatures: string[] = [];
  const seen = new Set<string>();

  try {
    const obj = respOrChunk as {
      thoughtSignature?: string;
      candidates?: unknown[];
    };

    // Direct signature on response
    if (
      typeof obj?.thoughtSignature === "string" &&
      obj.thoughtSignature &&
      !seen.has(obj.thoughtSignature)
    ) {
      signatures.push(obj.thoughtSignature);
      seen.add(obj.thoughtSignature);
    }

    // Check in candidates -> content -> parts (collect ALL signatures)
    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const p = part as { thoughtSignature?: string };
          if (
            typeof p.thoughtSignature === "string" &&
            p.thoughtSignature &&
            !seen.has(p.thoughtSignature)
          ) {
            signatures.push(p.thoughtSignature);
            seen.add(p.thoughtSignature);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return signatures;
}

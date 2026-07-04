// /app/api/chat-stream/streaming/index.ts
// Barrel re-exports - preserves the original public API of streaming.ts

export { createChatReadableStream } from "./gemini-stream";
export { createOpenAICompatibleStream } from "./openai-stream";
export { createDeepSeekStream } from "./deepseek-stream";
export { createAnthropicStream } from "./anthropic-stream";
export { sendEvent, safeText, isGemini3Model } from "./utils";
export {
  mapMessages,
  extractAllThoughtSignatures,
  extractThoughtSignature,
} from "./thought-signatures";
export { DUMMY_THOUGHT_SIGNATURE } from "./types";
export type { ChatStreamParams } from "./types";

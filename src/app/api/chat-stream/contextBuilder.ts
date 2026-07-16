// /app/api/chat-stream/contextBuilder.ts

import { getRecentMessages, type Message } from "@/lib/features/chat/messages";
import { pickFirstEnv } from "@/lib/utils/config";
import { getAllDeclarations } from "@/lib/features/chat/functionRegistry";
import {
  coreLogger,
  estimateTokens,
  envFlag,
  stripOuterQuotes,
  type MessageContext,
} from "./chatStreamHelpers";
import { mapMessages } from "./streaming";

export async function buildMessageContext(
  conversationId: string,
  content: string,
  sysPrompt: string,
  modelLimitTokens: number
): Promise<MessageContext> {
  let contextMessages: Array<{ role: string; content: string }> = [];
  let contents: Array<{ role: string; parts: unknown[] }> = [
    { role: "user", parts: [{ text: content }] },
  ];
  let currentTokenCount = estimateTokens(content) + estimateTokens(sysPrompt);

  try {
    const fetchLimit = 200; // Increased for long-context models
    const rows = await getRecentMessages(conversationId, fetchLimit);

    const validRows = (Array.isArray(rows) ? rows : []).filter(
      (m): m is Message =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim().length > 0
    );

    const messagesToKeep: Array<{ role: string; content: string }> = [];
    // Adaptive safety buffer: smaller for large context models (1M+)
    const safetyBuffer = modelLimitTokens >= 500000 ? 2000 : 4000;

    // Process from newest to oldest
    for (let i = validRows.length - 1; i >= 0; i--) {
      const msg = validRows[i];
      const msgTokens = estimateTokens(msg.content);

      if (currentTokenCount + msgTokens < modelLimitTokens - safetyBuffer) {
        messagesToKeep.unshift({ role: msg.role, content: msg.content });
        currentTokenCount += msgTokens;
      } else {
        coreLogger.info(
          `Context limit reached: ${currentTokenCount} tokens used. Skipping older messages.`
        );
        break;
      }
    }

    contextMessages = messagesToKeep;
    const mapped = mapMessages(contextMessages);
    if (Array.isArray(mapped) && mapped.length > 0) {
      contents = mapped as Array<{ role: string; parts: unknown[] }>;
    }
  } catch (e) {
    coreLogger.error("Context load error:", e);
    // fallback empty context
  }

  return {
    contextMessages,
    contents,
    currentTokenCount,
  };
}

export function getWebSearchConfig(cookies: Record<string, string>): {
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
} {
  const WEB_SEARCH_AVAILABLE = envFlag(process.env.WEB_SEARCH_ENABLED, false);
  const cookieWeb = cookies?.webSearchEnabled ?? cookies?.webSearch ?? "";
  const cookieAlways = cookies?.alwaysSearch ?? "";

  let enableWebSearch: boolean;

  if (cookieAlways === "1") {
    // If Always Search is ON, force enable unless backend disabled it entirely
    enableWebSearch = WEB_SEARCH_AVAILABLE;
  } else {
    // Standard preference logic
    enableWebSearch = cookieWeb === "1" ? true : cookieWeb === "0" ? false : WEB_SEARCH_AVAILABLE;
  }

  return { enableWebSearch, WEB_SEARCH_AVAILABLE };
}

export function setupToolsAndSafety(
  enableWebSearch: boolean,
  WEB_SEARCH_AVAILABLE: boolean,
  model: string
): {
  tools: Array<Record<string, unknown>>;
  safetySettings: unknown[] | null;
  toolConfig: Record<string, unknown> | undefined;
} {
  const tools: Array<Record<string, unknown>> = [];
  const isGemini3 = model.startsWith("gemini-3");
  const useGoogleSearch = enableWebSearch && WEB_SEARCH_AVAILABLE;

  if (useGoogleSearch) {
    tools.push({ googleSearch: {} });
  }

  // Gemini 3+ supports combining googleSearch with other tools via Tool Context Circulation.
  // Requires includeServerSideToolInvocations: true in toolConfig.
  // Gemini 2.5 CANNOT mix googleSearch with codeExecution/functionDeclarations - send search alone.
  if (isGemini3 || !useGoogleSearch) {
    tools.push({ codeExecution: {} });
    const declarations = getAllDeclarations();
    if (declarations.length > 0) {
      tools.push({ functionDeclarations: declarations });
    }
  }

  // Enable Tool Context Circulation for Gemini 3 when mixing built-in + custom tools
  // https://ai.google.dev/gemini-api/docs/tool-combination
  const toolConfig =
    isGemini3 && useGoogleSearch ? { includeServerSideToolInvocations: true } : undefined;

  let safetySettings: unknown[] | null = null;
  const safetyJson = pickFirstEnv(["GEMINI_SAFETY_SETTINGS_JSON"]);
  if (safetyJson) {
    try {
      const parsed = JSON.parse(stripOuterQuotes(safetyJson));
      if (Array.isArray(parsed) && parsed.length > 0) safetySettings = parsed;
    } catch {
      // ignore
    }
  }

  return { tools, safetySettings, toolConfig };
}

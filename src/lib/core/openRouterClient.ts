import OpenAI from "openai";

let cachedClient: OpenAI | null = null;
let cachedApiKey = "";

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API configuration is missing (OPENROUTER_API_KEY)");
  }

  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://vikini.app", // Optional, better for rankings
      "X-Title": "Vikini",
    },
  });
  cachedApiKey = apiKey;
  return cachedClient;
}

export function resetOpenRouterClientForTests(): void {
  cachedClient = null;
  cachedApiKey = "";
}

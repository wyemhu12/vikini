import OpenAI from "openai";

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API configuration is missing (OPENROUTER_API_KEY)");
  }
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://vikini.app", // Optional, better for rankings
      "X-Title": "Vikini",
    },
  });
}

import OpenAI from "openai";

let cachedClient: OpenAI | null = null;
let cachedApiKey = "";

export function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DeepSeek API configuration missing (DEEPSEEK_API_KEY)");
  }

  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
  cachedApiKey = apiKey;
  return cachedClient;
}

export function resetDeepSeekClientForTests(): void {
  cachedClient = null;
  cachedApiKey = "";
}

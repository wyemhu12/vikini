import OpenAI from "openai";

export function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API configuration missing (DEEPSEEK_API_KEY)");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
}

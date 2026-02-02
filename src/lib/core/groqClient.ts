import "@/lib/env";
import OpenAI from "openai";

let cachedClient: OpenAI | null = null;
let cachedKey = "";

export function getGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY || process.env.LLAMA3_API_KEY; // Support both naming conventions

  if (!apiKey) {
    throw new Error("Groq API configuration is missing (GROQ_API_KEY or LLAMA3_API_KEY)");
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  cachedKey = apiKey;

  return cachedClient;
}

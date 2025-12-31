import "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;
let cachedKey = "";

/**
 * Get Anthropic Claude API client.
 *
 * To get your API key:
 * 1. Go to https://console.anthropic.com/
 * 2. Sign up or log in
 * 3. Navigate to "API Keys" section
 * 4. Create a new API key
 * 5. Add to .env: ANTHROPIC_API_KEY=your_key_here
 *
 * Free tier: $10/month, 5 req/min, 20K tokens/min
 */
export function getClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Anthropic Claude API configuration is missing (ANTHROPIC_API_KEY). " +
        "Get your API key at https://console.anthropic.com/"
    );
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new Anthropic({
    apiKey: apiKey,
  });
  cachedKey = apiKey;

  return cachedClient;
}

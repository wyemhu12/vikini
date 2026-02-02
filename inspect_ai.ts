import { getGenAIClient } from "@/lib/core/genaiClient";
import dotenv from "dotenv";
dotenv.config();

interface AIClientWithModels {
  models?: Record<string, unknown>;
}

async function test() {
  try {
    const ai = getGenAIClient() as unknown as AIClientWithModels;
    console.warn("AI Client Structure:", Object.keys(ai));
    if (ai.models) {
      console.warn("AI Models Structure:", Object.keys(ai.models));
    }

    // Testing getModelMaxOutputTokens
    const { getModelMaxOutputTokens } = require("@/lib/core/modelRegistry");
    console.warn("Max tokens for gemini-2.5-flash:", getModelMaxOutputTokens("gemini-2.5-flash"));
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();

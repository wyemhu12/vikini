// lib/utils/config.ts

// Re-export translations for backward compatibility
export {
  translations,
  tVi,
  tEn,
  type TranslationKey,
  type TranslationValue,
  type Translations,
  type TranslationSet,
} from "./translations";

export function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

import { randomUUID } from "crypto";

export interface CreateChatResult {
  id: string;
  messages: never[];
  createdAt: number;
  title: string;
  autoTitled: boolean;
  renamed: boolean;
}

export function createChat(lang: "vi" | "en"): CreateChatResult {
  return {
    id: randomUUID(),
    messages: [],
    createdAt: Date.now(),
    title: lang === "vi" ? "Cuộc trò chuyện mới" : "New Chat",
    autoTitled: false,
    renamed: false,
  };
}

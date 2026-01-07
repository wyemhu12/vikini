import { create } from "zustand";

// Define the store type
interface LanguageState {
  language: "vi" | "en";
  setLanguage: (lang: "vi" | "en") => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "en", // Default to English
  setLanguage: (lang) => set({ language: lang }),
}));

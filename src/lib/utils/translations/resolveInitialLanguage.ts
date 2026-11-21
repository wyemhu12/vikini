export const LANGUAGE_STORAGE_KEY = "vikini-language";

export type ResolvedLanguage = "vi" | "en";

/**
 * Pure language resolver with zero React/Zustand dependencies so it can be shared
 * between LanguageUpdater and GlobalErrorView (which renders outside RootLayout).
 */
export function resolveInitialLanguage(
  stored: string | null,
  navigatorLang?: string
): ResolvedLanguage {
  if (stored === "vi" || stored === "en") return stored;
  if (stored && stored.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(stored);
      const lang =
        typeof parsed === "object" &&
        parsed !== null &&
        "state" in parsed &&
        typeof (parsed as { state?: { language?: unknown } }).state?.language === "string"
          ? (parsed as { state: { language: string } }).state.language
          : null;
      if (lang === "vi" || lang === "en") return lang;
    } catch {
      // Ignore malformed JSON and fall through to navigator language
    }
  }
  return navigatorLang?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

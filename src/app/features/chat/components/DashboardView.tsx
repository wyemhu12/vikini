// /app/features/chat/components/DashboardView.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "../hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, GraduationCap, CodeXml, BarChart3, Sparkles, ChevronRight, X } from "lucide-react";
import { DURATION, EASE } from "@/lib/utils/motion";
import type { TranslationKey } from "@/lib/utils/config";

interface DashboardViewProps {
  onPromptSelect?: (prompt: string) => void;
  onPromptPreview?: (prompt: string | null) => void;
  onActivateImageMode?: () => void;
  children?: React.ReactNode; // Slot for ChatControls between greeting and chips
}

interface SuggestionItem {
  labelKey: TranslationKey;
  promptKey: TranslationKey | null;
}

interface SuggestionCategory {
  id: string;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  suggestions: SuggestionItem[];
}

/** Flattens multi-line prompts into a single line so hover previews never grow the composer. */
export function toSingleLinePreview(prompt: string): string {
  return prompt.replace(/\s*\n+\s*/g, " ").trim();
}

const CATEGORIES: SuggestionCategory[] = [
  {
    id: "write",
    labelKey: "catWrite",
    icon: <Pencil className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugWriteEmail", promptKey: "promptWriteEmail" },
      { labelKey: "sugWriteEssay", promptKey: "promptWriteEssay" },
      { labelKey: "sugWriteStory", promptKey: "promptWriteStory" },
      { labelKey: "sugWriteSummary", promptKey: "promptWriteSummary" },
      { labelKey: "sugWriteProduct", promptKey: "promptWriteProduct" },
    ],
  },
  {
    id: "learn",
    labelKey: "catLearn",
    icon: <GraduationCap className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugLearnExplain", promptKey: "promptLearnExplain" },
      { labelKey: "sugLearnBooks", promptKey: "promptLearnBooks" },
      { labelKey: "sugLearnLesson", promptKey: "promptLearnLesson" },
      { labelKey: "sugLearnQuiz", promptKey: "promptLearnQuiz" },
      { labelKey: "sugLearnLanguage", promptKey: "promptLearnLanguage" },
    ],
  },
  {
    id: "code",
    labelKey: "catCode",
    icon: <CodeXml className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugCodeReview", promptKey: "promptCodeReview" },
      { labelKey: "sugCodeDebug", promptKey: "promptCodeDebug" },
      { labelKey: "sugCodeArchitecture", promptKey: "promptCodeArchitecture" },
      { labelKey: "sugCodeAlgorithm", promptKey: "promptCodeAlgorithm" },
      { labelKey: "sugCodeApi", promptKey: "promptCodeApi" },
    ],
  },
  {
    id: "analyze",
    labelKey: "catAnalyze",
    icon: <BarChart3 className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugAnalyzeData", promptKey: "promptAnalyzeData" },
      { labelKey: "sugAnalyzeDecision", promptKey: "promptAnalyzeDecision" },
      { labelKey: "sugAnalyzeMarket", promptKey: "promptAnalyzeMarket" },
      { labelKey: "sugAnalyzeCompare", promptKey: "promptAnalyzeCompare" },
      { labelKey: "sugAnalyzeTrend", promptKey: "promptAnalyzeTrend" },
    ],
  },
  {
    id: "create",
    labelKey: "catCreate",
    icon: <Sparkles className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugCreateImage", promptKey: null }, // Special: activates image mode
      { labelKey: "sugCreateBrand", promptKey: "promptCreateBrand" },
      { labelKey: "sugCreateIdea", promptKey: "promptCreateIdea" },
      { labelKey: "sugCreatePlan", promptKey: "promptCreatePlan" },
      { labelKey: "sugCreatePresentation", promptKey: "promptCreatePresentation" },
    ],
  },
];

export default function DashboardView({
  onPromptSelect,
  onPromptPreview,
  onActivateImageMode,
  children,
}: DashboardViewProps) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<number | null>(null);

  const getGreetingKey = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "greetingMorning";
    if (hour < 18) return "greetingAfternoon";
    return "greetingEvening";
  }, []);

  const [greetingKey, setGreetingKey] = useState(getGreetingKey);

  // Update greeting in real-time (check every 60s)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setGreetingKey(getGreetingKey());
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [getGreetingKey]);

  const userName = session?.user?.name || t("user") || "User";
  const activeCat = CATEGORIES.find((c) => c.id === activeCategory);

  const handleCategoryClick = useCallback(
    (catId: string) => {
      setActiveCategory((prev) => (prev === catId ? null : catId));
      setHoveredSuggestion(null);
      onPromptPreview?.(null);
    },
    [onPromptPreview]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: SuggestionItem) => {
      onPromptPreview?.(null);
      if (suggestion.labelKey === "sugCreateImage" || !suggestion.promptKey) {
        onActivateImageMode?.();
        setActiveCategory(null);
        return;
      }
      onPromptSelect?.(t(suggestion.promptKey));
      setActiveCategory(null);
    },
    [onPromptSelect, onActivateImageMode, onPromptPreview, t]
  );

  const handleSuggestionHover = useCallback(
    (promptKey: TranslationKey | null) => {
      if (!promptKey) {
        onPromptPreview?.(null);
        return;
      }
      onPromptPreview?.(toSingleLinePreview(t(promptKey)));
    },
    [onPromptPreview, t]
  );

  return (
    <div className="flex flex-col items-center w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-0 md:px-6">
      {/* ── Greeting Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.EXIT }}
        className="text-center mb-8 flex flex-col items-center"
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold bg-gradient-to-r from-(--text) via-(--accent) to-(--muted) bg-clip-text text-transparent leading-tight tracking-[-0.03em] text-balance">
          {t(greetingKey)}, {userName}
        </h2>
        <p className="mt-2 text-sm md:text-base text-(--muted)">{t("landingSubtitle")}</p>
      </motion.div>

      {/* ── Slot: ChatControls goes here ── */}
      {children && <div className="w-full mb-3">{children}</div>}

      {/* ── Suggestion Chips + Dropdown wrapper ── */}
      <div className="relative w-full flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.NORMAL, delay: 0.05, ease: EASE.EXIT }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-expanded={isActive}
                onClick={() => handleCategoryClick(cat.id)}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                  transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out border active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)
                  ${
                    isActive
                      ? "bg-(--accent)/15 text-(--accent) border-(--accent)/40 shadow-[0_0_12px_var(--glow)]"
                      : "bg-(--raised)/50 text-(--muted) border-(--line) hover:bg-(--raised) hover:text-(--text) hover:border-(--accent)/20"
                  }
                `}
              >
                {cat.icon}
                <span>{t(cat.labelKey)}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ── Suggestions Dropdown Panel (absolute so it doesn't push content) ── */}
        <AnimatePresence mode="wait">
          {activeCat && (
            <motion.div
              key={activeCat.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DURATION.FAST, ease: EASE.EXIT }}
              className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-2 z-(--z-popover)"
            >
              <div className="rounded-2xl border border-(--line) bg-(--surface)/95 backdrop-blur-2xl shadow-(--shadow-elevated) overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-(--line)">
                  <div className="flex items-center gap-2 text-(--accent) text-sm font-semibold">
                    {activeCat.icon}
                    <span>{t(activeCat.labelKey)}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={t("close")}
                    onClick={() => {
                      setActiveCategory(null);
                      onPromptPreview?.(null);
                    }}
                    className="p-1 rounded-full text-(--muted) hover:text-(--text) hover:bg-(--raised) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <X aria-hidden className="w-4 h-4" />
                  </button>
                </div>

                {/* Suggestions List */}
                <div
                  className="py-1"
                  onMouseLeave={() => {
                    setHoveredSuggestion(null);
                    handleSuggestionHover(null);
                  }}
                >
                  {activeCat.suggestions.map((sug, idx) => (
                    <button
                      key={sug.labelKey}
                      type="button"
                      onMouseEnter={() => {
                        setHoveredSuggestion(idx);
                        handleSuggestionHover(sug.promptKey);
                      }}
                      onClick={() => handleSuggestionClick(sug)}
                      className={`
                        w-full flex items-center justify-between px-4 py-3 text-left text-sm
                        transition-[background-color,color] duration-150 group cursor-pointer focus-visible:outline-none focus-visible:bg-(--raised)
                        ${
                          hoveredSuggestion === idx
                            ? "bg-(--soft) text-(--text)"
                            : "text-(--muted) hover:text-(--text)"
                        }
                      `}
                    >
                      <span className="flex-1 truncate">{t(sug.labelKey)}</span>
                      <ChevronRight
                        aria-hidden
                        className={`w-4 h-4 shrink-0 ml-2 transition-[opacity,transform,color] duration-150 ${
                          hoveredSuggestion === idx
                            ? "opacity-100 translate-x-0 text-(--accent)"
                            : "opacity-0 -translate-x-1"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

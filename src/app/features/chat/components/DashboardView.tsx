// /app/features/chat/components/DashboardView.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "../hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, GraduationCap, CodeXml, BarChart3, Sparkles, ChevronRight, X } from "lucide-react";

interface DashboardViewProps {
  onPromptSelect?: (prompt: string) => void;
  onPromptPreview?: (prompt: string | null) => void;
  onActivateImageMode?: () => void;
  children?: React.ReactNode; // Slot for ChatControls between greeting and chips
}

interface SuggestionCategory {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  suggestions: { labelKey: string; prompt: string }[];
}

const CATEGORIES: SuggestionCategory[] = [
  {
    id: "write",
    labelKey: "catWrite",
    icon: <Pencil className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugWriteEmail", prompt: "Help me draft a professional email about " },
      { labelKey: "sugWriteEssay", prompt: "Write an essay or blog post about " },
      { labelKey: "sugWriteStory", prompt: "Write a creative short story about " },
      { labelKey: "sugWriteSummary", prompt: "Summarize the following document:\n\n" },
      { labelKey: "sugWriteProduct", prompt: "Write a compelling product description for " },
    ],
  },
  {
    id: "learn",
    labelKey: "catLearn",
    icon: <GraduationCap className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugLearnExplain", prompt: "Explain in simple terms: " },
      { labelKey: "sugLearnBooks", prompt: "Recommend the best books about " },
      { labelKey: "sugLearnLesson", prompt: "Design a lesson plan or curriculum for " },
      { labelKey: "sugLearnQuiz", prompt: "Create review questions about " },
      { labelKey: "sugLearnLanguage", prompt: "Help me practice and learn " },
    ],
  },
  {
    id: "code",
    labelKey: "catCode",
    icon: <CodeXml className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugCodeReview", prompt: "Review and optimize this code:\n\n" },
      { labelKey: "sugCodeDebug", prompt: "Help me debug this error:\n\n" },
      { labelKey: "sugCodeArchitecture", prompt: "Design system architecture for " },
      { labelKey: "sugCodeAlgorithm", prompt: "Explain the algorithm for " },
      { labelKey: "sugCodeApi", prompt: "Design a REST API for " },
    ],
  },
  {
    id: "analyze",
    labelKey: "catAnalyze",
    icon: <BarChart3 className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugAnalyzeData", prompt: "Analyze this data and find insights:\n\n" },
      { labelKey: "sugAnalyzeDecision", prompt: "Help me analyze the decision between " },
      { labelKey: "sugAnalyzeMarket", prompt: "Research market trends for " },
      { labelKey: "sugAnalyzeCompare", prompt: "Compare the pros and cons of " },
      { labelKey: "sugAnalyzeTrend", prompt: "Analyze the trends in " },
    ],
  },
  {
    id: "create",
    labelKey: "catCreate",
    icon: <Sparkles className="w-4 h-4" />,
    suggestions: [
      { labelKey: "sugCreateImage", prompt: "" }, // Special: activates image mode
      { labelKey: "sugCreateBrand", prompt: "Help me build a brand identity for " },
      { labelKey: "sugCreateIdea", prompt: "Brainstorm creative ideas for " },
      { labelKey: "sugCreatePlan", prompt: "Create a detailed project plan for " },
      { labelKey: "sugCreatePresentation", prompt: "Create presentation content about " },
    ],
  },
];

/** Get greeting key based on current hour */
function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

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
  }, []);

  const userName = session?.user?.name || "User";
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
    (suggestion: { labelKey: string; prompt: string }) => {
      onPromptPreview?.(null);
      if (suggestion.labelKey === "sugCreateImage") {
        onActivateImageMode?.();
        setActiveCategory(null);
        return;
      }
      onPromptSelect?.(suggestion.prompt);
      setActiveCategory(null);
    },
    [onPromptSelect, onActivateImageMode, onPromptPreview]
  );

  const handleSuggestionHover = useCallback(
    (prompt: string | null) => {
      onPromptPreview?.(prompt);
    },
    [onPromptPreview]
  );

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto px-4">
      {/* ── Greeting Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold bg-gradient-to-r from-(--text-primary) via-(--accent) to-(--text-secondary) bg-clip-text text-transparent leading-tight tracking-tight">
          {t(greetingKey)}, {userName}
        </h1>
        <p className="mt-2 text-sm md:text-base text-(--text-secondary)">{t("landingSubtitle")}</p>
      </motion.div>

      {/* ── Slot: ChatControls goes here ── */}
      {children && <div className="w-full mb-3">{children}</div>}

      {/* ── Suggestion Chips + Dropdown wrapper ── */}
      <div className="relative w-full flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-200 border
                ${
                  isActive
                    ? "bg-(--accent)/15 text-(--accent) border-(--accent)/40 shadow-[0_0_12px_var(--glow)]"
                    : "bg-(--surface-muted)/50 text-(--text-secondary) border-(--border) hover:bg-(--control-bg-hover) hover:text-(--text-primary) hover:border-(--accent)/20"
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
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-2 z-50"
            >
              <div className="rounded-2xl border border-(--border) bg-(--surface-muted)/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
                  <div className="flex items-center gap-2 text-(--accent) text-sm font-semibold">
                    {activeCat.icon}
                    <span>{t(activeCat.labelKey)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveCategory(null);
                      onPromptPreview?.(null);
                    }}
                    className="p-1 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Suggestions List */}
                <div className="py-1">
                  {activeCat.suggestions.map((sug, idx) => (
                    <button
                      key={sug.labelKey}
                      onMouseEnter={() => {
                        setHoveredSuggestion(idx);
                        handleSuggestionHover(sug.prompt || null);
                      }}
                      onMouseLeave={() => {
                        setHoveredSuggestion(null);
                        handleSuggestionHover(null);
                      }}
                      onClick={() => handleSuggestionClick(sug)}
                      className={`
                      w-full flex items-center justify-between px-4 py-3 text-left text-sm
                      transition-all duration-150 group cursor-pointer
                      ${
                        hoveredSuggestion === idx
                          ? "bg-(--accent)/10 text-(--text-primary)"
                          : "text-(--text-secondary) hover:text-(--text-primary)"
                      }
                    `}
                    >
                      <span className="flex-1 truncate">{t(sug.labelKey)}</span>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ml-2 transition-all duration-200 ${
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
      {/* end chips + dropdown wrapper */}
    </div>
  );
}

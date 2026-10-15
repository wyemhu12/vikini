// /app/features/novelcrafter/components/InlineStoryBibleSection.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { TRANSITION } from "@/lib/utils/motion";
import type { StoryBible } from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import StoryBibleWorkspace from "./StoryBibleWorkspace";

interface InlineStoryBibleSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  activeSection?: NovelcrafterBibleSectionId;
  jumpRequest?: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
}

export default function InlineStoryBibleSection({
  isOpen,
  onToggle,
  storyBible,
  onUpdateStoryBible,
  activeSection,
  jumpRequest,
  isStreaming,
  onTriggerStream,
}: InlineStoryBibleSectionProps) {
  const { t } = useLanguage();
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleAnimationComplete = () => {
    if (!jumpRequest?.section) return;
    const el = document.getElementById(`bible-section-${jumpRequest.section}`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl pt-6 pb-12 space-y-4">
      {/* Divider & Header */}
      <div className="flex items-center justify-between gap-3 border-t border-(--border) pt-6 flex-wrap">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="inline-flex items-center gap-2.5 text-left rounded-xl px-2 py-1 hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <div className="p-1.5 rounded-lg bg-(--control-bg) text-(--accent) shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-(--text-primary) flex items-center gap-1.5">
              <span>{t("novelcrafterStoryBibleTitle")}</span>
              <span className="text-xs font-normal text-(--text-secondary) hidden sm:inline">
                ({isOpen ? t("novelcrafterCollapseBible") : t("novelcrafterExpandBible")})
              </span>
            </h3>
            <p className="text-xs text-(--text-secondary) leading-tight">
              {t("novelcrafterStoryBibleSubtitle")}
            </p>
          </div>
          <span className="ml-1 text-(--text-secondary)">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="px-3 py-1 rounded-full border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary)"
        >
          {isOpen ? t("novelcrafterCollapseBible") : t("novelcrafterExpandBible")}
        </button>
      </div>

      {/* Accordion Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION.FAST}
            onAnimationComplete={handleAnimationComplete}
            className="overflow-hidden"
          >
            <StoryBibleWorkspace
              storyBible={storyBible}
              onUpdateStoryBible={onUpdateStoryBible}
              activeSection={activeSection}
              jumpRequest={jumpRequest}
              embedded={true}
              onClose={onToggle}
              isStreaming={isStreaming}
              onTriggerStream={onTriggerStream}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

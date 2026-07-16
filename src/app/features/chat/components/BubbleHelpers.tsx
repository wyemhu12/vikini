// ChatBubble helper components — extracted from ChatBubble.tsx
// Contains TypingDots, TypingCursor, ThinkingBlock animations

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Brain } from "lucide-react";

// ============================================
// Typing Dots (loading animation)
// ============================================

export const TypingDots = React.memo(function TypingDots() {
  const dotVariants = {
    initial: { y: 0, opacity: 0.4 },
    animate: { y: -4, opacity: 1 },
  };

  return (
    <motion.div
      className="typing-dots flex items-center gap-1.5 px-2 py-2"
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.15 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          variants={dotVariants}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          className="w-1.5 h-1.5 bg-secondary rounded-full"
        />
      ))}
    </motion.div>
  );
});

// ============================================
// Typing Cursor (blinking during streaming)
// ============================================

export const TypingCursor = React.memo(function TypingCursor() {
  return (
    <motion.span
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      className="inline-block w-0.5 h-4 bg-(--primary) ml-0.5 align-middle rounded-sm"
      aria-hidden="true"
    />
  );
});

// ============================================
// Thinking Block (collapsible reasoning)
// ============================================

export const ThinkingBlock = React.memo(function ThinkingBlock({
  content,
  t,
}: {
  content: string;
  t: (key: string) => string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes (while expanded)
  useEffect(() => {
    if (!isCollapsed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isCollapsed]);

  return (
    <div className="mb-4 rounded-lg border border-(--border) overflow-hidden bg-(--control-bg)">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary hover:text-primary hover:bg-(--control-bg-hover) transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>{t("thinkingProcess") || "Thinking Process"}</span>
        <motion.div
          className="ml-auto"
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 opacity-50" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="px-3 py-3 border-t border-(--border) text-sm text-secondary font-mono leading-relaxed bg-(--surface-muted)/50 whitespace-pre-wrap max-h-96 overflow-y-auto"
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

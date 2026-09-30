"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ScrollToBottomButtonProps {
  isAtBottom: boolean;
  unreadCount?: number;
  onClick: () => void;
  className?: string;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  isAtBottom,
  unreadCount = 0,
  onClick,
  className,
}) => {
  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.button
          type="button"
          onClick={onClick}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          aria-label={
            unreadCount > 0 ? `Scroll to bottom (${unreadCount} unread)` : "Scroll to bottom"
          }
          className={cn(
            "relative flex items-center justify-center p-2.5 rounded-full",
            "bg-(--surface-elevated)/90 hover:bg-(--surface-elevated)",
            "text-(--text-primary) border border-(--border)",
            "shadow-lg hover:shadow-xl backdrop-blur-md",
            "transition-colors duration-200 cursor-pointer outline-none",
            "focus-visible:ring-2 focus-visible:ring-(--accent)",
            className
          )}
        >
          <ChevronDown className="w-4 h-4 text-(--text-secondary) hover:text-(--text-primary)" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 flex items-center justify-center",
                "min-w-4.5 h-4.5 px-1 rounded-full",
                "bg-(--accent) text-(--accent-foreground)",
                "text-[10px] font-bold leading-none shadow-sm"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default ScrollToBottomButton;

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

interface FloatingMenuTriggerProps {
  onClick?: (e: React.MouseEvent | MouseEvent | TouchEvent | PointerEvent) => void;
  className?: string;
}

export default function FloatingMenuTrigger({ onClick, className }: FloatingMenuTriggerProps) {
  const { t } = useLanguage();
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);

  // Reset idle timer on interaction
  const resetIdleTimer = () => {
    setIsIdle(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 3000); // 3 seconds to dim
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <motion.button
      type="button"
      aria-label={t("openMenu")}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileDrag={{ scale: 1.1, cursor: "grabbing" }}
      whileTap={{ scale: 0.95 }}
      onClick={(e: React.MouseEvent) => {
        // Prevent click if we were dragging
        if (isDragging.current) return;
        resetIdleTimer();
        onClick?.(e);
      }}
      onDragStart={() => {
        isDragging.current = true;
        resetIdleTimer();
      }}
      onDrag={() => resetIdleTimer()}
      onDragEnd={() => {
        // Delay resetting drag flag to prevent onClick from firing immediately after release
        setTimeout(() => {
          isDragging.current = false;
        }, 100);
        resetIdleTimer();
      }}
      className={cn(
        "fixed z-50 top-[45dvh] right-[calc(0.5rem+var(--sar,0px))] md:hidden flex items-center justify-center w-12 h-12 rounded-full bg-(--accent) text-(--accent-foreground) shadow-lg backdrop-blur-sm border border-(--accent)/20 transition-opacity duration-500 touch-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
        className
      )}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: isIdle ? 0.3 : 1 }}
    >
      <Menu className="w-6 h-6" />
    </motion.button>
  );
}

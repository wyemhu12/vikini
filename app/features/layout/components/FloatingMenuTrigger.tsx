"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";

interface FloatingMenuTriggerProps {
  onClick?: (e: React.MouseEvent | MouseEvent | TouchEvent | PointerEvent) => void;
  className?: string;
}

export default function FloatingMenuTrigger({ onClick, className }: FloatingMenuTriggerProps) {
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
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileDrag={{ scale: 1.1, cursor: "grabbing" }}
      whileTap={{ scale: 0.9 }}
      onClick={(e: any) => {
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
      className={`
        fixed z-50 bottom-24 left-4 md:hidden
        flex items-center justify-center
        w-12 h-12 rounded-full
        bg-[var(--accent)] text-[var(--surface)]
        shadow-lg backdrop-blur-sm
        border border-[var(--accent)]/20
        transition-opacity duration-500
        ${className}
      `}
      style={{
        opacity: isIdle ? 0.3 : 1,
        touchAction: "none", // Important for dragging
      }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: isIdle ? 0.3 : 1 }}
    >
      <Menu className="w-6 h-6" />
    </motion.button>
  );
}

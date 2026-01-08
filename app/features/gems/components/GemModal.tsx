"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGemStore } from "../stores/useGemStore";
import GemManager from "./GemManager";

export default function GemModal() {
  const { isOpen, closeGemModal } = useGemStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeGemModal}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
            {/* Modal Panel */}
            <div className="pointer-events-auto w-full max-w-5xl h-[85vh] bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
              {/* Close Button Absolute */}
              <button
                onClick={closeGemModal}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 18 18" />
                </svg>
              </button>

              {/* Content */}
              <GemManager inModal={true} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// /app/features/research/components/ResearchReportCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Microscope } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { DURATION, EASE } from "@/lib/utils/motion";

interface ResearchReportCardProps {
  topic: string;
  completedAt?: string;
  onOpen: () => void;
}

export default function ResearchReportCard({
  topic,
  completedAt,
  onOpen,
}: ResearchReportCardProps) {
  const { t } = useLanguage();

  const formattedTime = completedAt ? new Date(completedAt).toLocaleString() : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.ENTER }}
      className="rounded-(--radius) border border-(--border) bg-(--surface-elevated) p-4 w-full max-w-xl"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-(--radius) bg-(--accent)/15 flex items-center justify-center shrink-0">
          <Microscope className="w-5 h-5 text-(--accent)" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-(--text-primary) mb-0.5 line-clamp-2">
            {t("deepResearchReport")}
          </h3>
          <p className="text-xs text-(--text-secondary) line-clamp-1 mb-1">{topic}</p>
          {formattedTime && <p className="text-xs text-(--text-secondary)/60">{formattedTime}</p>}
        </div>

        {/* Open button */}
        <button
          onClick={onOpen}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-(--radius) bg-(--accent) text-white hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {t("deepResearchOpen")}
        </button>
      </div>
    </motion.div>
  );
}

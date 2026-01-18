// /app/features/chat/components/DashboardView.tsx
"use client";

import React, { useState, useEffect } from "react";
// @ts-ignore
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { useSession } from "next-auth/react";
import { useLanguage } from "../hooks/useLanguage";
import { motion } from "framer-motion";
import { CodeXml, BarChart3, Image as ImageIcon, Clock, PieChart } from "lucide-react";

interface DashboardViewProps {
  onPromptSelect?: (prompt: string) => void;
  lastConversation?: { id: string; title?: string };
  onSelectConversation?: (id: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardView({
  onPromptSelect,
  lastConversation,
  onSelectConversation,
}: DashboardViewProps) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("greetingMorning");
    else if (hour < 18) setGreeting("greetingAfternoon");
    else setGreeting("greetingEvening");
  }, []);

  const items = [
    {
      title: t("suggestionCode") || "Code Review",
      description: t("descSuggestionCode") || "Analyze & refactor code snippets",
      header: <CodeXml className="w-8 h-8 md:w-10 md:h-10 text-(--accent)" />,
      className: "col-span-1",
      prompt: "Review this code for best practices and potential bugs:",
      onClick: undefined,
    },
    {
      title: t("suggestionAnalyze") || "Analyze Data",
      description: t("descSuggestionAnalyze") || "Deep dive into complex datasets",
      header: <BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />,
      className: "col-span-1",
      prompt: "Please analyze the following data and provide insights:",
      onClick: undefined,
    },
    {
      title: t("suggestionImage") || "Generate Image",
      description: t("descSuggestionImage") || "Create stunning visuals with AI",
      header: <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-pink-400" />,
      className: "col-span-1",
      prompt: "Generate a high-quality image of:",
      onClick: undefined,
    },
    {
      title: t("statsTokenUsage") || "Token Usage",
      description: t("descStatsTokenUsage") || "12,450 / 50,000 (Mock)",
      header: <PieChart className="w-8 h-8 md:w-10 md:h-10 text-orange-400" />,
      className: "col-span-1 md:col-span-2",
      prompt: null, // Info only
      onClick: undefined,
    },
    {
      title: lastConversation
        ? lastConversation.title || t("untitledChat")
        : t("recentActivity") || "Recent Activity",
      description: lastConversation
        ? t("resumeChat") || "Click to resume"
        : t("descStatsNoData") || "No recent chats",
      header: <Clock className="w-8 h-8 md:w-10 md:h-10 text-gray-400" />,
      className: "col-span-1",
      prompt: undefined,
      onClick: () => lastConversation && onSelectConversation?.(lastConversation.id),
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="max-w-4xl mx-auto px-2 py-4 pb-48 md:p-6"
    >
      <motion.div variants={itemVariants} className="mb-4">
        <h1 className="text-3xl md:text-5xl font-bold text-(--text-primary) mb-2">
          {t(greeting)}, {session?.user?.name || "User"}
        </h1>
        <p className="text-(--text-secondary) text-lg h-full">{t("landingMessage")}</p>
      </motion.div>

      <BentoGrid className="max-w-4xl mx-auto grid-cols-1 md:grid-cols-3">
        {items.map((item, i) => (
          <motion.div key={i} variants={itemVariants} className={item.className}>
            <BentoGridItem
              title={item.title}
              description={item.description}
              header={item.header}
              className="h-full"
              onClick={() =>
                item.onClick ? item.onClick() : item.prompt && onPromptSelect?.(item.prompt)
              }
            />
          </motion.div>
        ))}
      </BentoGrid>
    </motion.div>
  );
}

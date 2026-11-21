"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart3,
  Users,
  MessageSquare,
  MessagesSquare,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/utils/logger";

interface Stats {
  users: {
    total: number;
    active: number;
    blocked: number;
    byRank: {
      admin: number;
      pro: number;
      basic: number;
      not_whitelisted: number;
    };
  };
  conversations: { total: number; today: number };
  messages: { today: number };
}

// No props needed - language comes from useLanguage() hook

export default function StatisticsOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { t } = useLanguage();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error(tRef.current("adminStatsLoadFailed"));
      const json = await res.json();
      setStats(json.data || json);
    } catch (err: unknown) {
      logger.error("[StatisticsOverview] Failed to load statistics:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminStatsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div role="status" className="space-y-6 py-2">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/30 text-(--danger)"
      >
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error || t("adminStatsLoadFailed")}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchStats()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-(--raised) hover:bg-(--raised-hover) text-(--text) border border-(--line) transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  const cards = [
    {
      icon: Users,
      label: t("adminStatsTotal"),
      value: stats.users.total,
      color: "text-(--accent)",
      bgColor: "bg-(--soft) border-(--accent)/20",
    },
    {
      icon: Users,
      label: t("adminStatsActive"),
      value: stats.users.active,
      color: "text-(--success)",
      bgColor: "bg-(--success)/10 border-(--success)/20",
    },
    {
      icon: Users,
      label: t("adminStatsBlocked"),
      value: stats.users.blocked,
      color: "text-(--danger)",
      bgColor: "bg-(--danger)/10 border-(--danger)/20",
    },
    {
      icon: MessagesSquare,
      label: t("adminStatsConversations"),
      value: stats.conversations.total,
      color: "text-(--accent)",
      bgColor: "bg-(--soft) border-(--accent)/20",
      sub: `${stats.conversations.today} ${t("adminStatsToday")}`,
    },
    {
      icon: MessageSquare,
      label: t("adminStatsMessagesToday"),
      value: stats.messages.today,
      color: "text-(--warning)",
      bgColor: "bg-(--warning)/10 border-(--warning)/20",
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-(--accent)" />
        <h2 className="text-xl font-semibold text-(--text)">{t("adminStats")}</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-xl border ${card.bgColor} transition-colors hover:scale-[1.02]`}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-(--muted)">{card.label}</span>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            {card.sub && <div className="text-xs text-(--muted) mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Rank Distribution */}
      <div className="p-5 rounded-xl bg-(--raised) border border-(--line)">
        <h3 className="text-sm font-medium text-(--muted) mb-4">{t("adminStatsRankDist")}</h3>
        <div className="space-y-3">
          {(
            [
              { rank: "admin", label: t("userAdmin"), color: "bg-(--warning)" },
              { rank: "pro", label: t("userPro"), color: "bg-(--accent)" },
              { rank: "basic", label: t("userBasic"), color: "bg-(--accent)" },
              { rank: "not_whitelisted", label: t("userNotWhitelisted"), color: "bg-(--muted)" },
            ] as const
          ).map(({ rank, label, color }) => {
            const count = stats.users.byRank[rank];
            const pct = stats.users.total > 0 ? (count / stats.users.total) * 100 : 0;
            return (
              <div key={rank} className="flex items-center gap-3">
                <span className="text-sm text-(--text) w-28 shrink-0">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-(--surface) border border-(--line) overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-colors duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-(--muted) w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  MessageSquare,
  MessagesSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

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

  useEffect(() => {
    void fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      setStats(json.data || json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
        <span className="ml-2 text-(--muted)">{t("loading")}</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center gap-2 text-(--danger) py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error || "No data"}</span>
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
            {card.sub && <div className="text-xs text-(--faint) mt-1">{card.sub}</div>}
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
              { rank: "not_whitelisted", label: t("userNotWhitelisted"), color: "bg-(--raised)" },
            ] as const
          ).map(({ rank, label, color }) => {
            const count = stats.users.byRank[rank];
            const pct = stats.users.total > 0 ? (count / stats.users.total) * 100 : 0;
            return (
              <div key={rank} className="flex items-center gap-3">
                <span className="text-sm text-(--text) w-28 shrink-0">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-(--raised) overflow-hidden">
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

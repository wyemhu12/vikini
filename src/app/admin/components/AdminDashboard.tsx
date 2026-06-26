"use client";

import { useState } from "react";
import { Shield, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import UserManager from "./UserManager";
import RankConfigManager from "./RankConfigManager";
import GemsManager from "./GemsManager";
import PersonasManager from "./PersonasManager";
import StatisticsOverview from "./StatisticsOverview";
import AuditLogViewer from "./AuditLogViewer";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface AdminDashboardProps {
  currentUserId: string;
}

export default function AdminDashboard({ currentUserId }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "users" | "limits" | "gems" | "personas" | "stats" | "audit"
  >("users");
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-(--surface)">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-(--control-bg) border border-(--border) backdrop-blur-3xl">
              <Shield className="w-8 h-8 text-(--accent)" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-(--text-primary)">{t("adminDashboard")}</h1>
              <p className="text-(--text-secondary) text-sm">{t("adminDescription")}</p>
            </div>
          </div>

          {/* Right-side controls */}
          <div className="flex items-center gap-3">
            {/* Back to Home */}
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--control-bg) border border-(--border) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) hover:border-(--border) transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">{t("adminBackToHome")}</span>
            </Link>

            {/* Quick Links */}
            <div className="flex items-center gap-1">
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-all text-xs"
                title="Vercel Dashboard"
              >
                <ExternalLink className="w-3 h-3" />
                Vercel
              </a>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-all text-xs"
                title="Supabase Dashboard"
              >
                <ExternalLink className="w-3 h-3" />
                Supabase
              </a>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-(--control-bg) border border-(--border)">
              <button
                onClick={() => setLanguage("vi")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  language === "vi"
                    ? "bg-(--warning)/20 text-(--warning) border border-(--warning)/30"
                    : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
                }`}
              >
                VN
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  language === "en"
                    ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                    : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 p-1 rounded-xl bg-(--control-bg) border border-(--border) backdrop-blur-3xl w-fit">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "users"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminUsers")}
          </button>
          <button
            onClick={() => setActiveTab("limits")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "limits"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminLimits")}
          </button>
          <button
            onClick={() => setActiveTab("gems")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "gems"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminGlobalGems")}
          </button>
          <button
            onClick={() => setActiveTab("personas")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "personas"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminGlobalPersonas") || "Personas"}
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "stats"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminStats")}
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "audit"
                ? "bg-(--accent)/20 text-(--accent) border border-(--accent)/30"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
            }`}
          >
            {t("adminAuditLog")}
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-xl bg-(--control-bg) border border-(--border) backdrop-blur-3xl p-6">
          {activeTab === "users" && <UserManager currentUserId={currentUserId} />}
          {activeTab === "limits" && <RankConfigManager />}
          {activeTab === "gems" && <GemsManager />}
          {activeTab === "personas" && <PersonasManager />}
          {activeTab === "stats" && <StatisticsOverview />}
          {activeTab === "audit" && <AuditLogViewer />}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Shield, ArrowLeft, ExternalLink, Palette } from "lucide-react";
import Link from "next/link";
import UserManager from "./UserManager";
import RankConfigManager from "./RankConfigManager";
import GemsManager from "./GemsManager";
import PersonasManager from "./PersonasManager";
import StatisticsOverview from "./StatisticsOverview";
import AuditLogViewer from "./AuditLogViewer";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import ThemeMenuItems from "@/app/features/layout/components/ThemeMenuItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminDashboardProps {
  currentUserId: string;
}

type AdminTab = "users" | "limits" | "gems" | "personas" | "stats" | "audit";

const LANG_OPTIONS = [
  { id: "vi" as const, labelKey: "langCodeVi" },
  { id: "en" as const, labelKey: "langCodeEn" },
];

const ADMIN_TABS: readonly { id: AdminTab; labelKey: string }[] = [
  { id: "users", labelKey: "adminUsers" },
  { id: "limits", labelKey: "adminLimits" },
  { id: "gems", labelKey: "adminGlobalGems" },
  { id: "personas", labelKey: "adminGlobalPersonas" },
  { id: "stats", labelKey: "adminStats" },
  { id: "audit", labelKey: "adminAuditLog" },
];

export default function AdminDashboard({ currentUserId }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-(--bg) text-(--text)">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 rounded-xl bg-(--surface) border border-(--line) shrink-0">
              <Shield aria-hidden="true" className="w-7 h-7 sm:w-8 sm:h-8 text-(--accent)" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-(--text) truncate">
                {t("adminDashboard")}
              </h1>
              <p className="text-(--muted) text-sm">{t("adminDescription")}</p>
            </div>
          </div>

          {/* Right-side controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Back to Home */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-10 rounded-lg bg-(--raised) border border-(--line) text-(--muted) hover:text-(--text) hover:bg-(--raised-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              <span className="text-sm font-medium">{t("adminBackToHome")}</span>
            </Link>

            {/* Quick Links */}
            <div className="flex items-center gap-1">
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-lg text-(--muted) hover:text-(--text) hover:bg-(--raised-hover) transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title="Vercel Dashboard"
              >
                <ExternalLink aria-hidden="true" className="w-3 h-3" />
                Vercel
              </a>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-lg text-(--muted) hover:text-(--text) hover:bg-(--raised-hover) transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                title="Supabase Dashboard"
              >
                <ExternalLink aria-hidden="true" className="w-3 h-3" />
                Supabase
              </a>
            </div>

            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("adminTheme")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-lg bg-(--raised) border border-(--line) text-(--muted) hover:text-(--text) hover:bg-(--raised-hover) transition-colors text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <Palette aria-hidden="true" className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("adminTheme")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <ThemeMenuItems />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Selector */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-(--surface) border border-(--line)">
              {LANG_OPTIONS.map((opt) => {
                const isActive = language === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setLanguage(opt.id)}
                    className={`px-3 py-1.5 min-h-8 rounded-md text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                      isActive
                        ? "bg-(--soft) text-(--accent) border border-(--accent)/30"
                        : "text-(--muted) hover:text-(--text) hover:bg-(--raised-hover)"
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label={t("adminDashboard")}
          className="mb-6 flex gap-1.5 sm:gap-2 p-1 rounded-xl bg-(--surface) border border-(--line) overflow-x-auto max-w-full"
        >
          {ADMIN_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap px-4 sm:px-5 py-2.5 min-h-10 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                  isActive
                    ? "bg-(--soft) text-(--accent) border border-(--accent)/30"
                    : "text-(--muted) hover:text-(--text) hover:bg-(--raised-hover)"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          className="rounded-xl bg-(--surface) border border-(--line) p-4 sm:p-6"
        >
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

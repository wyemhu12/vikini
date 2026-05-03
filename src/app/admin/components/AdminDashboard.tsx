"use client";

import { useState, useEffect } from "react";
import { Shield, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import UserManager from "./UserManager";
import RankConfigManager from "./RankConfigManager";
import GemsManager from "./GemsManager";
import StatisticsOverview from "./StatisticsOverview";
import AuditLogViewer from "./AuditLogViewer";
import { translations } from "@/lib/utils/config";

type Language = "vi" | "en";

interface AdminDashboardProps {
  currentUserId: string;
}

export default function AdminDashboard({ currentUserId }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"users" | "limits" | "gems" | "stats" | "audit">(
    "users"
  );
  const [language, setLanguage] = useState<Language>("vi");

  // Load language preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("vikini-lang") as Language;
    if (saved === "vi" || saved === "en") {
      setLanguage(saved);
    }
  }, []);

  // Save language preference
  const toggleLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("vikini-lang", lang);
  };

  const t = language === "vi" ? translations.vi : translations.en;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/10 backdrop-blur-3xl">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{t.adminDashboard}</h1>
              <p className="text-gray-400 text-sm">{t.adminDescription}</p>
            </div>
          </div>

          {/* Right-side controls */}
          <div className="flex items-center gap-3">
            {/* Back to Home */}
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/3 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">{t.adminBackToHome}</span>
            </Link>

            {/* Quick Links */}
            <div className="flex items-center gap-1">
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all text-xs"
                title="Vercel Dashboard"
              >
                <ExternalLink className="w-3 h-3" />
                Vercel
              </a>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all text-xs"
                title="Supabase Dashboard"
              >
                <ExternalLink className="w-3 h-3" />
                Supabase
              </a>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/3 border border-white/10">
              <button
                onClick={() => toggleLanguage("vi")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  language === "vi"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                VN
              </button>
              <button
                onClick={() => toggleLanguage("en")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  language === "en"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 p-1 rounded-xl bg-white/3 border border-white/10 backdrop-blur-3xl w-fit">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "users"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.adminUsers}
          </button>
          <button
            onClick={() => setActiveTab("limits")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "limits"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.adminLimits}
          </button>
          <button
            onClick={() => setActiveTab("gems")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "gems"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.adminGlobalGems}
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "stats"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.adminStats}
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "audit"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.adminAuditLog}
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-xl bg-white/3 border border-white/10 backdrop-blur-3xl p-6">
          {activeTab === "users" && (
            <UserManager language={language} currentUserId={currentUserId} />
          )}
          {activeTab === "limits" && <RankConfigManager language={language} />}
          {activeTab === "gems" && <GemsManager language={language} />}
          {activeTab === "stats" && <StatisticsOverview language={language} />}
          {activeTab === "audit" && <AuditLogViewer language={language} />}
        </div>
      </div>
    </div>
  );
}

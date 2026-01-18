"use client";

import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import UserManager from "./UserManager";
import RankConfigManager from "./RankConfigManager";
import GemsManager from "./GemsManager";
import { translations } from "@/lib/utils/config";

type Language = "vi" | "en";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"users" | "limits" | "gems">("users");
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

          {/* Language Selector */}
          <div className="relative">
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
        </div>

        {/* Tab Content */}
        <div className="rounded-xl bg-white/3 border border-white/10 backdrop-blur-3xl p-6">
          {activeTab === "users" && <UserManager language={language} />}
          {activeTab === "limits" && <RankConfigManager language={language} />}
          {activeTab === "gems" && <GemsManager language={language} />}
        </div>
      </div>
    </div>
  );
}

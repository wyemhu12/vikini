"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import UserManager from "./UserManager";
import RankConfigManager from "./RankConfigManager";
import GemsManager from "./GemsManager";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"users" | "limits" | "gems">("users");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Manage users, limits, and system configuration</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl w-fit">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "users"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("limits")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "limits"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Limits
          </button>
          <button
            onClick={() => setActiveTab("gems")}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "gems"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Global GEMs
          </button>
        </div>

        {/* Tab Content */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-6">
          {activeTab === "users" && <UserManager />}
          {activeTab === "limits" && <RankConfigManager />}
          {activeTab === "gems" && <GemsManager />}
        </div>
      </div>
    </div>
  );
}

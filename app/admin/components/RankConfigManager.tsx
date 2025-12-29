"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Save, AlertCircle } from "lucide-react";

interface RankConfig {
  rank: "basic" | "pro" | "admin";
  daily_message_limit: number;
  max_file_size_mb: number;
  features: {
    web_search: boolean;
    unlimited_gems: boolean;
  };
}

export default function RankConfigManager() {
  const [configs, setConfigs] = useState<RankConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editedConfigs, setEditedConfigs] = useState<RankConfig[]>([]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/rank-configs");
      if (!res.ok) throw new Error("Failed to fetch configs");
      const data = await res.json();
      setConfigs(data.configs || []);
      setEditedConfigs(data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configs");
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (rank: string, field: string, value: any) => {
    setEditedConfigs((prev) =>
      prev.map((c) => {
        if (c.rank !== rank) return c;
        if (field.startsWith("features.")) {
          const featureKey = field.split(".")[1];
          return { ...c, features: { ...c.features, [featureKey]: value } };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const saveConfigs = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/rank-configs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: editedConfigs }),
      });

      if (!res.ok) throw new Error("Failed to save configs");

      await fetchConfigs();
      alert("Rank configs updated successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save configs");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(configs) !== JSON.stringify(editedConfigs);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Loading configs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Global Limit Configuration</h2>
        </div>
        {hasChanges && (
          <button
            onClick={saveConfigs}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        )}
      </div>

      <div className="space-y-6">
        {editedConfigs.map((config) => (
          <div key={config.rank} className="p-5 rounded-lg bg-white/[0.02] border border-white/10">
            <h3 className="text-lg font-semibold text-white capitalize mb-4">{config.rank}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Message Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Daily Message Limit
                </label>
                <input
                  type="number"
                  value={config.daily_message_limit}
                  onChange={(e) =>
                    updateConfig(config.rank, "daily_message_limit", parseInt(e.target.value))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {/* Max File Size */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  value={config.max_file_size_mb}
                  onChange={(e) =>
                    updateConfig(config.rank, "max_file_size_mb", parseInt(e.target.value))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {/* Features */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">Features</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.features.web_search}
                      onChange={(e) =>
                        updateConfig(config.rank, "features.web_search", e.target.checked)
                      }
                      className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/50"
                    />
                    <span className="text-sm text-gray-300">Web Search</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.features.unlimited_gems}
                      onChange={(e) =>
                        updateConfig(config.rank, "features.unlimited_gems", e.target.checked)
                      }
                      className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/50"
                    />
                    <span className="text-sm text-gray-300">Unlimited GEMs</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

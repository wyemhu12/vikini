"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Save, AlertCircle, Cpu } from "lucide-react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

interface RankConfig {
  rank: "basic" | "pro" | "admin";
  daily_message_limit: number;
  max_file_size_mb: number;
  features: {
    web_search: boolean;
    unlimited_gems: boolean;
  };
  allowed_models?: string[];
}

export default function RankConfigManager() {
  const [configs, setConfigs] = useState<RankConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editedConfigs, setEditedConfigs] = useState<RankConfig[]>([]);
  const [modelModalRank, setModelModalRank] = useState<string | null>(null);

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

  const updateConfig = (rank: string, field: string, value: unknown) => {
    setEditedConfigs((prev) =>
      prev.map((c) => {
        if (c.rank !== rank) return c;
        if (field.startsWith("features.")) {
          const featureKey = field.split(".")[1];
          return { ...c, features: { ...c.features, [featureKey]: value } };
        }
        if (field === "allowed_models") {
          return { ...c, allowed_models: value as string[] };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const toggleModel = (rank: string, modelId: string) => {
    const config = editedConfigs.find((c) => c.rank === rank);
    if (!config) return;

    const currentModels = config.allowed_models || [];
    const newModels = currentModels.includes(modelId)
      ? currentModels.filter((m) => m !== modelId)
      : [...currentModels, modelId];

    updateConfig(rank, "allowed_models", newModels);
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

  const currentModalConfig = modelModalRank
    ? editedConfigs.find((c) => c.rank === modelModalRank)
    : null;

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

              {/* Allowed Models Button */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Allowed Models
                </label>
                <button
                  onClick={() => setModelModalRank(config.rank)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                >
                  <Cpu className="w-4 h-4" />
                  Configure Models ({config.allowed_models?.length || 0})
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Model Selection Modal */}
      {modelModalRank && currentModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white capitalize">
                {modelModalRank} Models
              </h3>
              <button
                onClick={() => setModelModalRank(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">Select which models this rank can access</p>

            <div className="space-y-2">
              {SELECTABLE_MODELS.map((model) => {
                const isSelected = currentModalConfig.allowed_models?.includes(model.id) || false;
                return (
                  <label
                    key={model.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-white/[0.02] border border-white/10 hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModel(modelModalRank, model.id)}
                      className="mt-1 w-4 h-4 rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/50"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">{model.name || model.id}</div>
                      <div className="text-xs text-gray-400">
                        Context: {(model.contextWindow / 1000).toFixed(0)}K tokens
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setModelModalRank(null)}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

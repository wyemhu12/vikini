"use client";

import { useState, useEffect } from "react";
import { Settings, Settings2, Loader2, Save, AlertCircle, Cpu } from "lucide-react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/store/toastStore";

interface RankConfig {
  rank: "basic" | "pro" | "admin";
  daily_message_limit: number;
  max_file_size_mb: number;
  features: {
    web_search: boolean;
    unlimited_gems: boolean;
    deep_research?: boolean;
  };
  allowed_models?: string[];
  daily_research_limit?: number;
}

// No props needed — language comes from useLanguage() hook

export default function RankConfigManager() {
  const [configs, setConfigs] = useState<RankConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editedConfigs, setEditedConfigs] = useState<RankConfig[]>([]);
  const [modelModalRank, setModelModalRank] = useState<string | null>(null);
  const [featureModalRank, setFeatureModalRank] = useState<string | null>(null);

  const { t } = useLanguage();

  useEffect(() => {
    void fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/rank-configs");
      if (!res.ok) throw new Error("Failed to fetch configs");
      const json = await res.json();
      const data = json.data || json;
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

      const json = await res.json();

      if (!res.ok) throw new Error(json.error?.message || json.error || "Failed to save configs");

      await fetchConfigs();
      toast.success(t("configsSaved") || "Configurations saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("failedSaveConfigs") || "Failed to save configs"
      );
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(configs) !== JSON.stringify(editedConfigs);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">{t("loadingConfigs")}</span>
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
          <h2 className="text-xl font-semibold text-white">{t("globalLimitConfig")}</h2>
        </div>
        {hasChanges && (
          <button
            onClick={saveConfigs}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("saveChanges")}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {editedConfigs.map((config) => (
          <div key={config.rank} className="p-5 rounded-lg bg-white/2 border border-white/10">
            <h3 className="text-lg font-semibold text-white capitalize mb-4">{config.rank}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Message Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("dailyMessageLimit")}
                </label>
                <Input
                  type="number"
                  value={config.daily_message_limit}
                  onChange={(e) =>
                    updateConfig(config.rank, "daily_message_limit", parseInt(e.target.value))
                  }
                  className="w-full bg-white/5 border-white/10 text-white focus-visible:ring-blue-500/50"
                />
              </div>

              {/* Max File Size */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("maxFileSize")}
                </label>
                <Input
                  type="number"
                  value={config.max_file_size_mb}
                  onChange={(e) =>
                    updateConfig(config.rank, "max_file_size_mb", parseInt(e.target.value))
                  }
                  className="w-full bg-white/5 border-white/10 text-white focus-visible:ring-blue-500/50"
                />
              </div>

              {/* Daily Research Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("dailyResearchLimit")}
                </label>
                <Input
                  type="number"
                  value={config.daily_research_limit ?? 0}
                  onChange={(e) =>
                    updateConfig(config.rank, "daily_research_limit", parseInt(e.target.value))
                  }
                  className="w-full bg-white/5 border-white/10 text-white focus-visible:ring-blue-500/50"
                />
              </div>

              {/* Features */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("features")}
                </label>
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
                    <span className="text-sm text-gray-300">{t("webSearch")}</span>
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
                    <span className="text-sm text-gray-300">{t("unlimitedGems")}</span>
                  </label>
                </div>
              </div>

              {/* Allowed Models Button */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("allowedModels")}
                </label>
                <button
                  onClick={() => setModelModalRank(config.rank)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                >
                  <Cpu className="w-4 h-4" />
                  {t("configureModels")} ({config.allowed_models?.length || 0})
                </button>
              </div>

              {/* Configure Features Button */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t("configureFeatures")}
                </label>
                <button
                  onClick={() => setFeatureModalRank(config.rank)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  {t("configureFeatures")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Model Selection Modal */}
      {modelModalRank && currentModalConfig && (
        <Dialog open={!!modelModalRank} onOpenChange={(open) => !open && setModelModalRank(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0a0a0a] border-white/10 p-6 sm:rounded-xl">
            <DialogTitle className="text-xl font-semibold text-white capitalize mb-4">
              {modelModalRank} {t("models")}
            </DialogTitle>

            <p className="text-sm text-gray-400 mb-4">{t("selectModelsForRank")}</p>

            <div className="space-y-2">
              {SELECTABLE_MODELS.map((model) => {
                const isSelected = currentModalConfig.allowed_models?.includes(model.id) || false;
                return (
                  <label
                    key={model.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-white/2 border border-white/10 hover:bg-white/5"
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
                        {t("contextTokens")}: {(model.contextWindow / 1000).toFixed(0)}K{" "}
                        {t("tokens")}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setModelModalRank(null)}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
              >
                {t("done")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Feature Configuration Modal */}
      {featureModalRank &&
        (() => {
          const featureConfig = editedConfigs.find((c) => c.rank === featureModalRank);
          if (!featureConfig) return null;
          const featureList = [
            {
              key: "deep_research" as const,
              label: t("deepResearch"),
              description: t("deepResearchDesc"),
            },
          ];
          return (
            <Dialog
              open={!!featureModalRank}
              onOpenChange={(open) => !open && setFeatureModalRank(null)}
            >
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-[#0a0a0a] border-white/10 p-6 sm:rounded-xl">
                <DialogTitle className="text-xl font-semibold text-white capitalize mb-4">
                  {featureModalRank} — {t("configureFeatures")}
                </DialogTitle>

                <p className="text-sm text-gray-400 mb-4">{t("configureFeatures")}</p>

                <div className="space-y-2">
                  {featureList.map((feat) => {
                    const isEnabled = featureConfig.features[feat.key] ?? false;
                    return (
                      <label
                        key={feat.key}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isEnabled
                            ? "bg-blue-500/20 border border-blue-500/30"
                            : "bg-white/2 border border-white/10 hover:bg-white/5"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            updateConfig(featureModalRank, `features.${feat.key}`, e.target.checked)
                          }
                          className="mt-1 w-4 h-4 rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/50"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">{feat.label}</div>
                          <div className="text-xs text-gray-400">{feat.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setFeatureModalRank(null)}
                    className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
                  >
                    {t("done")}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
    </div>
  );
}

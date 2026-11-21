"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Settings, Loader2, Save, AlertCircle, Cpu, RotateCcw } from "lucide-react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

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

// No props needed - language comes from useLanguage() hook

export default function RankConfigManager() {
  const [configs, setConfigs] = useState<RankConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editedConfigs, setEditedConfigs] = useState<RankConfig[]>([]);
  const [modelModalRank, setModelModalRank] = useState<string | null>(null);

  const { t } = useLanguage();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/rank-configs");
      if (!res.ok) throw new Error(tRef.current("adminRankConfigLoadFailed"));
      const json = await res.json();
      const data = json.data || json;
      setConfigs(data.configs || []);
      setEditedConfigs(data.configs || []);
    } catch (err: unknown) {
      logger.error("[RankConfigManager] Failed to load rank configs:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminRankConfigLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

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
      <div role="status" className="space-y-4 py-2">
        <span className="sr-only">{t("loadingConfigs")}</span>
        <Skeleton className="h-6 w-56" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/30 text-(--danger)"
      >
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchConfigs()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-(--raised) hover:bg-(--raised-hover) text-(--text) border border-(--line) transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
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
          <Settings className="w-5 h-5 text-(--accent)" />
          <h2 className="text-xl font-semibold text-(--text)">{t("globalLimitConfig")}</h2>
        </div>
        {hasChanges && (
          <button
            type="button"
            onClick={saveConfigs}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-(--on-accent) rounded-lg hover:brightness-110 transition-[filter] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("saveChanges")}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {editedConfigs.map((config) => (
          <div key={config.rank} className="p-5 rounded-lg bg-(--raised) border border-(--line)">
            <h3 className="text-lg font-semibold text-(--text) capitalize mb-4">{config.rank}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Message Limit */}
              <div>
                <label
                  htmlFor={`rank-${config.rank}-daily-limit`}
                  className="block text-sm font-medium text-(--muted) mb-2"
                >
                  {t("dailyMessageLimit")}
                </label>
                <Input
                  id={`rank-${config.rank}-daily-limit`}
                  type="number"
                  value={config.daily_message_limit}
                  onChange={(e) =>
                    updateConfig(
                      config.rank,
                      "daily_message_limit",
                      Math.min(Math.max(0, parseInt(e.target.value, 10) || 0), 2147483647)
                    )
                  }
                  className="w-full bg-(--raised) border-(--line) text-(--text) focus-visible:ring-(--accent)/50"
                />
              </div>

              {/* Max File Size */}
              <div>
                <label
                  htmlFor={`rank-${config.rank}-max-file-size`}
                  className="block text-sm font-medium text-(--muted) mb-2"
                >
                  {t("maxFileSize")}
                </label>
                <Input
                  id={`rank-${config.rank}-max-file-size`}
                  type="number"
                  value={config.max_file_size_mb}
                  onChange={(e) =>
                    updateConfig(
                      config.rank,
                      "max_file_size_mb",
                      Math.min(Math.max(0, parseInt(e.target.value, 10) || 0), 2147483647)
                    )
                  }
                  className="w-full bg-(--raised) border-(--line) text-(--text) focus-visible:ring-(--accent)/50"
                />
              </div>

              {/* Features */}
              <div className="md:col-span-2">
                <div className="block text-sm font-medium text-(--muted) mb-2">{t("features")}</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.features.web_search}
                      onChange={(e) =>
                        updateConfig(config.rank, "features.web_search", e.target.checked)
                      }
                      className="w-4 h-4 rounded bg-(--raised) border-(--line) text-(--accent) focus:ring-(--accent)/50"
                    />
                    <span className="text-sm text-(--text)">{t("webSearch")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.features.unlimited_gems}
                      onChange={(e) =>
                        updateConfig(config.rank, "features.unlimited_gems", e.target.checked)
                      }
                      className="w-4 h-4 rounded bg-(--raised) border-(--line) text-(--accent) focus:ring-(--accent)/50"
                    />
                    <span className="text-sm text-(--text)">{t("unlimitedGems")}</span>
                  </label>
                </div>
              </div>

              {/* Allowed Models Button */}
              <div className="md:col-span-2">
                <div className="block text-sm font-medium text-(--muted) mb-2">
                  {t("allowedModels")}
                </div>
                <button
                  type="button"
                  onClick={() => setModelModalRank(config.rank)}
                  className="flex items-center gap-2 px-4 py-2 bg-(--surface) text-(--accent) rounded-lg hover:bg-(--raised-hover) border border-(--accent)/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <Cpu className="w-4 h-4" />
                  {t("configureModels")} ({config.allowed_models?.length || 0})
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Model Selection Modal */}
      {modelModalRank && currentModalConfig && (
        <Dialog open={!!modelModalRank} onOpenChange={(open) => !open && setModelModalRank(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-(--surface) border-(--line) p-6 sm:rounded-xl">
            <DialogTitle className="text-xl font-semibold text-(--text) capitalize mb-4">
              {modelModalRank} {t("models")}
            </DialogTitle>

            <p className="text-sm text-(--muted) mb-4">{t("selectModelsForRank")}</p>

            <div className="space-y-2">
              {SELECTABLE_MODELS.map((model) => {
                const isSelected = currentModalConfig.allowed_models?.includes(model.id) || false;
                return (
                  <label
                    key={model.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-(--soft) border border-(--accent)/30"
                        : "bg-(--raised) border border-(--line) hover:bg-(--raised-hover)"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModel(modelModalRank, model.id)}
                      className="mt-1 w-4 h-4 rounded bg-(--raised) border-(--line) text-(--accent) focus:ring-(--accent)/50"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-(--text)">{model.name || model.id}</div>
                      <div className="text-xs text-(--muted)">
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
                type="button"
                onClick={() => setModelModalRank(null)}
                className="px-4 py-2 bg-(--accent) text-(--on-accent) rounded-lg hover:brightness-110 transition-[filter] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                {t("done")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

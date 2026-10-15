import { useState, useEffect } from "react";
import { DEFAULT_MODEL } from "@/lib/core/modelRegistry";
import { logger } from "@/lib/utils/logger";

// Hook to fetch allowed models for current user
export function useAllowedModels(isAuthed: boolean) {
  const [allowedModelIds, setAllowedModelIds] = useState<Set<string>>(new Set());
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!isAuthed) {
      setAllowedModelIds(new Set());
      setFeatures({});
      setLoading(false);
      setIsResolved(false);
      return;
    }

    let cancelled = false;

    async function fetchAllowedModels() {
      try {
        setLoading(true);
        setIsResolved(false);
        const res = await fetch("/api/user/allowed-models");
        if (!res.ok) throw new Error("Failed to fetch allowed models");

        const json = await res.json();
        const data = json.data || json;
        const allowed = data.allowed_models || [];
        const feats = data.features || {};

        if (cancelled) return;

        // Return Set of allowed model IDs for easy checking
        setAllowedModelIds(new Set(allowed));
        setFeatures(feats);
        setIsResolved(true);
      } catch (error) {
        logger.warn("Error fetching allowed models:", error);
        // Fail closed to default model on error
        if (!cancelled) {
          setAllowedModelIds(new Set([DEFAULT_MODEL]));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchAllowedModels();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  return { allowedModelIds, features, loading, isResolved };
}

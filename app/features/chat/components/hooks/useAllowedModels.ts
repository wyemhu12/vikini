import { useState, useEffect } from "react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

// Hook to fetch allowed models for current user
export function useAllowedModels(isAuthed: boolean) {
  const [allowedModelIds, setAllowedModelIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthed) {
      setAllowedModelIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAllowedModels() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/allowed-models");
        if (!res.ok) throw new Error("Failed to fetch allowed models");

        const json = await res.json();
        const data = json.data || json;
        const allowed = data.allowed_models || [];

        if (cancelled) return;

        // Return Set of allowed model IDs for easy checking
        setAllowedModelIds(new Set(allowed));
      } catch (error) {
        console.warn("Error fetching allowed models:", error);
        // Fallback to allowing all models on error
        if (!cancelled) {
          setAllowedModelIds(new Set(SELECTABLE_MODELS.map((m) => m.id)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAllowedModels();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  return { allowedModelIds, loading };
}

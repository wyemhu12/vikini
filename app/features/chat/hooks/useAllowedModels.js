// Hook to fetch and filter allowed models for current user
import { useState, useEffect } from "react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

export function useAllowedModels(isAuthed) {
  const [allowedModels, setAllowedModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthed) {
      setAllowedModels([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAllowedModels() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/allowed-models");
        if (!res.ok) throw new Error("Failed to fetch allowed models");

        const data = await res.json();
        const allowed = data.allowed_models || [];

        if (cancelled) return;

        // Filter SELECTABLE_MODELS to only include allowed ones
        const filtered = SELECTABLE_MODELS.filter((model) => allowed.includes(model.id));

        setAllowedModels(filtered.length > 0 ? filtered : SELECTABLE_MODELS);
      } catch (error) {
        console.warn("Error fetching allowed models:", error);
        // Fallback to all models on error
        if (!cancelled) {
          setAllowedModels(SELECTABLE_MODELS);
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

  return { allowedModels, loading };
}

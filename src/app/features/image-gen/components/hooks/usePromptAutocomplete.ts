// Prompt autocomplete hook for ControlPanel
// Extracted from ControlPanel.tsx — handles AI suggestion fetching + keyboard nav

import { useState, useRef, useCallback } from "react";

interface UsePromptAutocompleteOptions {
  prompt: string;
  setPrompt: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
}

export function usePromptAutocomplete({
  prompt,
  setPrompt,
  generating,
  onGenerate,
}: UsePromptAutocompleteOptions) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.trim().length < 5) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/prompt-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partialPrompt: text.trim() }),
      });
      const json = await res.json();
      if (json.success && json.data?.suggestions?.length > 0) {
        setSuggestions(json.data.suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIdx(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void fetchSuggestions(value);
      }, 600);
    },
    [setPrompt, fetchSuggestions]
  );

  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (prompt.trim() && !generating) {
            onGenerate();
          }
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
        e.preventDefault();
        setPrompt(suggestions[selectedSuggestionIdx]);
        setShowSuggestions(false);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        setShowSuggestions(false);
        onGenerate();
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIdx, setPrompt, onGenerate, prompt, generating]
  );

  const dismissSuggestions = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  const selectSuggestion = useCallback(
    (s: string) => {
      setPrompt(s);
      setShowSuggestions(false);
    },
    [setPrompt]
  );

  return {
    suggestions,
    showSuggestions,
    selectedSuggestionIdx,
    loadingSuggestions,
    handlePromptChange,
    handlePromptKeyDown,
    dismissSuggestions,
    selectSuggestion,
  };
}

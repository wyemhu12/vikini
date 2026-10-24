"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STRATA_SAMPLING_PRESETS,
  sanitizeStrataSampling,
  type StrataSamplingInput,
  type StrataSamplingMode,
  type StrataSamplingValues,
} from "@/lib/features/local-llm/strataThinking";

export const STRATA_SAMPLING_STORAGE_KEY = "vikini.strataSampling" as const;

export interface StrataSamplingState extends StrataSamplingValues {
  mode: StrataSamplingMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPresetValues(mode: "default" | "creative", thinkingOn: boolean): StrataSamplingValues {
  return thinkingOn
    ? { ...STRATA_SAMPLING_PRESETS[mode].thinkingOn }
    : { ...STRATA_SAMPLING_PRESETS[mode].thinkingOff };
}

export function parseStoredStrataSampling(
  raw: string | null,
  thinkingOn: boolean = false
): StrataSamplingState {
  if (!raw) {
    return {
      mode: "default",
      ...getPresetValues("default", thinkingOn),
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        mode: "default",
        ...getPresetValues("default", thinkingOn),
      };
    }

    const mode: StrataSamplingMode =
      parsed.mode === "creative" || parsed.mode === "custom" ? parsed.mode : "default";

    if (mode === "default" || mode === "creative") {
      return {
        mode,
        ...getPresetValues(mode, thinkingOn),
      };
    }

    const sanitized = sanitizeStrataSampling(
      {
        mode: "custom",
        temperature: typeof parsed.temperature === "number" ? parsed.temperature : undefined,
        top_p: typeof parsed.top_p === "number" ? parsed.top_p : undefined,
        top_k: typeof parsed.top_k === "number" ? parsed.top_k : undefined,
        min_p: typeof parsed.min_p === "number" ? parsed.min_p : undefined,
        presence_penalty:
          typeof parsed.presence_penalty === "number" ? parsed.presence_penalty : undefined,
      },
      thinkingOn
    );

    return {
      mode: "custom",
      ...sanitized,
    };
  } catch {
    return {
      mode: "default",
      ...getPresetValues("default", thinkingOn),
    };
  }
}

/**
 * Pure helper used by `useChatStreamController` to attach `strataSampling` to `/api/chat-stream` requests.
 */
export function readStoredStrataSampling(thinkingOn: boolean = false): StrataSamplingInput {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STRATA_SAMPLING_STORAGE_KEY)
        : null;
    const state = parseStoredStrataSampling(raw, thinkingOn);
    if (state.mode === "default") {
      return { mode: "default" };
    }
    if (state.mode === "creative") {
      return { mode: "creative" };
    }
    return {
      mode: "custom",
      temperature: state.temperature,
      top_p: state.top_p,
      top_k: state.top_k,
      min_p: state.min_p,
      presence_penalty: state.presence_penalty,
    };
  } catch {
    return { mode: "default" };
  }
}

function persistState(state: StrataSamplingState): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STRATA_SAMPLING_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export interface UseStrataSamplingResult {
  sampling: StrataSamplingState;
  selectMode: (mode: StrataSamplingMode, thinkingOn: boolean) => void;
  updateCustomParam: (key: keyof StrataSamplingValues, value: number, thinkingOn: boolean) => void;
  resetToDefault: (thinkingOn: boolean) => void;
}

export function useStrataSampling(thinkingOn: boolean): UseStrataSamplingResult {
  const [sampling, setSampling] = useState<StrataSamplingState>(() => ({
    mode: "default",
    ...getPresetValues("default", thinkingOn),
  }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STRATA_SAMPLING_STORAGE_KEY);
      setSampling(parseStoredStrataSampling(raw, thinkingOn));
    } catch {
      // Ignore errors
    }
  }, [thinkingOn]);

  const selectMode = useCallback((mode: StrataSamplingMode, isThinkingOn: boolean) => {
    setSampling((prev) => {
      const nextValues =
        mode === "default" || mode === "creative"
          ? getPresetValues(mode, isThinkingOn)
          : sanitizeStrataSampling(prev, isThinkingOn);
      const next: StrataSamplingState = {
        mode,
        ...nextValues,
      };
      persistState(next);
      return next;
    });
  }, []);

  const updateCustomParam = useCallback(
    (key: keyof StrataSamplingValues, value: number, isThinkingOn: boolean) => {
      setSampling((prev) => {
        const baseValues =
          prev.mode === "default" || prev.mode === "creative"
            ? getPresetValues(prev.mode, isThinkingOn)
            : prev;
        const sanitized = sanitizeStrataSampling(
          {
            ...baseValues,
            mode: "custom",
            [key]: value,
          },
          isThinkingOn
        );
        const next: StrataSamplingState = {
          mode: "custom",
          ...sanitized,
        };
        persistState(next);
        return next;
      });
    },
    []
  );

  const resetToDefault = useCallback((isThinkingOn: boolean) => {
    const next: StrataSamplingState = {
      mode: "default",
      ...getPresetValues("default", isThinkingOn),
    };
    setSampling(next);
    persistState(next);
  }, []);

  return {
    sampling,
    selectMode,
    updateCustomParam,
    resetToDefault,
  };
}

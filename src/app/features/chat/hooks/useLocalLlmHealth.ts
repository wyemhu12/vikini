"use client";

import useSWR from "swr";

export type LocalLlmStatus = "disabled" | "checking" | "online" | "busy" | "offline";

export interface LocalLlmHealthData {
  enabled: boolean;
  online: boolean;
  loaded: boolean;
  model: string | null;
  maxContext: number | null;
  queue: {
    active: 0 | 1;
    pending: number;
  };
}

interface HealthApiResponse {
  success?: boolean;
  data?: LocalLlmHealthData;
}

async function fetchLocalLlmHealth(url: string): Promise<HealthApiResponse> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  const json: unknown = await res.json();
  if (typeof json === "object" && json !== null) {
    return json as HealthApiResponse;
  }
  return {};
}

export interface UseLocalLlmHealthOptions {
  active: boolean;
}

export interface UseLocalLlmHealthResult {
  status: LocalLlmStatus;
  health: LocalLlmHealthData | null;
  isLoading: boolean;
  refresh: () => void;
}

export function deriveLocalLlmStatus(
  health: LocalLlmHealthData | null | undefined,
  hasError: boolean
): LocalLlmStatus {
  if (hasError) return "offline";
  if (!health) return "checking";
  if (!health.enabled) return "disabled";
  if (!health.online) return "offline";
  if (health.queue.active === 1) return "busy";
  return "online";
}

export function useLocalLlmHealth({ active }: UseLocalLlmHealthOptions): UseLocalLlmHealthResult {
  const { data, error, isLoading, mutate } = useSWR<HealthApiResponse>(
    active ? "/api/local-llm/health" : null,
    fetchLocalLlmHealth,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      shouldRetryOnError: false,
    }
  );

  const health = data?.data ?? null;
  const status = deriveLocalLlmStatus(health, Boolean(error));

  return {
    status,
    health,
    isLoading,
    refresh: () => {
      void mutate();
    },
  };
}

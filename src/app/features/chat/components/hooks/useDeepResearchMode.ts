// /app/features/chat/components/hooks/useDeepResearchMode.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ResearchTask, ResearchAgent } from "@/lib/features/research/types";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

const STORAGE_KEY = "vikini.researchAgent";
const ACTIVE_RESEARCH_KEY = "vikini-active-research";
const DEFAULT_AGENT: ResearchAgent = "deep-research-preview-04-2026";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_COUNT = 180; // ~30 min at 10s intervals
const MAX_CONSECUTIVE_ERRORS = 5;

/** Unwrap standardized API response: { success, data: T } */
interface ApiSuccessResponse<T> {
  success: boolean;
  data: T;
}

function unwrapResponse<T>(json: unknown): T {
  const resp = json as ApiSuccessResponse<T>;
  if (resp && typeof resp === "object" && "data" in resp) {
    return resp.data;
  }
  return json as T;
}

interface UseDeepResearchModeReturn {
  // Mode state
  isDeepResearchMode: boolean;
  enterDeepResearch: () => void;
  exitDeepResearch: () => void;

  // Agent selection
  selectedAgent: ResearchAgent;
  setSelectedAgent: (agent: ResearchAgent) => void;

  // Research task state
  currentTask: ResearchTask | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startResearch: (
    query: string,
    conversationId?: string,
    projectId?: string,
    gemId?: string
  ) => Promise<void>;
  approvePlan: (feedback?: string) => Promise<void>;
  dismissTask: () => void;

  // Report panel
  isReportPanelOpen: boolean;
  openReportPanel: () => void;
  closeReportPanel: () => void;

  // Thinking panel
  isThinkingPanelOpen: boolean;
  openThinkingPanel: () => void;
  closeThinkingPanel: () => void;
  toggleThinkingPanel: () => void;
}

const VALID_AGENTS: ResearchAgent[] = [
  "deep-research-fast-04-2026",
  "deep-research-preview-04-2026",
  "deep-research-max-preview-04-2026",
];

function isValidAgent(value: string): value is ResearchAgent {
  return VALID_AGENTS.includes(value as ResearchAgent);
}

export function useDeepResearchMode(): UseDeepResearchModeReturn {
  const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);
  const [selectedAgent, setSelectedAgentState] = useState<ResearchAgent>(DEFAULT_AGENT);
  const [currentTask, setCurrentTask] = useState<ResearchTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReportPanelOpen, setIsReportPanelOpen] = useState(false);
  const [isThinkingPanelOpen, setIsThinkingPanelOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const consecutiveErrorRef = useRef(0);

  // Initialize agent from localStorage + resume active research
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidAgent(stored)) {
        setSelectedAgentState(stored);
      }
    } catch {
      // Ignore storage access errors
    }

    // Resume polling for active research task
    try {
      const activeTaskId = localStorage.getItem(ACTIVE_RESEARCH_KEY);
      if (activeTaskId) {
        setIsDeepResearchMode(true);
        setIsLoading(true);
        pollTask(activeTaskId);
      }
    } catch {
      // Ignore storage access errors
    }
    // pollTask is stable (useCallback with no deps change)
  }, []);

  const setSelectedAgent = useCallback((agent: ResearchAgent) => {
    setSelectedAgentState(agent);
    try {
      localStorage.setItem(STORAGE_KEY, agent);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const enterDeepResearch = useCallback(() => {
    setIsDeepResearchMode(true);
    setError(null);
  }, []);

  const exitDeepResearch = useCallback(() => {
    setIsDeepResearchMode(false);
    setError(null);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollTask = useCallback(
    (taskId: string) => {
      // Guard: don't poll with invalid taskId
      if (!taskId || taskId === "undefined" || taskId === "null") {
        const msg = "Cannot poll: invalid task ID";
        logger.error("[useDeepResearchMode]", msg);
        setError(msg);
        toast.error(msg);
        setIsLoading(false);
        try {
          localStorage.removeItem(ACTIVE_RESEARCH_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      stopPolling();
      pollCountRef.current = 0;
      consecutiveErrorRef.current = 0;

      const poll = async () => {
        pollCountRef.current += 1;

        if (pollCountRef.current > MAX_POLL_COUNT) {
          stopPolling();
          setIsLoading(false);
          const timeoutMsg = "Research polling timed out after 30 minutes";
          setError(timeoutMsg);
          toast.error(timeoutMsg);
          try {
            localStorage.removeItem(ACTIVE_RESEARCH_KEY);
          } catch {
            /* ignore */
          }
          return;
        }

        try {
          const res = await fetch(`/api/deep-research/${taskId}`);
          if (!res.ok) {
            const errJson = (await res.json()) as { error?: { message?: string } | string };
            const errMsg =
              typeof errJson.error === "object" && errJson.error
                ? errJson.error.message || "Failed to fetch task"
                : typeof errJson.error === "string"
                  ? errJson.error
                  : "Failed to fetch task";
            throw new Error(errMsg);
          }
          const json: unknown = await res.json();
          const { task } = unwrapResponse<{ task: ResearchTask }>(json);
          consecutiveErrorRef.current = 0; // Reset on success
          setCurrentTask(task);

          if (task.status === "completed" || task.status === "failed") {
            stopPolling();
            setIsLoading(false);
            try {
              localStorage.removeItem(ACTIVE_RESEARCH_KEY);
            } catch {
              /* ignore */
            }
            if (task.status === "failed") {
              const failMsg = task.errorMessage || "Research failed";
              setError(failMsg);
              toast.error(failMsg);
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          logger.error("[useDeepResearchMode] poll error:", message);
          consecutiveErrorRef.current += 1;

          if (consecutiveErrorRef.current >= MAX_CONSECUTIVE_ERRORS) {
            stopPolling();
            setIsLoading(false);
            const persistentMsg = `Research polling stopped: ${message}`;
            setError(persistentMsg);
            toast.error(persistentMsg);
            try {
              localStorage.removeItem(ACTIVE_RESEARCH_KEY);
            } catch {
              /* ignore */
            }
          }
        }
      };

      // Initial poll immediately
      void poll();
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const startResearch = useCallback(
    async (query: string, conversationId?: string, projectId?: string, gemId?: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const body = {
          query,
          agentModel: selectedAgent,
          ...(conversationId && { conversationId }),
          ...(projectId && { projectId }),
          ...(gemId && { gemId }),
        };

        const res = await fetch("/api/deep-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errJson = (await res.json()) as { error?: { message?: string } | string };
          const errMsg =
            typeof errJson.error === "object" && errJson.error
              ? errJson.error.message || "Failed to start research"
              : typeof errJson.error === "string"
                ? errJson.error
                : "Failed to start research";
          throw new Error(errMsg);
        }

        const json: unknown = await res.json();
        const { task } = unwrapResponse<{ task: ResearchTask }>(json);

        if (!task?.id) {
          throw new Error("Invalid response: missing task ID");
        }

        setCurrentTask(task);
        try {
          localStorage.setItem(ACTIVE_RESEARCH_KEY, task.id);
        } catch {
          /* ignore */
        }

        // Start polling for updates
        pollTask(task.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error("[useDeepResearchMode] startResearch error:", message);
        setError(message);
        toast.error(message);
        setIsLoading(false);
      }
    },
    [selectedAgent, pollTask]
  );

  const approvePlan = useCallback(
    async (feedback?: string) => {
      if (!currentTask) return;

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/deep-research/${currentTask.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        });

        if (!res.ok) {
          const errJson = (await res.json()) as { error?: { message?: string } | string };
          const errMsg =
            typeof errJson.error === "object" && errJson.error
              ? errJson.error.message || "Failed to approve plan"
              : typeof errJson.error === "string"
                ? errJson.error
                : "Failed to approve plan";
          throw new Error(errMsg);
        }

        const json: unknown = await res.json();
        const { task } = unwrapResponse<{ task: ResearchTask }>(json);
        setCurrentTask(task);

        // Continue polling
        pollTask(task.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error("[useDeepResearchMode] approvePlan error:", message);
        setError(message);
        toast.error(message);
        setIsLoading(false);
      }
    },
    [currentTask, pollTask]
  );

  const dismissTask = useCallback(() => {
    stopPolling();
    setCurrentTask(null);
    setIsDeepResearchMode(false);
    setIsLoading(false);
    setError(null);
    setIsReportPanelOpen(false);
    setIsThinkingPanelOpen(false);
    try {
      localStorage.removeItem(ACTIVE_RESEARCH_KEY);
    } catch {
      /* ignore */
    }
  }, [stopPolling]);

  const openReportPanel = useCallback(() => {
    setIsReportPanelOpen(true);
  }, []);

  const closeReportPanel = useCallback(() => {
    setIsReportPanelOpen(false);
  }, []);

  const openThinkingPanel = useCallback(() => {
    setIsThinkingPanelOpen(true);
  }, []);

  const closeThinkingPanel = useCallback(() => {
    setIsThinkingPanelOpen(false);
  }, []);

  const toggleThinkingPanel = useCallback(() => {
    setIsThinkingPanelOpen((p) => !p);
  }, []);

  return {
    isDeepResearchMode,
    enterDeepResearch,
    exitDeepResearch,
    selectedAgent,
    setSelectedAgent,
    currentTask,
    isLoading,
    error,
    startResearch,
    approvePlan,
    dismissTask,
    isReportPanelOpen,
    openReportPanel,
    closeReportPanel,
    isThinkingPanelOpen,
    openThinkingPanel,
    closeThinkingPanel,
    toggleThinkingPanel,
  };
}

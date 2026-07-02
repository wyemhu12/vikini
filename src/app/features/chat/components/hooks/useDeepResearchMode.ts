// /app/features/chat/components/hooks/useDeepResearchMode.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { isValidAgent, type ResearchTask, type ResearchAgent } from "@/lib/features/research/types";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

const STORAGE_KEY = "vikini.researchAgent";
const ACTIVE_RESEARCH_KEY = "vikini-active-research";
const DEFAULT_AGENT: ResearchAgent = "deep-research-preview-04-2026";

// Adaptive polling: fast during planning (plan usually ready in ~3s), slower during execution
const POLL_INTERVAL_PLANNING_MS = 3_000;
const POLL_INTERVAL_EXECUTING_MS = 15_000;
const MAX_POLL_COUNT = 120; // ~30 min at 15s intervals (executing phase)
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
  cancelResearch: () => Promise<void>; // UX-02: cancel in-progress task
  retryResearch: () => Promise<void>; // UX-04: re-start a failed task with same query
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

// VALID_AGENTS and isValidAgent are imported from types.ts — no local copy needed (BUG-08)

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

  // Store pollTask in a ref so the initialization useEffect can call the latest version
  // without needing pollTask in its dependency array (BUG-10).
  const pollTaskRef = useRef<(taskId: string) => void>(() => undefined);

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

    // Resume polling via ref — avoids stale-closure / missing-dep ESLint warning (BUG-10)
    try {
      const activeTaskId = localStorage.getItem(ACTIVE_RESEARCH_KEY);
      if (activeTaskId) {
        setIsDeepResearchMode(true);
        setIsLoading(true);
        pollTaskRef.current(activeTaskId);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []); // intentionally empty — reads from refs only

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
          consecutiveErrorRef.current = 0;
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
              // Only show error toast if not user-cancelled
              if (failMsg !== "Cancelled by user") toast.error(failMsg);
            }
          } else {
            // Adaptive polling: use a faster interval during planning phase (UX-06).
            // Restart the interval with the appropriate delay for the current status.
            const nextInterval =
              task.status === "planning" ? POLL_INTERVAL_PLANNING_MS : POLL_INTERVAL_EXECUTING_MS;
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = setInterval(poll, nextInterval);
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

      // Initial poll immediately; start with planning interval — adapts on first response (UX-06)
      void poll();
      pollRef.current = setInterval(poll, POLL_INTERVAL_PLANNING_MS);
    },
    [stopPolling]
  );

  // Wire the ref so the initialization useEffect always calls the latest version (BUG-10)
  // Must come after pollTask is defined.
  pollTaskRef.current = pollTask;

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

  // UX-02: Cancel an in-progress research task.
  // Calls the DELETE endpoint which marks the task as failed server-side,
  // causing the next poll to stop and show a clean dismissed state.
  const cancelResearch = useCallback(async () => {
    if (!currentTask) return;
    stopPolling();
    try {
      await fetch(`/api/deep-research/${currentTask.id}`, { method: "DELETE" });
    } catch {
      // Best-effort — even if the request fails, we clean up client-side
    }
    setCurrentTask(null);
    setIsDeepResearchMode(false);
    setIsLoading(false);
    setError(null);
    try {
      localStorage.removeItem(ACTIVE_RESEARCH_KEY);
    } catch {
      /* ignore */
    }
  }, [currentTask, stopPolling]);

  // UX-04: Retry a failed task using the same query and current agent selection.
  const retryResearch = useCallback(async () => {
    if (!currentTask) return;
    const query = currentTask.query;
    const conversationId = currentTask.conversationId ?? undefined;
    const projectId = currentTask.projectId ?? undefined;
    const gemId = currentTask.gemId ?? undefined;
    // Reset state then kick off a fresh search
    setCurrentTask(null);
    setError(null);
    await startResearch(query, conversationId, projectId, gemId);
  }, [currentTask, startResearch]);

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
    cancelResearch,
    retryResearch,
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

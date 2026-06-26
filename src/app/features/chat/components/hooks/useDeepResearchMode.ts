// /app/features/chat/components/hooks/useDeepResearchMode.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ResearchTask, ResearchAgent } from "@/lib/features/research/types";
import { logger } from "@/lib/utils/logger";

const STORAGE_KEY = "vikini.researchAgent";
const DEFAULT_AGENT: ResearchAgent = "deep-research-preview-04-2026";
const POLL_INTERVAL_MS = 10_000;

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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize agent from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidAgent(stored)) {
        setSelectedAgentState(stored);
      }
    } catch {
      // Ignore storage access errors
    }
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
      stopPolling();

      const poll = async () => {
        try {
          const res = await fetch(`/api/deep-research/${taskId}`);
          if (!res.ok) {
            const errJson = (await res.json()) as { error?: string };
            throw new Error(errJson.error || "Failed to fetch task");
          }
          const task = (await res.json()) as ResearchTask;
          setCurrentTask(task);

          if (task.status === "completed" || task.status === "failed") {
            stopPolling();
            setIsLoading(false);
            if (task.status === "failed") {
              setError(task.errorMessage || "Research failed");
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          logger.error("[useDeepResearchMode] poll error:", message);
          // Don't stop polling on transient errors
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
          const errJson = (await res.json()) as { error?: string };
          throw new Error(errJson.error || "Failed to start research");
        }

        const task = (await res.json()) as ResearchTask;
        setCurrentTask(task);

        // Start polling for updates
        pollTask(task.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error("[useDeepResearchMode] startResearch error:", message);
        setError(message);
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
          const errJson = (await res.json()) as { error?: string };
          throw new Error(errJson.error || "Failed to approve plan");
        }

        const task = (await res.json()) as ResearchTask;
        setCurrentTask(task);

        // Continue polling
        pollTask(task.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error("[useDeepResearchMode] approvePlan error:", message);
        setError(message);
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
  }, [stopPolling]);

  const openReportPanel = useCallback(() => {
    setIsReportPanelOpen(true);
  }, []);

  const closeReportPanel = useCallback(() => {
    setIsReportPanelOpen(false);
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
  };
}

"use client";

// Deep Research render section — extracted from ChatApp.tsx
// Renders research progress cards, plan cards, and report cards

import React from "react";
import { Microscope } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import type { ResearchTask } from "@/lib/features/research/types";

import ResearchPlanCard from "../../research/components/ResearchPlanCard";
import ResearchProgressCard from "../../research/components/ResearchProgressCard";
import ResearchReportCard from "../../research/components/ResearchReportCard";

interface ChatDeepResearchProps {
  currentTask: ResearchTask | null;
  pendingQuery: string | null;
  isApproving: boolean;
  approvePlan: (feedback?: string) => Promise<void>;
  cancelResearch: () => Promise<void>;
  openReportPanel: () => void;
  openThinkingPanel: () => void;
  onEditPlan: () => void;
  t: Record<string, string>;
}

export default function ChatDeepResearch({
  currentTask,
  pendingQuery,
  isApproving,
  approvePlan,
  cancelResearch,
  openReportPanel,
  openThinkingPanel,
  onEditPlan,
  t,
}: ChatDeepResearchProps) {
  const handleCancel = () =>
    cancelResearch().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to cancel"));

  // Optimistic card while API creates the task
  if (!currentTask && pendingQuery) {
    return (
      <div className="flex w-full flex-col gap-3 py-6">
        <div className="flex max-w-[95%] lg:max-w-[90%] gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Microscope className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-4 max-w-full">
            <ResearchProgressCard topic={pendingQuery} phase="planning" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentTask) return null;

  return (
    <div className="flex w-full flex-col gap-3 py-6">
      <div className="flex max-w-[95%] lg:max-w-[90%] gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Microscope className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-4 max-w-full">
          {currentTask.status === "planning" && (
            <ResearchProgressCard
              topic={currentTask.query}
              currentStep={currentTask.currentStep}
              phase="planning"
              startedAt={currentTask.createdAt}
              sourceCount={currentTask.searchedSources?.length}
              onStop={handleCancel}
              onShowThinking={openThinkingPanel}
            />
          )}
          {currentTask.status === "ready_to_execute" && !isApproving && (
            <ResearchPlanCard
              topic={currentTask.query}
              planText={currentTask.planText}
              onApprove={() =>
                approvePlan().catch((e) => toast.error(e.message || "Failed to approve"))
              }
              onEdit={onEditPlan}
              onStop={handleCancel}
            />
          )}
          {/* Show executing card immediately when approve is clicked (optimistic) */}
          {(currentTask.status === "executing" ||
            (currentTask.status === "ready_to_execute" && isApproving)) && (
            <ResearchProgressCard
              topic={currentTask.query}
              currentStep={currentTask.status === "executing" ? currentTask.currentStep : undefined}
              phase="executing"
              startedAt={
                currentTask.status === "executing"
                  ? currentTask.createdAt
                  : new Date().toISOString()
              }
              sourceCount={currentTask.searchedSources?.length}
              onStop={handleCancel}
              onShowThinking={openThinkingPanel}
            />
          )}
          {currentTask.status === "completed" && (
            <ResearchReportCard
              topic={currentTask.query}
              onOpen={openReportPanel}
              completedAt={currentTask.updatedAt}
            />
          )}
          {currentTask.status === "failed" && (
            <div className="p-4 rounded-2xl bg-(--danger)/10 border border-(--danger)/20 text-(--danger)">
              <p className="font-semibold mb-1">{t.deepResearchFailed || "Research failed"}</p>
              <p className="text-sm opacity-80">{currentTask.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

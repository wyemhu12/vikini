"use client";

import { useState } from "react";
import {
  FolderOpen,
  Folder,
  BookOpen,
  Briefcase,
  Target,
  Rocket,
  Lightbulb,
  Zap,
  FlaskConical,
  Palette,
  BarChart3,
  Star,
  Plus,
  ChevronDown,
  Check,
  Settings,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjectStore } from "@/lib/store/projectStore";
import type { ProjectWithStats } from "@/types/projects";

// Map icon id to Lucide component
const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  "folder-open": FolderOpen,
  book: BookOpen,
  briefcase: Briefcase,
  target: Target,
  rocket: Rocket,
  lightbulb: Lightbulb,
  zap: Zap,
  flask: FlaskConical,
  palette: Palette,
  chart: BarChart3,
  star: Star,
};

function getIconComponent(iconId?: string | null): LucideIcon {
  return ICON_MAP[iconId || "folder"] || Folder;
}

interface ProjectSwitcherProps {
  onCreateProject?: () => void;
  onManageProject?: (projectId: string) => void;
  className?: string;
}

/**
 * Project Switcher Dropdown
 * Shows current project and allows switching between projects
 */
export function ProjectSwitcher({
  onCreateProject,
  onManageProject,
  className,
}: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { projects, getCurrentProject, setCurrentProject, limits, isLoading } = useProjectStore();

  const currentProject = getCurrentProject();

  const canCreateMore = projects.length < (limits?.maxProjects ?? 5);

  const handleSelect = (project: ProjectWithStats | null) => {
    setCurrentProject(project?.id ?? null);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 rounded-lg",
          "bg-(--control-bg) hover:bg-(--control-bg-hover) transition-colors",
          "border border-(--control-border)",
          "text-sm font-medium text-(--text-primary)"
        )}
      >
        <span
          className="w-6 h-6 flex items-center justify-center rounded"
          style={{ backgroundColor: currentProject?.color || "var(--accent)" }}
        >
          {(() => {
            const IconComp = getIconComponent(currentProject?.icon);
            return <IconComp className="h-3.5 w-3.5 text-white" />;
          })()}
        </span>
        <span className="flex-1 text-left truncate">{currentProject?.name || "No Project"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div
            className={cn(
              "absolute top-full left-0 right-0 mt-1 z-50",
              "bg-[color-mix(in_srgb,var(--surface)_97%,transparent)] backdrop-blur-xl",
              "border-2 border-(--border) rounded-lg shadow-2xl",
              "max-h-[300px] overflow-auto"
            )}
          >
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-(--text-primary)",
                "hover:bg-(--control-bg-hover) transition-colors",
                !currentProject && "bg-(--control-bg)"
              )}
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">No Project</span>
              {!currentProject && <Check className="h-4 w-4 text-primary" />}
            </button>

            {/* Divider */}
            {projects.length > 0 && <div className="border-t border-(--border) my-1" />}

            {/* Project List */}
            {projects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 group",
                  "hover:bg-(--control-bg-hover) transition-colors text-(--text-primary)",
                  currentProject?.id === project.id && "bg-(--control-bg)"
                )}
              >
                <button
                  onClick={() => handleSelect(project)}
                  className="flex items-center gap-2 flex-1 text-sm text-(--text-primary)"
                >
                  {(() => {
                    const IconComp = getIconComponent(project.icon);
                    return (
                      <span
                        className="w-5 h-5 flex items-center justify-center rounded"
                        style={{ backgroundColor: project.color }}
                      >
                        <IconComp className="h-3 w-3 text-white" />
                      </span>
                    );
                  })()}
                  <span className="flex-1 text-left truncate">{project.name}</span>
                  {currentProject?.id === project.id && <Check className="h-4 w-4 text-primary" />}
                </button>

                {/* Project Actions */}
                {onManageProject && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onManageProject(project.id);
                      setIsOpen(false);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-(--control-bg-hover) rounded"
                    title="Project settings"
                  >
                    <Settings className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}

            {/* Loading State */}
            {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>}

            {/* Create New Project */}
            {onCreateProject && (
              <>
                <div className="border-t border-(--border) my-1" />
                <button
                  onClick={() => {
                    onCreateProject();
                    setIsOpen(false);
                  }}
                  disabled={!canCreateMore}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm",
                    "hover:bg-(--control-bg-hover) transition-colors text-(--accent)",
                    !canCreateMore && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="text-primary">New Project</span>
                  {!canCreateMore && (
                    <span className="text-xs text-muted-foreground ml-auto">Limit reached</span>
                  )}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

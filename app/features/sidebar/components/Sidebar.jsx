// /app/features/sidebar/components/Sidebar.jsx
"use client";

import SidebarItem from "./SidebarItem";
import Link from "next/link";
import { useGemStore } from "../../gems/stores/useGemStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Shield,
  LogOut,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function Sidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAll,
  onRefresh,
  chats,
  activeId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  onLogout,
  t,
  mobileOpen = false,
  onCloseMobile,
  session,
  collapsed = false,
  onToggleCollapse,
  onLogoClick,
}) {
  const { openGemModal } = useGemStore();

  const list = Array.isArray(chats) ? chats : Array.isArray(conversations) ? conversations : [];

  const currentId = activeId ?? selectedConversationId ?? null;

  const handleSelect = (id) => {
    (onSelectChat ?? onSelectConversation)?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  const handleOpenGems = () => {
    openGemModal(currentId);
    onCloseMobile?.();
  };

  const renameFallback = async (id) => {
    try {
      const current = list.find((c) => c?.id === id);
      const curTitle = current?.title || "";
      const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
      if (nextTitle) {
        const title = String(nextTitle).trim();
        await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, title }),
        });
        await onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteFallback = async (id) => {
    try {
      if (window.confirm("Xoá cuộc hội thoại này?")) {
        await fetch("/api/conversations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (currentId === id) {
          const next = list.find((c) => c?.id && c.id !== id);
          if (next?.id) handleSelect(next.id);
        }
        await onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = (id) =>
    typeof onRenameChat === "function" ? onRenameChat(id) : renameFallback(id);
  const handleDelete = (id) => {
    const fn = onDeleteChat ?? onDeleteConversation;
    return typeof fn === "function" ? fn(id) : deleteFallback(id);
  };

  const SidebarButton = ({ onClick, icon: Icon, label, variant = "default", className }) => {
    const button = (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2.5 transition-all duration-200 group active:scale-[0.98]",
          collapsed ? "justify-center px-0 w-full" : "justify-start px-3 w-full",
          // Colors
          variant === "primary" &&
            "bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)] border border-[var(--control-border)] text-[var(--accent)] font-bold shadow-sm",
          variant === "default" &&
            "text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)] hover:text-[var(--text-primary)]",
          variant === "destructive" &&
            "text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500",
          className
        )}
        type="button"
      >
        <span
          className={cn(
            "flex-shrink-0 transition-transform duration-300",
            variant === "primary" && "group-hover:rotate-90"
          )}
        >
          <Icon className="w-5 h-5" />
        </span>
        {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return button;
  };

  const content = (
    <div className="flex flex-col h-full text-[var(--text-primary)]">
      {/* Actions */}
      <div className="mb-4 space-y-2">
        <SidebarButton
          onClick={handleNew}
          icon={Plus}
          label={t?.newChat || "New Chat"}
          variant="primary"
        />
        <SidebarButton
          onClick={handleOpenGems}
          icon={Sparkles}
          label={t?.exploreGems || "Explore Gems"}
        />
      </div>

      <div className={cn("h-px bg-[var(--border)]/60 mb-4 mx-2", collapsed && "hidden")} />

      {/* Chat list */}
      <div
        className={cn(
          "flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-[var(--control-border)] hover:scrollbar-thumb-[var(--border)]",
          collapsed && "hidden" // Hide list when collapsed for simplicity
        )}
      >
        {!collapsed &&
          list.map((c) => (
            <SidebarItem
              key={c.id}
              conversation={c}
              isActive={c.id === currentId}
              onSelect={handleSelect}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        {!collapsed && list.length === 0 && (
          <div className="text-center py-10 text-[10px] font-bold text-[var(--text-secondary)] opacity-60 select-none">
            {t?.noConversations || "No conversations"}
          </div>
        )}
      </div>

      {/* Icon-only recent list if collapsed? Maybe just show New Chat icon is enough. */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center pt-4 border-t border-[var(--border)] gap-2">
          {/* Minimal placeholders or just empty space */}
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div
        className={cn("mt-auto pt-4 space-y-2", !collapsed && "border-t border-[var(--border)]")}
      >
        {onDeleteAll && !collapsed && (
          <SidebarButton
            onClick={() => onDeleteAll?.()}
            icon={Trash2}
            label={t?.deleteAll || "Clear History"}
            variant="destructive"
            className="text-[10px]"
          />
        )}
        {/* Toggle Button for Desktop */}
        <div className="hidden md:block">
          <SidebarButton
            onClick={onToggleCollapse}
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? "Expand" : "Collapse"}
          />
        </div>

        {/* ADMIN */}
        {session?.user?.rank === "admin" && (
          <SidebarButton
            onClick={() => (window.location.href = "/admin")}
            icon={Shield}
            label={t?.adminManagement || "Admin Management"}
          />
        )}

        {/* LOGOUT */}
        {onLogout && (
          <SidebarButton
            onClick={() => {
              onLogout?.();
              onCloseMobile?.();
            }}
            icon={LogOut}
            label={t?.signOut || t?.logout || "Sign Out"}
            variant="destructive"
          />
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 left-0 bottom-0 border-r border-[var(--border)] bg-[var(--surface-muted)]/90 backdrop-blur-3xl p-4 z-30 transition-all duration-300",
          collapsed ? "w-20" : "w-72 lg:w-80"
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer (Keeps original width/layout) */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-[var(--surface-muted)]/80 backdrop-blur-sm transition-opacity"
            onClick={() => onCloseMobile?.()}
          />
          <aside className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm border-r border-[var(--border)] bg-[var(--surface-muted)] p-6 pb-24 shadow-2xl flex flex-col">
            <div className="mb-8 flex items-center justify-between">
              <Link
                href="/"
                className="text-lg font-black tracking-tighter text-[var(--text-primary)] flex items-center gap-3 active:opacity-70 transition-opacity"
                onClick={() => {
                  onLogoClick?.();
                  onCloseMobile?.();
                }}
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--control-bg)] flex items-center justify-center border border-[var(--control-border)] text-[var(--accent)]">
                  V
                </div>
                {t?.appName || "Vikini"}
              </Link>
              <button
                onClick={() => onCloseMobile?.()}
                className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                ✕
              </button>
            </div>
            {/* Render content with collapsed=false prop override for mobile */}
            <div className="flex flex-col h-full text-[var(--text-primary)]">
              {/* Re-render logic for mobile or reuse helper? 
                   Reusing 'content' variable might be tricky if it strictly respects 'collapsed' prop 
                   which is derived from parent state for desktop.
                   Mobile should NEVER be collapsed.
               */}
              {/* Quick Fix: Force expanded content for mobile */}
              <SidebarButton
                onClick={handleNew}
                icon={Plus}
                label={t?.newChat || "New Chat"}
                variant="primary"
              />
              <SidebarButton
                onClick={handleOpenGems}
                icon={Sparkles}
                label={t?.exploreGems || "Explore Gems"}
              />

              <div className="h-px bg-[var(--border)]/60 my-4 mx-2" />

              <div className="flex-1 overflow-y-auto space-y-1">
                {list.map((c) => (
                  <SidebarItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === currentId}
                    onSelect={handleSelect}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-[var(--border)] space-y-2">
                {onDeleteAll && (
                  <SidebarButton
                    onClick={() => onDeleteAll?.()}
                    icon={Trash2}
                    label={t?.deleteAll || "Clear History"}
                    variant="destructive"
                  />
                )}
                {session?.user?.rank === "admin" && (
                  <SidebarButton
                    onClick={() => (window.location.href = "/admin")}
                    icon={Shield}
                    label={t?.adminManagement || "Admin Management"}
                  />
                )}
                {onLogout && (
                  <SidebarButton
                    onClick={() => {
                      onLogout?.();
                      onCloseMobile?.();
                    }}
                    icon={LogOut}
                    label={t?.signOut || t?.logout || "Sign Out"}
                    variant="destructive"
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
}

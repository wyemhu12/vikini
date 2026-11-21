"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Users, AlertCircle, Search, CheckSquare, Square, RotateCcw } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { logger } from "@/lib/utils/logger";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import UserDetailModal, { type Profile } from "./UserDetailModal";
import UserTableRow, { type UserRankOption } from "./UserTableRow";

type RankFilter = "all" | Profile["rank"];
type StatusFilter = "all" | "active" | "blocked";

const RANK_OPTIONS: readonly UserRankOption[] = [
  { value: "not_whitelisted", labelKey: "userNotWhitelisted" },
  { value: "basic", labelKey: "userBasic" },
  { value: "pro", labelKey: "userPro" },
  { value: "admin", labelKey: "userAdmin" },
];

const BULK_RANK_OPTIONS = RANK_OPTIONS.slice(0, 3);

const CHECKBOX_BTN_CLASS =
  "inline-flex h-9 w-9 md:h-7 md:w-7 items-center justify-center text-(--muted) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded cursor-pointer";

interface UserManagerProps {
  currentUserId: string;
}

export default function UserManager({ currentUserId }: UserManagerProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [detailStats, setDetailStats] = useState<{
    conversations: number;
    messages: number;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { t } = useLanguage();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(tRef.current("adminLoadFailed"));
      const json = await res.json();
      setUsers((json.data || json).users || []);
    } catch (err: unknown) {
      logger.error("[UserManager] Failed to load users:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (searchQuery && !user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (rankFilter !== "all" && user.rank !== rankFilter) return false;
        if (statusFilter === "active" && user.is_blocked) return false;
        if (statusFilter === "blocked" && !user.is_blocked) return false;
        return true;
      }),
    [users, searchQuery, rankFilter, statusFilter]
  );

  const isSelf = (userId: string) => userId === currentUserId;

  const openUserDetail = useCallback(async (user: Profile) => {
    setDetailUser(user);
    setDetailStats(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?userId=${user.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDetailStats(json.data || json);
    } catch (err: unknown) {
      logger.error("[UserManager] Failed to load user detail stats:", err);
      toast.error(tRef.current("adminUserDetailFailed"));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const updateUser = async (userId: string, updates: Partial<Profile>) => {
    // Self-protection: prevent modifying own account
    if (isSelf(userId)) return;

    try {
      setUpdating(userId);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error?.message || json?.error || t("failedUpdateUser"));

      toast.success(t("userUpdated") || "User updated successfully");
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedUpdateUser"));
    } finally {
      setUpdating(null);
    }
  };

  const handleRankChange = async (userId: string, newRank: string) => {
    const ok = await confirm({
      title: t("rankChangeConfirm") || "Change user rank?",
      description:
        t("rankChangeDesc") ||
        "This will immediately change the user's access level and permissions.",
      variant: "danger",
      confirmLabel: t("confirm") || "Confirm",
      cancelLabel: t("cancel") || "Cancel",
    });
    if (!ok) return;
    await updateUser(userId, { rank: newRank as Profile["rank"] });
  };

  // Bulk actions
  const selectableUsers = filteredUsers.filter((u) => !isSelf(u.id));
  const allSelectableSelected =
    selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.has(u.id));

  const toggleSelect = (userId: string) => {
    if (isSelf(userId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUsers.map((u) => u.id)));
    }
  };

  const bulkUpdate = async (updates: Partial<Profile>) => {
    const ids = Array.from(selectedIds).filter((id) => !isSelf(id));
    if (ids.length === 0) return;

    try {
      setUpdating("bulk");
      for (const userId of ids) {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, ...updates }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error?.message || t("failedUpdateUsers"));
        }
      }
      toast.success(t("adminBulkSuccess") || "Updated successfully");
      setSelectedIds(new Set());
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedUpdateUsers"));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div role="status" className="space-y-4 py-2">
        <span className="sr-only">{t("userLoadingUsers")}</span>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-[160px]" />
          <Skeleton className="h-10 w-full sm:w-[160px]" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/30 text-(--danger)"
      >
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchUsers()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-(--raised) hover:bg-(--raised-hover) text-(--text) border border-(--line) transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Users aria-hidden="true" className="w-5 h-5 text-(--accent)" />
        <h2 className="text-xl font-semibold text-(--text)">{t("userManagement")}</h2>
        <span className="text-sm text-(--faint)">
          ({filteredUsers.length}/{users.length} {t("userUsers")})
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--faint)"
          />
          <input
            type="text"
            aria-label={t("adminSearchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("adminSearchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 bg-(--raised) border border-(--line) rounded-lg text-sm text-(--text) placeholder:text-(--faint) focus:border-(--accent)/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) transition-colors"
          />
        </div>

        <Select value={rankFilter} onValueChange={(v) => setRankFilter(v as RankFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label={t("userRank")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminFilterAllRanks")}</SelectItem>
            {RANK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label={t("userStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminFilterAllStatus")}</SelectItem>
            <SelectItem value="active">{t("userActive")}</SelectItem>
            <SelectItem value="blocked">{t("userBlocked")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 p-3 rounded-lg bg-(--soft) border border-(--accent)/20">
          <span className="text-sm text-(--accent)">
            {selectedIds.size} {t("adminBulkSelected")}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select onValueChange={(v) => bulkUpdate({ rank: v as Profile["rank"] })}>
              <SelectTrigger className="w-[160px] h-auto py-1.5" aria-label={t("adminBulkSetRank")}>
                <SelectValue placeholder={t("adminBulkSetRank")} />
              </SelectTrigger>
              <SelectContent>
                {BULK_RANK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => bulkUpdate({ is_blocked: true })}
              disabled={updating === "bulk"}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-(--danger)/20 text-(--danger) hover:bg-(--danger)/30 border border-(--danger)/30 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none cursor-pointer"
            >
              {t("adminBulkBlock")}
            </button>
            <button
              type="button"
              onClick={() => bulkUpdate({ is_blocked: false })}
              disabled={updating === "bulk"}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-(--success)/20 text-(--success) hover:bg-(--success)/30 border border-(--success)/30 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none cursor-pointer"
            >
              {t("adminBulkUnblock")}
            </button>
          </div>
        </div>
      )}

      <div
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) rounded-lg"
        tabIndex={0}
        role="region"
        aria-label={t("userManagement")}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-(--line)">
              <th className="py-3 px-2 w-10">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  aria-label={t("adminSelectAllUsers")}
                  aria-pressed={allSelectableSelected}
                  className={CHECKBOX_BTN_CLASS}
                >
                  {allSelectableSelected ? (
                    <CheckSquare aria-hidden="true" className="w-4 h-4 text-(--accent)" />
                  ) : (
                    <Square aria-hidden="true" className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-(--muted)">
                {t("userEmail")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-(--muted)">
                {t("userRank")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-(--muted)">
                {t("userStatus")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-(--muted)">
                {t("userCreated")}
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-(--muted)">
                {t("userActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <UserTableRow
                key={user.id}
                user={user}
                isSelf={isSelf(user.id)}
                isSelected={selectedIds.has(user.id)}
                isUpdating={updating === user.id}
                checkboxButtonClass={CHECKBOX_BTN_CLASS}
                rankOptions={RANK_OPTIONS}
                onToggleSelect={toggleSelect}
                onOpenDetail={openUserDetail}
                onRankChange={handleRankChange}
                onToggleBlock={(id, isBlocked) => void updateUser(id, { is_blocked: isBlocked })}
              />
            ))}
          </tbody>
        </table>
      </div>

      <UserDetailModal
        user={detailUser}
        stats={detailStats}
        loading={detailLoading}
        onClose={() => setDetailUser(null)}
      />
    </div>
  );
}

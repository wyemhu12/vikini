"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Loader2,
  AlertCircle,
  Search,
  ShieldAlert,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { formatDate } from "@/lib/utils/dateFormat";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Profile {
  id: string;
  email: string;
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  is_blocked: boolean;
  created_at: string;
}

type RankFilter = "all" | Profile["rank"];
type StatusFilter = "all" | "active" | "blocked";

interface UserManagerProps {
  currentUserId: string;
}

export default function UserManager({ currentUserId }: UserManagerProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // User detail modal
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [detailStats, setDetailStats] = useState<{
    conversations: number;
    messages: number;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { t, language } = useLanguage();

  useEffect(() => {
    void fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      const data = json.data || json;
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter
      if (searchQuery && !user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Rank filter
      if (rankFilter !== "all" && user.rank !== rankFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === "active" && user.is_blocked) return false;
      if (statusFilter === "blocked" && !user.is_blocked) return false;
      return true;
    });
  }, [users, searchQuery, rankFilter, statusFilter]);

  const isSelf = (userId: string) => userId === currentUserId;

  const openUserDetail = useCallback(async (user: Profile) => {
    setDetailUser(user);
    setDetailStats(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?userId=${user.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailStats(json.data || json);
      }
    } catch {
      // Non-critical, just show empty stats
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

      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user");

      toast.success(t("userUpdated") || "User updated successfully");
      await fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("failedUpdateUser") || "Failed to update user"
      );
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
          throw new Error(json?.error?.message || "Failed to update user");
        }
      }
      toast.success(t("adminBulkSuccess") || "Updated successfully");
      setSelectedIds(new Set());
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update users");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">{t("userLoadingUsers")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">{t("userManagement")}</h2>
        <span className="text-sm text-gray-500">
          ({filteredUsers.length}/{users.length} {t("userUsers")})
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("adminSearchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Rank Filter */}
        <Select value={rankFilter} onValueChange={(v) => setRankFilter(v as RankFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminFilterAllRanks")}</SelectItem>
            <SelectItem value="not_whitelisted">{t("userNotWhitelisted")}</SelectItem>
            <SelectItem value="basic">{t("userBasic")}</SelectItem>
            <SelectItem value="pro">{t("userPro")}</SelectItem>
            <SelectItem value="admin">{t("userAdmin")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminFilterAllStatus")}</SelectItem>
            <SelectItem value="active">{t("userActive")}</SelectItem>
            <SelectItem value="blocked">{t("userBlocked")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-sm text-blue-400">
            {selectedIds.size} {t("adminBulkSelected")}
          </span>
          <div className="flex gap-2 ml-auto">
            <Select onValueChange={(v) => bulkUpdate({ rank: v as Profile["rank"] })}>
              <SelectTrigger className="w-[160px] h-auto py-1.5">
                <SelectValue placeholder={t("adminBulkSetRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_whitelisted">{t("userNotWhitelisted")}</SelectItem>
                <SelectItem value="basic">{t("userBasic")}</SelectItem>
                <SelectItem value="pro">{t("userPro")}</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => bulkUpdate({ is_blocked: true })}
              disabled={updating === "bulk"}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors disabled:opacity-50"
            >
              {t("adminBulkBlock")}
            </button>
            <button
              onClick={() => bulkUpdate({ is_blocked: false })}
              disabled={updating === "bulk"}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-colors disabled:opacity-50"
            >
              {t("adminBulkUnblock")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {/* Bulk select header */}
              <th className="py-3 px-2 w-8">
                <button
                  onClick={toggleSelectAll}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {allSelectableSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t("userEmail")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t("userRank")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t("userStatus")}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t("userCreated")}
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                {t("userActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const self = isSelf(user.id);
              return (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 hover:bg-white/2 ${self ? "opacity-70" : ""}`}
                >
                  {/* Bulk select checkbox */}
                  <td className="py-3 px-2">
                    {!self && (
                      <button
                        onClick={() => toggleSelect(user.id)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {selectedIds.has(user.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-white">
                    <button
                      onClick={() => openUserDetail(user)}
                      className="flex items-center gap-2 hover:text-blue-400 transition-colors text-left"
                    >
                      {user.email}
                      {self && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <ShieldAlert className="w-3 h-3" />
                          {t("adminSelfLabel")}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <Select
                      value={user.rank}
                      onValueChange={(v) => handleRankChange(user.id, v)}
                      disabled={self || updating === user.id}
                    >
                      <SelectTrigger className="w-[140px] h-auto py-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_whitelisted">{t("userNotWhitelisted")}</SelectItem>
                        <SelectItem value="basic">{t("userBasic")}</SelectItem>
                        <SelectItem value="pro">{t("userPro")}</SelectItem>
                        <SelectItem value="admin">{t("userAdmin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.is_blocked
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-green-500/20 text-green-400 border border-green-500/30"
                      }`}
                    >
                      {user.is_blocked ? t("userBlocked") : t("userActive")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-400">
                    {formatDate(user.created_at, language === "vi" ? "vi-VN" : "en-GB")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => updateUser(user.id, { is_blocked: !user.is_blocked })}
                      disabled={self || updating === user.id}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        user.is_blocked
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                          : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                      }`}
                    >
                      {updating === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      ) : user.is_blocked ? (
                        t("userUnblock")
                      ) : (
                        t("userBlock")
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* User Detail Modal */}
      <Dialog.Root
        open={!!detailUser}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-(--overlay) backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-label="User detail"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-(--surface-elevated) text-(--text-primary) border border-(--border) rounded-xl w-full max-w-md p-6 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-lg font-semibold">
                  {t("adminUserDetail")}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                  <div className="text-xs text-gray-500 mb-1">{t("userEmail")}</div>
                  <div className="text-sm font-medium">{detailUser?.email}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">{t("userRank")}</div>
                    <div className="text-sm font-medium capitalize">
                      {detailUser?.rank === "not_whitelisted"
                        ? t("userNotWhitelisted")
                        : detailUser?.rank}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">{t("userStatus")}</div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        detailUser?.is_blocked
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-green-500/20 text-green-400 border border-green-500/30"
                      }`}
                    >
                      {detailUser?.is_blocked ? t("userBlocked") : t("userActive")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">{t("adminUserConvs")}</div>
                    <div className="text-sm font-medium">
                      {detailLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        (detailStats?.conversations ?? "-")
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                    <div className="text-xs text-gray-500 mb-1">{t("adminUserMsgs")}</div>
                    <div className="text-sm font-medium">
                      {detailLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        (detailStats?.messages ?? "-")
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white/3 border border-white/10">
                  <div className="text-xs text-gray-500 mb-1">{t("adminUserJoined")}</div>
                  <div className="text-sm font-medium">
                    {formatDate(
                      detailUser?.created_at ?? "",
                      language === "vi" ? "vi-VN" : "en-GB"
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

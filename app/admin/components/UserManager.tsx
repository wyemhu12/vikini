"use client";

import { useState, useEffect } from "react";
import { Users, Loader2, AlertCircle } from "lucide-react";
import { translations } from "@/lib/utils/config";
import { toast } from "@/lib/store/toastStore";
import { formatDate } from "@/lib/utils/dateFormat";

interface Profile {
  id: string;
  email: string;
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  is_blocked: boolean;
  created_at: string;
}

interface UserManagerProps {
  language: "vi" | "en";
}

export default function UserManager({ language }: UserManagerProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const t = language === "vi" ? translations.vi : translations.en;

  useEffect(() => {
    fetchUsers();
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

  const updateUser = async (userId: string, updates: Partial<Profile>) => {
    try {
      setUpdating(userId);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user");

      toast.success(t.userUpdated || "User updated successfully");
      await fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t.failedUpdateUser || "Failed to update user"
      );
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">{t.userLoadingUsers}</span>
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
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">{t.userManagement}</h2>
        <span className="text-sm text-gray-500">
          ({users.length} {t.userUsers})
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t.userEmail}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t.userRank}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t.userStatus}
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                {t.userCreated}
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                {t.userActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4 text-sm text-white">{user.email}</td>
                <td className="py-3 px-4">
                  <select
                    value={user.rank}
                    onChange={(e) =>
                      updateUser(user.id, { rank: e.target.value as Profile["rank"] })
                    }
                    disabled={updating === user.id}
                    className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500/50 focus:outline-none disabled:opacity-50 cursor-pointer"
                    style={{
                      colorScheme: "dark",
                    }}
                  >
                    <option value="not_whitelisted" className="bg-[#1a1a1a] text-white">
                      {t.userNotWhitelisted}
                    </option>
                    <option value="basic" className="bg-[#1a1a1a] text-white">
                      {t.userBasic}
                    </option>
                    <option value="pro" className="bg-[#1a1a1a] text-white">
                      {t.userPro}
                    </option>
                    <option value="admin" className="bg-[#1a1a1a] text-white">
                      {t.userAdmin}
                    </option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      user.is_blocked
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-green-500/20 text-green-400 border border-green-500/30"
                    }`}
                  >
                    {user.is_blocked ? t.userBlocked : t.userActive}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">
                  {formatDate(user.created_at, language === "vi" ? "vi-VN" : "en-GB")}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => updateUser(user.id, { is_blocked: !user.is_blocked })}
                    disabled={updating === user.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                      user.is_blocked
                        ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    }`}
                  >
                    {updating === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : user.is_blocked ? (
                      t.userUnblock
                    ) : (
                      t.userBlock
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

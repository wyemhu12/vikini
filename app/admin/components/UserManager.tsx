"use client";

import { useState, useEffect } from "react";
import { Users, Loader2, AlertCircle } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  is_blocked: boolean;
  created_at: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
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

      if (!res.ok) throw new Error("Failed to update user");

      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Loading users...</span>
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
        <h2 className="text-xl font-semibold text-white">User Management</h2>
        <span className="text-sm text-gray-500">({users.length} users)</span>
      </div>

      {/* Whitelist Info Banner */}
      <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-blue-300 mb-1">Whitelist Status</div>
            <div className="text-xs text-gray-400">
              All users shown in this table are{" "}
              <span className="text-blue-400 font-medium">whitelisted</span>. Users are auto-added
              to the whitelist (profiles table) on first login if their email is in temp_user_ranks.
              To remove access, use the <span className="text-red-400">Block</span> button.
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rank</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Created</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
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
                      Not Whitelisted
                    </option>
                    <option value="basic" className="bg-[#1a1a1a] text-white">
                      Basic
                    </option>
                    <option value="pro" className="bg-[#1a1a1a] text-white">
                      Pro
                    </option>
                    <option value="admin" className="bg-[#1a1a1a] text-white">
                      Admin
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
                    {user.is_blocked ? "Blocked" : "Active"}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
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
                      "Unblock"
                    ) : (
                      "Block"
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

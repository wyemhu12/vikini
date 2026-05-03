"use client";

import { useState, useEffect } from "react";
import { ScrollText, Loader2, AlertCircle, Info } from "lucide-react";
import { translations } from "@/lib/utils/config";
import { formatDate } from "@/lib/utils/dateFormat";

interface AuditLog {
  id: string;
  action: string;
  admin_id: string;
  admin_email: string | null;
  target_id: string | null;
  target_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface AuditLogViewerProps {
  language: "vi" | "en";
}

// Human-readable action labels
const ACTION_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  UPDATE_USER_RANK: { vi: "Đổi xếp hạng", en: "Rank Changed", color: "text-blue-400" },
  BLOCK_USER: { vi: "Khóa tài khoản", en: "User Blocked", color: "text-red-400" },
  UNBLOCK_USER: { vi: "Mở khóa", en: "User Unblocked", color: "text-green-400" },
  UPDATE_RANK_CONFIG: { vi: "Cập nhật giới hạn", en: "Limits Updated", color: "text-purple-400" },
  CREATE_GEM: { vi: "Tạo GEM", en: "GEM Created", color: "text-amber-400" },
  UPDATE_GEM: { vi: "Sửa GEM", en: "GEM Updated", color: "text-amber-400" },
  DELETE_GEM: { vi: "Xóa GEM", en: "GEM Deleted", color: "text-red-400" },
  BULK_UPDATE_USERS: { vi: "Cập nhật hàng loạt", en: "Bulk Update", color: "text-purple-400" },
};

export default function AuditLogViewer({ language }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableExists, setTableExists] = useState(true);

  const t = language === "vi" ? translations.vi : translations.en;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/audit-log");
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const json = await res.json();
      const data = json.data || json;
      setLogs(data.logs || []);
      setTableExists(data.tableExists !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const entry = ACTION_LABELS[action];
    if (entry) return { label: language === "vi" ? entry.vi : entry.en, color: entry.color };
    return { label: action, color: "text-gray-400" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">{t.adminAuditLoading}</span>
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
        <ScrollText className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">{t.adminAuditLog}</h2>
        <span className="text-sm text-gray-500">({logs.length})</span>
      </div>

      {!tableExists && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">{t.adminAuditMigrationNeeded}</p>
            <p className="text-xs text-gray-400 mt-1">{t.adminAuditMigrationHint}</p>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t.adminAuditNoLogs}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const { label, color } = getActionLabel(log.action);
            return (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-white/2 border border-white/10 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(log.created_at, language === "vi" ? "vi-VN" : "en-GB")}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>
                    {t.adminAuditBy}:{" "}
                    <span className="text-gray-300">{log.admin_email || log.admin_id}</span>
                  </span>
                  {log.target_email && (
                    <span>
                      → <span className="text-gray-300">{log.target_email}</span>
                    </span>
                  )}
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 font-mono bg-white/2 rounded p-2">
                    {JSON.stringify(log.details, null, 0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

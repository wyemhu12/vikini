"use client";

import { useState, useEffect } from "react";
import { ScrollText, Loader2, AlertCircle, Info } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
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

// No props needed - language comes from useLanguage() hook

// Human-readable action labels
const ACTION_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  UPDATE_USER_RANK: { vi: "Đổi xếp hạng", en: "Rank Changed", color: "text-(--accent)" },
  BLOCK_USER: { vi: "Khóa tài khoản", en: "User Blocked", color: "text-(--danger)" },
  UNBLOCK_USER: { vi: "Mở khóa", en: "User Unblocked", color: "text-(--success)" },
  UPDATE_RANK_CONFIG: { vi: "Cập nhật giới hạn", en: "Limits Updated", color: "text-(--accent)" },
  CREATE_GEM: { vi: "Tạo GEM", en: "GEM Created", color: "text-(--warning)" },
  UPDATE_GEM: { vi: "Sửa GEM", en: "GEM Updated", color: "text-(--warning)" },
  DELETE_GEM: { vi: "Xóa GEM", en: "GEM Deleted", color: "text-(--danger)" },
  BULK_UPDATE_USERS: { vi: "Cập nhật hàng loạt", en: "Bulk Update", color: "text-(--accent)" },
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableExists, setTableExists] = useState(true);

  const { t, language } = useLanguage();

  useEffect(() => {
    void fetchLogs();
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
    return { label: action, color: "text-(--muted)" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
        <span className="ml-2 text-(--muted)">{t("adminAuditLoading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-(--danger) py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="w-5 h-5 text-(--accent)" />
        <h2 className="text-xl font-semibold text-(--text)">{t("adminAuditLog")}</h2>
        <span className="text-sm text-(--faint)">({logs.length})</span>
      </div>

      {!tableExists && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-(--warning)/10 border border-(--warning)/20 mb-4">
          <Info className="w-5 h-5 text-(--warning) shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-(--warning) font-medium">{t("adminAuditMigrationNeeded")}</p>
            <p className="text-xs text-(--muted) mt-1">{t("adminAuditMigrationHint")}</p>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-12 text-(--muted)">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("adminAuditNoLogs")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const { label, color } = getActionLabel(log.action);
            return (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-(--raised) border border-(--line) hover:bg-(--raised) transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                  <span className="text-xs text-(--faint)">
                    {formatDate(log.created_at, language === "vi" ? "vi-VN" : "en-GB")}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-(--muted)">
                  <span>
                    {t("adminAuditBy")}:{" "}
                    <span className="text-(--text)">{log.admin_email || log.admin_id}</span>
                  </span>
                  {log.target_email && (
                    <span>
                      → <span className="text-(--text)">{log.target_email}</span>
                    </span>
                  )}
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 text-xs text-(--faint) font-mono bg-(--raised) rounded p-2">
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

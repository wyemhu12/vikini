"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ScrollText, AlertCircle, Info, RotateCcw } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { formatDate } from "@/lib/utils/dateFormat";
import { logger } from "@/lib/utils/logger";
import { Skeleton } from "@/components/ui/skeleton";

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

const ACTION_META: Record<string, { labelKey: string; color: string }> = {
  UPDATE_USER_RANK: { labelKey: "adminAuditActionUpdateUserRank", color: "text-(--accent)" },
  BLOCK_USER: { labelKey: "adminAuditActionBlockUser", color: "text-(--danger)" },
  UNBLOCK_USER: { labelKey: "adminAuditActionUnblockUser", color: "text-(--success)" },
  UPDATE_RANK_CONFIG: { labelKey: "adminAuditActionUpdateRankConfig", color: "text-(--accent)" },
  CREATE_GEM: { labelKey: "adminAuditActionCreateGem", color: "text-(--warning)" },
  UPDATE_GEM: { labelKey: "adminAuditActionUpdateGem", color: "text-(--warning)" },
  DELETE_GEM: { labelKey: "adminAuditActionDeleteGem", color: "text-(--danger)" },
  BULK_UPDATE_USERS: { labelKey: "adminAuditActionBulkUpdateUsers", color: "text-(--accent)" },
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableExists, setTableExists] = useState(true);

  const { t, language } = useLanguage();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/audit-log");
      if (!res.ok) throw new Error(tRef.current("adminAuditLoadFailed"));
      const json = await res.json();
      const data = json.data || json;
      setLogs(data.logs || []);
      setTableExists(data.tableExists !== false);
    } catch (err: unknown) {
      logger.error("[AuditLogViewer] Failed to fetch audit logs:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminAuditLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const getActionLabel = (action: string) => {
    const entry = ACTION_META[action];
    if (entry) return { label: t(entry.labelKey), color: entry.color };
    return { label: action, color: "text-(--muted)" };
  };

  if (loading) {
    return (
      <div role="status" className="space-y-3 py-2">
        <span className="sr-only">{t("adminAuditLoading")}</span>
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full rounded-lg" />
        ))}
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
          onClick={() => void fetchLogs()}
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
      <div className="flex items-center gap-2 mb-4">
        <ScrollText aria-hidden="true" className="w-5 h-5 text-(--accent)" />
        <h2 className="text-xl font-semibold text-(--text)">{t("adminAuditLog")}</h2>
        <span className="text-sm text-(--faint)">({logs.length})</span>
      </div>

      {!tableExists && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-(--warning)/10 border border-(--warning)/20 mb-4">
          <Info aria-hidden="true" className="w-5 h-5 text-(--warning) shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-(--warning) font-medium">{t("adminAuditMigrationNeeded")}</p>
            <p className="text-xs text-(--muted) mt-1">{t("adminAuditMigrationHint")}</p>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-12 text-(--muted)">
          <ScrollText aria-hidden="true" className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("adminAuditNoLogs")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const { label, color } = getActionLabel(log.action);
            return (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-(--raised) border border-(--line) hover:bg-(--raised-hover) transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                  <span className="text-xs text-(--faint)">
                    {formatDate(log.created_at, language === "vi" ? "vi-VN" : "en-GB")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--muted)">
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
                  <div className="mt-2 text-xs text-(--faint) font-mono bg-(--surface) border border-(--line) rounded p-2 overflow-x-auto">
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

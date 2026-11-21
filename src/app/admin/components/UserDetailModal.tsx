"use client";

import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { formatDate } from "@/lib/utils/dateFormat";

export interface Profile {
  id: string;
  email: string;
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  is_blocked: boolean;
  created_at: string;
}

interface UserDetailModalProps {
  user: Profile | null;
  stats: { conversations: number; messages: number } | null;
  loading: boolean;
  onClose: () => void;
}

const RANK_LABEL_KEYS: Record<Profile["rank"], string> = {
  not_whitelisted: "userNotWhitelisted",
  basic: "userBasic",
  pro: "userPro",
  admin: "userAdmin",
};

export default function UserDetailModal({ user, stats, loading, onClose }: UserDetailModalProps) {
  const { t, language } = useLanguage();

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="w-full max-w-md bg-(--surface) text-(--text) border-(--line)"
      >
        <DialogHeader>
          <DialogTitle>{t("adminUserDetail")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
            <div className="text-xs text-(--faint) mb-1">{t("userEmail")}</div>
            <div className="text-sm font-medium break-all">{user?.email}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
              <div className="text-xs text-(--faint) mb-1">{t("userRank")}</div>
              <div className="text-sm font-medium">
                {user ? t(RANK_LABEL_KEYS[user.rank]) : "-"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
              <div className="text-xs text-(--faint) mb-1">{t("userStatus")}</div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  user?.is_blocked
                    ? "bg-(--danger)/20 text-(--danger) border border-(--danger)/30"
                    : "bg-(--success)/20 text-(--success) border border-(--success)/30"
                }`}
              >
                {user?.is_blocked ? t("userBlocked") : t("userActive")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
              <div className="text-xs text-(--faint) mb-1">{t("adminUserConvs")}</div>
              <div className="text-sm font-medium">
                {loading ? (
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                ) : (
                  (stats?.conversations ?? "-")
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
              <div className="text-xs text-(--faint) mb-1">{t("adminUserMsgs")}</div>
              <div className="text-sm font-medium">
                {loading ? (
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                ) : (
                  (stats?.messages ?? "-")
                )}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-(--raised) border border-(--line)">
            <div className="text-xs text-(--faint) mb-1">{t("adminUserJoined")}</div>
            <div className="text-sm font-medium">
              {formatDate(user?.created_at ?? "", language === "vi" ? "vi-VN" : "en-GB")}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

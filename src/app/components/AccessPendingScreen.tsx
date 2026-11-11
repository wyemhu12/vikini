"use client";

import { Shield, Clock, Mail } from "lucide-react";
import { useLanguage } from "../features/chat/hooks/useLanguage";

export default function AccessPendingScreen() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center p-4">
      {/* Glass container */}
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-(--soft) blur-2xl rounded-full" />
            <div className="relative bg-(--soft) backdrop-blur-xl border border-(--accent)/30 rounded-full p-6">
              <Shield className="w-16 h-16 text-(--accent)" />
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-(--raised) backdrop-blur-xl border border-(--line) rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-(--text) text-center mb-3">{t("accessDenied")}</h1>
          <p className="text-lg text-(--accent) text-center mb-6">{t("accessPending")}</p>

          <div className="space-y-4 mb-8">
            {/* Status */}
            <div className="flex items-start gap-3 p-4 bg-(--warning)/10 border border-(--warning)/30 rounded-xl">
              <Clock className="w-5 h-5 text-(--warning) mt-0.5" />
              <div className="text-sm font-medium text-(--warning)">
                {t("accessAccountPending")}
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-4 bg-(--accent)/10 border border-(--accent)/30 rounded-xl">
              <Mail className="w-5 h-5 text-(--accent) mt-0.5" />
              <div className="text-sm font-medium text-(--accent)">{t("accessWhitelistOnly")}</div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center">
            <p className="text-sm text-(--text)">{t("accessWaitApproval")}</p>
          </div>

          {/* Sign out button */}
          <div className="mt-6 pt-6 border-t border-(--line)">
            <a
              href="/api/auth/signout"
              className="block w-full py-3 px-4 bg-(--raised) hover:bg-(--raised) border border-(--line) rounded-lg text-center text-sm text-(--text) hover:text-(--text) transition-colors"
            >
              {t("accessSignOut")}
            </a>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-(--faint) mt-6">{t("accessContactAdmin")}</p>
      </div>
    </div>
  );
}

"use client";

import { Loader2, ShieldAlert, CheckSquare, Square } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { formatDate } from "@/lib/utils/dateFormat";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Profile } from "./UserDetailModal";

export interface UserRankOption {
  readonly value: Profile["rank"];
  readonly labelKey: string;
}

export interface UserTableRowProps {
  user: Profile;
  isSelf: boolean;
  isSelected: boolean;
  isUpdating: boolean;
  checkboxButtonClass: string;
  rankOptions: readonly UserRankOption[];
  onToggleSelect: (id: string) => void;
  onOpenDetail: (user: Profile) => void;
  onRankChange: (id: string, rank: string) => void;
  onToggleBlock: (id: string, isBlocked: boolean) => void;
}

export default function UserTableRow({
  user,
  isSelf,
  isSelected,
  isUpdating,
  checkboxButtonClass,
  rankOptions,
  onToggleSelect,
  onOpenDetail,
  onRankChange,
  onToggleBlock,
}: UserTableRowProps) {
  const { t, language } = useLanguage();

  return (
    <tr
      className={`border-b border-(--line) hover:bg-(--raised-hover) ${isSelf ? "bg-(--soft)/30" : ""}`}
    >
      <td className="py-3 px-2">
        {!isSelf && (
          <button
            type="button"
            onClick={() => onToggleSelect(user.id)}
            aria-label={`${t("adminSelectUser")}: ${user.email}`}
            aria-pressed={isSelected}
            className={checkboxButtonClass}
          >
            {isSelected ? (
              <CheckSquare aria-hidden="true" className="w-4 h-4 text-(--accent)" />
            ) : (
              <Square aria-hidden="true" className="w-4 h-4" />
            )}
          </button>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-(--text)">
        <button
          type="button"
          onClick={() => onOpenDetail(user)}
          className="flex items-center gap-2 hover:text-(--accent) transition-colors text-left focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded cursor-pointer"
        >
          {user.email}
          {isSelf && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-(--soft) text-(--accent) border border-(--accent)/30">
              <ShieldAlert aria-hidden="true" className="w-3 h-3" />
              {t("adminSelfLabel")}
            </span>
          )}
        </button>
      </td>
      <td className="py-3 px-4">
        <Select
          value={user.rank}
          onValueChange={(v) => onRankChange(user.id, v)}
          disabled={isSelf || isUpdating}
        >
          <SelectTrigger
            className="w-[140px] h-auto py-1.5"
            aria-label={`${t("userRank")}: ${user.email}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rankOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-4">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            user.is_blocked
              ? "bg-(--danger)/10 text-(--danger) border border-(--danger)/30"
              : "bg-(--success)/10 text-(--success) border border-(--success)/30"
          }`}
        >
          {user.is_blocked ? t("userBlocked") : t("userActive")}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-(--muted)">
        {formatDate(user.created_at, language === "vi" ? "vi-VN" : "en-GB")}
      </td>
      <td className="py-3 px-4 text-right">
        <button
          type="button"
          onClick={() => onToggleBlock(user.id, !user.is_blocked)}
          disabled={isSelf || isUpdating}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none cursor-pointer ${
            user.is_blocked
              ? "bg-(--success)/10 text-(--success) hover:bg-(--success)/15 border border-(--success)/30"
              : "bg-(--danger)/10 text-(--danger) hover:bg-(--danger)/15 border border-(--danger)/30"
          }`}
        >
          {isUpdating ? (
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin inline" />
          ) : user.is_blocked ? (
            t("userUnblock")
          ) : (
            t("userBlock")
          )}
        </button>
      </td>
    </tr>
  );
}

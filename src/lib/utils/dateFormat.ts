// Consistent date formatting utilities
// Uses Intl.DateTimeFormat for consistent, locale-aware formatting

/**
 * Format a date as a short date string (DD/MM/YYYY or locale equivalent)
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  locale: string = "en-GB"
): string {
  if (!date) return "";

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date with time (DD/MM/YYYY HH:MM)
 */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  locale: string = "en-GB"
): string {
  if (!date) return "";

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Format a date as a short display string (e.g., "Jan 17, 2026")
 */
export function formatDateShort(
  date: Date | string | number | null | undefined,
  locale: string = "en-US"
): string {
  if (!date) return "";

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date relative to now (e.g., "2 hours ago", "yesterday")
 * Falls back to formatDateShort for dates older than a week
 */
export function formatRelativeDate(
  date: Date | string | number | null | undefined,
  locale: string = "en"
): string {
  if (!date) return "";

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return locale === "vi" ? "Vừa xong" : "Just now";
      return locale === "vi" ? `${diffMinutes} phút trước` : `${diffMinutes}m ago`;
    }
    return locale === "vi" ? `${diffHours} giờ trước` : `${diffHours}h ago`;
  }

  if (diffDays === 1) return locale === "vi" ? "Hôm qua" : "Yesterday";
  if (diffDays < 7) return locale === "vi" ? `${diffDays} ngày trước` : `${diffDays}d ago`;

  return formatDateShort(d, locale === "vi" ? "vi-VN" : "en-US");
}

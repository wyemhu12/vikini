// /lib/core/whitelist.ts
export function parseWhitelist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

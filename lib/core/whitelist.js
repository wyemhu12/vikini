export function parseWhitelist(raw) {
  if (!raw) return [];
  return raw
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// src/lib/features/chat/googleDocsUrl.ts
/**
 * Pure Google Workspace URL parser, validator, and export URL builder.
 * Supports public shared Google Docs, Google Sheets, and Google Slides links.
 */

export type GoogleWorkspaceDocKind = "document" | "spreadsheets" | "presentation";

export interface ParsedGoogleWorkspaceLink {
  kind: GoogleWorkspaceDocKind;
  docId: string;
  gid?: string;
  tab?: string;
  originalUrl: string;
  canonicalUrl: string;
}

export interface ExtractGoogleLinksResult {
  links: ParsedGoogleWorkspaceLink[];
  truncatedCount: number;
}

export const MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE = 3;

const RAW_URL_PATTERN = /https?:\/\/[^\s<>()[\]"']+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)\]"'>]+$/;
const GOOGLE_WORKSPACE_PATH_PATTERN =
  /^\/(document|spreadsheets|presentation)(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,128})(?:\/|$)/;
const GID_PATTERN = /^\d{1,20}$/;
const TAB_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const GOOGLEUSERCONTENT_SUBDOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.googleusercontent\.com$/;

const ALLOWED_EXACT_EXPORT_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
  "drive.usercontent.google.com",
]);

const AUTH_REDIRECT_HOSTS = new Set([
  "accounts.google.com",
  "accounts.youtube.com",
  "workspace.google.com",
]);

const AUTH_REDIRECT_PATH_PATTERN = /(?:^|\/)(?:ServiceLogin|v3\/signin|AccountChooser)(?:\/|$|\?)/i;

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function extractValidatedGid(parsed: URL): string | undefined {
  const fromQuery = parsed.searchParams.get("gid")?.trim();
  if (fromQuery && GID_PATTERN.test(fromQuery)) {
    return fromQuery;
  }

  if (parsed.hash && parsed.hash.length > 1) {
    const hashParams = new URLSearchParams(parsed.hash.slice(1));
    const fromHash = hashParams.get("gid")?.trim();
    if (fromHash && GID_PATTERN.test(fromHash)) {
      return fromHash;
    }
  }

  return undefined;
}

function extractValidatedTab(parsed: URL): string | undefined {
  const rawTab = parsed.searchParams.get("tab")?.trim();
  if (rawTab && TAB_PATTERN.test(rawTab)) {
    return rawTab;
  }
  return undefined;
}

function buildCanonicalUrl(
  kind: GoogleWorkspaceDocKind,
  docId: string,
  tab?: string,
  gid?: string
): string {
  const url = new URL(`https://docs.google.com/${kind}/d/${docId}/edit`);
  if (kind === "document" && tab) {
    url.searchParams.set("tab", tab);
  }
  if (kind === "spreadsheets" && gid) {
    url.hash = `gid=${gid}`;
  }
  return url.toString();
}

function parseSingleGoogleWorkspaceUrl(rawCandidate: string): ParsedGoogleWorkspaceLink | null {
  const cleaned = rawCandidate.trim().replace(TRAILING_PUNCTUATION_PATTERN, "");
  if (!cleaned) return null;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return null;
  }

  if (parsed.port !== "" && parsed.port !== "443" && parsed.port !== "80") {
    return null;
  }

  const host = normalizeHostname(parsed.hostname);
  if (host !== "docs.google.com") {
    return null;
  }

  if (parsed.pathname.includes("/d/e/")) {
    return null;
  }

  const match = GOOGLE_WORKSPACE_PATH_PATTERN.exec(parsed.pathname);
  if (!match) {
    return null;
  }

  const kind = match[1] as GoogleWorkspaceDocKind;
  const docId = match[2];
  if (!docId || docId === "e") {
    return null;
  }

  const gid = kind === "spreadsheets" ? extractValidatedGid(parsed) : undefined;
  const tab = kind === "document" ? extractValidatedTab(parsed) : undefined;
  const canonicalUrl = buildCanonicalUrl(kind, docId, tab, gid);

  return {
    kind,
    docId,
    ...(gid ? { gid } : {}),
    ...(tab ? { tab } : {}),
    originalUrl: cleaned,
    canonicalUrl,
  };
}

/**
 * Extract, normalize, deduplicate, and cap Google Docs/Sheets/Slides URLs from user text.
 */
export function extractGoogleWorkspaceLinks(text: string): ExtractGoogleLinksResult {
  if (!text || typeof text !== "string") {
    return { links: [], truncatedCount: 0 };
  }

  const matches = text.match(RAW_URL_PATTERN);
  if (!matches || matches.length === 0) {
    return { links: [], truncatedCount: 0 };
  }

  const seenKeys = new Set<string>();
  const uniqueLinks: ParsedGoogleWorkspaceLink[] = [];

  for (const raw of matches) {
    const parsed = parseSingleGoogleWorkspaceUrl(raw);
    if (!parsed) continue;

    const dedupeKey =
      parsed.kind === "document"
        ? `${parsed.kind}:${parsed.docId}:${parsed.tab ?? ""}`
        : `${parsed.kind}:${parsed.docId}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    uniqueLinks.push(parsed);
  }

  if (uniqueLinks.length > MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE) {
    return {
      links: uniqueLinks.slice(0, MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE),
      truncatedCount: uniqueLinks.length - MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE,
    };
  }

  return { links: uniqueLinks, truncatedCount: 0 };
}

/**
 * Build a validated Google Web Export URL using URLSearchParams (never raw interpolation).
 */
export function buildGoogleWorkspaceExportUrl(
  link: ParsedGoogleWorkspaceLink,
  format: "pdf" | "txt" | "xlsx" | "csv",
  options?: { includeTab?: boolean }
): string {
  const url = new URL(`https://docs.google.com/${link.kind}/d/${link.docId}/export`);
  url.searchParams.set("format", format);

  if (
    link.kind === "document" &&
    options?.includeTab !== false &&
    link.tab &&
    TAB_PATTERN.test(link.tab)
  ) {
    url.searchParams.set("tab", link.tab);
  }

  if (link.kind === "spreadsheets" && format === "csv" && link.gid && GID_PATTERN.test(link.gid)) {
    url.searchParams.set("gid", link.gid);
  }

  return url.toString();
}

/**
 * Detect Google authentication / sign-in redirect targets indicating private/restricted docs.
 */
export function isGoogleAuthRedirectHost(hostname: string, pathname?: string): boolean {
  const host = normalizeHostname(hostname);
  if (AUTH_REDIRECT_HOSTS.has(host)) {
    return true;
  }
  if (pathname && AUTH_REDIRECT_PATH_PATTERN.test(pathname)) {
    return true;
  }
  return false;
}

/**
 * Strict allowlist of Google hosts permitted to serve public Google Workspace export redirects.
 */
export function isAllowedGoogleExportHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  if (ALLOWED_EXACT_EXPORT_HOSTS.has(host)) {
    return true;
  }
  return GOOGLEUSERCONTENT_SUBDOMAIN_PATTERN.test(host);
}

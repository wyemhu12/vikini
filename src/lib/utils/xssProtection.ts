// /lib/utils/xssProtection.ts
// Utility functions for XSS protection - URL validation and sanitization

/**
 * Allowed protocols for regular URLs (links)
 */
const SAFE_URL_PROTOCOLS = ["http:", "https:"] as const;

/**
 * Strict allowlist for raster base64 data: image URLs.
 * Explicitly blocks data:text/html and data:image/svg+xml XSS payloads.
 */
const SAFE_DATA_IMAGE_REGEX =
  /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/i;

/**
 * Validates if a URL has a safe protocol for links
 *
 * @param url - URL to validate
 * @returns true if URL is safe, false otherwise
 *
 * @example
 * isValidUrl('https://example.com') // true
 * isValidUrl('javascript:alert(1)') // false
 */
export function isValidUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    return (SAFE_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates if a URL is safe for use as an image source.
 * Allows http/https URLs and strictly raster base64 data:image/* URLs.
 * Blocks javascript:, data:text/html, and data:image/svg+xml.
 */
export function isValidImageUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith("data:")) {
    return SAFE_DATA_IMAGE_REGEX.test(trimmed);
  }

  return isValidUrl(trimmed);
}

/**
 * Sanitizes a URL, returning a fallback if the URL is invalid
 */
export function sanitizeUrl(url: unknown, fallback: string = "#"): string {
  return isValidUrl(url) ? (url as string).trim() : fallback;
}

/**
 * Sanitizes an image URL, returning a fallback if the URL is invalid
 */
export function sanitizeImageUrl(url: unknown, fallback: string = ""): string {
  return isValidImageUrl(url) ? (url as string).trim() : fallback;
}

/**
 * Safely opens an external HTTP(S) URL in a new tab with noopener,noreferrer.
 * Returns false and does nothing if the URL fails validation.
 */
export function openSafeExternalUrl(url: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isValidUrl(url)) return false;
  window.open((url as string).trim(), "_blank", "noopener,noreferrer");
  return true;
}

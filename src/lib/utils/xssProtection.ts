// /lib/utils/xssProtection.ts
// Utility functions for XSS protection - URL validation and sanitization

/**
 * Allowed protocols for regular URLs (links)
 */
const SAFE_URL_PROTOCOLS = ["http:", "https:"] as const;

/**
 * Allowed protocols for image sources (includes data: for base64)
 */
const SAFE_IMAGE_PROTOCOLS = ["http:", "https:", "data:"] as const;

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
    const parsed = new URL(url);
    return (SAFE_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates if a URL is safe for use as an image source
 * Allows http, https, and data: (for base64 images)
 *
 * @param url - URL to validate
 * @returns true if URL is safe for images, false otherwise
 *
 * @example
 * isValidImageUrl('https://example.com/image.png') // true
 * isValidImageUrl('data:image/png;base64,...') // true
 * isValidImageUrl('javascript:alert(1)') // false
 */
export function isValidImageUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (SAFE_IMAGE_PROTOCOLS as readonly string[]).includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL, returning a fallback if the URL is invalid
 *
 * @param url - URL to sanitize
 * @param fallback - Fallback value if URL is invalid (default: "#")
 * @returns Sanitized URL or fallback
 *
 * @example
 * sanitizeUrl('https://example.com') // 'https://example.com'
 * sanitizeUrl('javascript:alert(1)') // '#'
 * sanitizeUrl('javascript:alert(1)', '/') // '/'
 */
export function sanitizeUrl(url: unknown, fallback: string = "#"): string {
  return isValidUrl(url) ? (url as string) : fallback;
}

/**
 * Sanitizes an image URL, returning a fallback if the URL is invalid
 *
 * @param url - URL to sanitize
 * @param fallback - Fallback value if URL is invalid (default: "")
 * @returns Sanitized URL or fallback
 *
 * @example
 * sanitizeImageUrl('https://example.com/img.png') // 'https://example.com/img.png'
 * sanitizeImageUrl('javascript:alert(1)') // ''
 */
export function sanitizeImageUrl(url: unknown, fallback: string = ""): string {
  return isValidImageUrl(url) ? (url as string) : fallback;
}

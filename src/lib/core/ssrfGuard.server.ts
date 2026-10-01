/**
 * SSRF Protection Guard (Server-Side Only)
 * Validates URLs and safely fetches remote images while preventing Server-Side Request Forgery.
 * Blocks private IP ranges, loopback, link-local, cloud metadata services, and non-image responses.
 */
import dns from "node:dns";
import net from "node:net";
import { URL } from "node:url";
import { ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const ssrfLogger = logger.withContext("ssrf-guard");

// Initialize IP BlockList with restricted network CIDRs
const blockList = new net.BlockList();

// 1. Loopback addresses
blockList.addSubnet("127.0.0.0", 8, "ipv4");
blockList.addSubnet("::1", 128, "ipv6");
blockList.addSubnet("::ffff:127.0.0.0", 104, "ipv6");

// 2. Private network ranges (RFC 1918)
blockList.addSubnet("10.0.0.0", 8, "ipv4");
blockList.addSubnet("172.16.0.0", 12, "ipv4");
blockList.addSubnet("192.168.0.0", 16, "ipv4");

// 3. Link-Local / Cloud Metadata (RFC 3927)
blockList.addSubnet("169.254.0.0", 16, "ipv4");
blockList.addSubnet("fe80::", 10, "ipv6");
blockList.addAddress("169.254.169.254", "ipv4");

// 4. Reserved / Special / Multicast
blockList.addSubnet("0.0.0.0", 8, "ipv4");
blockList.addSubnet("::", 128, "ipv6");
blockList.addSubnet("100.64.0.0", 10, "ipv4"); // Carrier-Grade NAT (RFC 6598)
blockList.addSubnet("192.0.0.0", 24, "ipv4"); // IETF Protocol Assignments
blockList.addSubnet("198.18.0.0", 15, "ipv4"); // Benchmark testing
blockList.addSubnet("224.0.0.0", 4, "ipv4"); // Multicast (IPv4)
blockList.addSubnet("240.0.0.0", 4, "ipv4"); // Reserved for Future Use
blockList.addSubnet("fc00::", 7, "ipv6"); // Unique Local Address (ULA)
blockList.addSubnet("64:ff9b::", 96, "ipv6"); // IPv4/IPv6 translation
blockList.addSubnet("::", 96, "ipv6"); // IPv4-compatible IPv6 (deprecated)
blockList.addSubnet("2002::", 16, "ipv6"); // 6to4 prefix
blockList.addSubnet("ff00::", 8, "ipv6"); // Multicast (IPv6)

/**
 * Check if an IP address belongs to restricted/private/loopback ranges.
 */
export function isIpRestricted(ip: string): boolean {
  const ipFamily = net.isIP(ip);
  if (ipFamily === 0) {
    return true; // Malformed IP
  }

  const family: "ipv4" | "ipv6" = ipFamily === 6 ? "ipv6" : "ipv4";
  if (blockList.check(ip, family)) {
    return true;
  }

  // Check IPv4-mapped IPv6 address (e.g. ::ffff:10.0.0.1 or ::ffff:127.0.0.1)
  if (ipFamily === 6 && /::ffff:/i.test(ip)) {
    const parts = ip.split("::ffff:");
    const mappedIpv4 = parts[parts.length - 1];
    if (net.isIP(mappedIpv4) === 4) {
      return blockList.check(mappedIpv4, "ipv4");
    }
  }

  return false;
}

/**
 * Validates that a URL uses http/https and does not resolve to restricted/private IP addresses.
 */
export async function validateSafeUrl(urlString: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new ValidationError("Invalid URL format");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ValidationError("Only HTTP and HTTPS protocols are allowed");
  }

  // Normalize hostname: lowercase, remove trailing dots
  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname) {
    throw new ValidationError("Invalid hostname");
  }

  // Direct IP address check
  if (net.isIP(hostname)) {
    if (isIpRestricted(hostname)) {
      ssrfLogger.warn(`Blocked direct access to restricted IP: ${hostname}`);
      throw new ValidationError("Access to private or restricted network addresses is forbidden");
    }
    return parsedUrl;
  }

  // Block localhost and standard loopback hostnames before DNS lookup
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    ssrfLogger.warn(`Blocked internal hostname: ${hostname}`);
    throw new ValidationError("Access to private or restricted network addresses is forbidden");
  }

  // DNS Resolution check
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new ValidationError(`Could not resolve host: ${hostname}`);
    }

    for (const record of addresses) {
      if (isIpRestricted(record.address)) {
        ssrfLogger.warn(`Hostname ${hostname} resolved to restricted IP: ${record.address}`);
        throw new ValidationError("Access to private or restricted network addresses is forbidden");
      }
    }
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : "DNS resolution failed";
    ssrfLogger.warn(`DNS lookup failed for ${hostname}: ${msg}`);
    throw new ValidationError(`Could not resolve host: ${hostname}`);
  }

  return parsedUrl;
}

export interface SafeImageResult {
  buffer: Buffer;
  mimeType: string;
}

export interface FetchSafeImageOptions {
  maxBytes?: number;
  timeoutMs?: number;
}

/**
 * Safely fetches a remote image:
 * - Enforces DNS/IP SSRF validation on initial URL and on each redirect hop (max 3)
 * - Drains/cancels redirect response bodies
 * - Enforces max byte size (default 10MB) via Content-Length and chunked stream reading
 * - Shared timeout deadline (default 10s) across all hops
 * - Ensures response Content-Type is an image
 */
export async function fetchSafeImage(
  urlString: string,
  options?: FetchSafeImageOptions
): Promise<SafeImageResult> {
  const maxBytes = options?.maxBytes ?? 10 * 1024 * 1024; // 10 MB default
  const timeoutMs = options?.timeoutMs ?? 10000; // 10s default
  const maxRedirects = 3;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Request timeout"));
  }, timeoutMs);

  let currentUrl = urlString;
  let redirects = 0;

  try {
    while (true) {
      await validateSafeUrl(currentUrl);

      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (fetchError: unknown) {
        if (controller.signal.aborted) {
          throw new ValidationError("Request timeout");
        }
        const msg = fetchError instanceof Error ? fetchError.message : "Fetch failed";
        throw new ValidationError(`Failed to fetch image: ${msg}`);
      }

      // Handle Redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (response.body) {
          response.body.cancel().catch(() => {});
        }
        redirects++;
        if (redirects > maxRedirects) {
          throw new ValidationError("Too many redirects");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new ValidationError("Redirect response missing location header");
        }

        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        if (response.body) {
          response.body.cancel().catch(() => {});
        }
        throw new ValidationError(`Failed to fetch image: HTTP ${response.status}`);
      }

      // Verify Content-Type is an image
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/")) {
        if (response.body) {
          response.body.cancel().catch(() => {});
        }
        throw new ValidationError(
          `Invalid content type: expected image, got ${contentType || "none"}`
        );
      }

      // Verify Content-Length header if provided
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const parsedLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(parsedLength) && parsedLength > maxBytes) {
          if (response.body) {
            response.body.cancel().catch(() => {});
          }
          throw new ValidationError(`Image size exceeds limit of ${maxBytes} bytes`);
        }
      }

      // Read response body in chunks to enforce size limit dynamically
      if (!response.body) {
        throw new ValidationError("Empty response body");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (totalBytes > maxBytes) {
              await reader.cancel();
              throw new ValidationError(`Image size exceeds limit of ${maxBytes} bytes`);
            }
            chunks.push(value);
          }
        }
      } catch (streamErr: unknown) {
        if (controller.signal.aborted) {
          throw new ValidationError("Request timeout");
        }
        throw streamErr;
      }

      const buffer = Buffer.concat(chunks);
      return {
        buffer,
        mimeType: contentType.split(";")[0].trim().toLowerCase(),
      };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

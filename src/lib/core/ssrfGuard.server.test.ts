import { describe, it, expect, vi, beforeEach } from "vitest";
import dns from "node:dns";
import { isIpRestricted, validateSafeUrl, fetchSafeImage } from "./ssrfGuard.server";

function mockDnsLookup(addresses: { address: string; family: number }[]) {
  return vi
    .spyOn(dns.promises, "lookup")
    .mockResolvedValue(addresses as unknown as dns.LookupAddress);
}

function mockDnsLookupOnce(addresses: { address: string; family: number }[]) {
  return vi
    .spyOn(dns.promises, "lookup")
    .mockResolvedValueOnce(addresses as unknown as dns.LookupAddress);
}

describe("ssrfGuard.server", () => {
  describe("isIpRestricted", () => {
    it("identifies IPv4 and IPv6 loopback addresses as restricted", () => {
      expect(isIpRestricted("127.0.0.1")).toBe(true);
      expect(isIpRestricted("127.0.0.53")).toBe(true);
      expect(isIpRestricted("127.255.255.255")).toBe(true);
      expect(isIpRestricted("::1")).toBe(true);
      expect(isIpRestricted("::ffff:127.0.0.1")).toBe(true);
    });

    it("identifies RFC 1918 private addresses as restricted", () => {
      expect(isIpRestricted("10.0.0.1")).toBe(true);
      expect(isIpRestricted("10.255.255.255")).toBe(true);
      expect(isIpRestricted("172.16.0.1")).toBe(true);
      expect(isIpRestricted("172.31.255.255")).toBe(true);
      expect(isIpRestricted("192.168.0.1")).toBe(true);
      expect(isIpRestricted("192.168.255.255")).toBe(true);
      expect(isIpRestricted("::ffff:10.0.0.1")).toBe(true);
      expect(isIpRestricted("::ffff:192.168.1.1")).toBe(true);
    });

    it("identifies link-local and cloud metadata addresses as restricted", () => {
      expect(isIpRestricted("169.254.169.254")).toBe(true);
      expect(isIpRestricted("169.254.1.1")).toBe(true);
      expect(isIpRestricted("fe80::1")).toBe(true);
    });

    it("identifies CGNAT and special reserved ranges as restricted", () => {
      expect(isIpRestricted("100.64.0.1")).toBe(true);
      expect(isIpRestricted("100.127.255.254")).toBe(true);
      expect(isIpRestricted("0.0.0.0")).toBe(true);
      expect(isIpRestricted("::")).toBe(true);
      expect(isIpRestricted("fc00::1")).toBe(true);
      expect(isIpRestricted("fd12:3456:789a::1")).toBe(true);
    });

    it("allows legitimate public IP addresses", () => {
      expect(isIpRestricted("8.8.8.8")).toBe(false);
      expect(isIpRestricted("1.1.1.1")).toBe(false);
      expect(isIpRestricted("93.184.216.34")).toBe(false);
      expect(isIpRestricted("2606:4700:4700::1111")).toBe(false);
    });

    it("treats invalid IP strings as restricted", () => {
      expect(isIpRestricted("invalid-ip")).toBe(true);
      expect(isIpRestricted("999.999.999.999")).toBe(true);
    });
  });

  describe("validateSafeUrl", () => {
    it("rejects non-HTTP(S) protocols", async () => {
      await expect(validateSafeUrl("file:///etc/passwd")).rejects.toThrow(
        "Only HTTP and HTTPS protocols are allowed"
      );
      await expect(validateSafeUrl("ftp://ftp.example.com/test.png")).rejects.toThrow(
        "Only HTTP and HTTPS protocols are allowed"
      );
      await expect(validateSafeUrl("gopher://example.com/1")).rejects.toThrow(
        "Only HTTP and HTTPS protocols are allowed"
      );
      await expect(validateSafeUrl("javascript:alert(1)")).rejects.toThrow(
        "Only HTTP and HTTPS protocols are allowed"
      );
    });

    it("rejects malformed URLs", async () => {
      await expect(validateSafeUrl("not-a-valid-url")).rejects.toThrow("Invalid URL format");
    });

    it("rejects URLs with direct private or loopback IP hostnames", async () => {
      await expect(validateSafeUrl("http://127.0.0.1/secret")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
      await expect(validateSafeUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
      await expect(validateSafeUrl("https://10.0.0.5/admin")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
      await expect(validateSafeUrl("http://[::1]/status")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
    });

    it("rejects internal and localhost hostnames", async () => {
      await expect(validateSafeUrl("http://localhost/admin")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
      await expect(validateSafeUrl("http://app.internal/dashboard")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
      await expect(validateSafeUrl("http://service.local/image.png")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
    });

    it("rejects domains that resolve to restricted IPs", async () => {
      const lookupSpy = mockDnsLookupOnce([{ address: "10.0.0.5", family: 4 }]);

      await expect(validateSafeUrl("https://evil-internal.com/test.png")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );

      lookupSpy.mockRestore();
    });

    it("passes for valid public domains resolving to public IPs", async () => {
      const lookupSpy = mockDnsLookupOnce([{ address: "93.184.216.34", family: 4 }]);

      const result = await validateSafeUrl("https://example.com/assets/logo.png");
      expect(result.hostname).toBe("example.com");

      lookupSpy.mockRestore();
    });
  });

  describe("fetchSafeImage", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("fetches safe image successfully and returns buffer with mimeType", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(imageBytes);
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": imageBytes.length.toString(),
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await fetchSafeImage("https://example.com/image.png");
      expect(result.mimeType).toBe("image/png");
      expect(Buffer.compare(result.buffer, Buffer.from(imageBytes))).toBe(0);
    });

    it("rejects non-image content-type", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const mockResponse = new Response("<html><body>Secret</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      await expect(fetchSafeImage("https://example.com/page.html")).rejects.toThrow(
        "Invalid content type: expected image"
      );
    });

    it("rejects when Content-Length header exceeds maxBytes", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const mockResponse = new Response(new Uint8Array(10), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "20000000", // 20 MB
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      await expect(
        fetchSafeImage("https://example.com/huge.jpg", { maxBytes: 10 * 1024 * 1024 })
      ).rejects.toThrow("Image size exceeds limit");
    });

    it("rejects when stream reading exceeds maxBytes dynamically", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const chunk = new Uint8Array(500);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: {
          "content-type": "image/webp",
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      await expect(
        fetchSafeImage("https://example.com/stream.webp", { maxBytes: 800 })
      ).rejects.toThrow("Image size exceeds limit");
    });

    it("follows redirects up to limit and validates redirect target", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const redirectResponse = new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.com/final.png" },
      });

      const finalResponse = new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(redirectResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await fetchSafeImage("https://example.com/shortlink");
      expect(result.mimeType).toBe("image/png");
      expect(result.buffer.length).toBe(3);
    });

    it("rejects when redirect loop exceeds 3 hops", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const r1 = new Response(null, {
        status: 302,
        headers: { location: "https://example.com/2" },
      });
      const r2 = new Response(null, {
        status: 302,
        headers: { location: "https://example.com/3" },
      });
      const r3 = new Response(null, {
        status: 302,
        headers: { location: "https://example.com/4" },
      });
      const r4 = new Response(null, {
        status: 302,
        headers: { location: "https://example.com/5" },
      });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(r1)
        .mockResolvedValueOnce(r2)
        .mockResolvedValueOnce(r3)
        .mockResolvedValueOnce(r4);

      await expect(fetchSafeImage("https://example.com/1")).rejects.toThrow("Too many redirects");
    });

    it("rejects when redirect attempts to bounce to internal IP", async () => {
      mockDnsLookup([{ address: "93.184.216.34", family: 4 }]);

      const redirectResponse = new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(redirectResponse);

      await expect(fetchSafeImage("https://example.com/bounce")).rejects.toThrow(
        "Access to private or restricted network addresses is forbidden"
      );
    });
  });
});

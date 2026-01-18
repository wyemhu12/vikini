// Test file for xssProtection.ts
import { describe, it, expect } from "vitest";
import { isValidUrl, isValidImageUrl, sanitizeUrl, sanitizeImageUrl } from "./xssProtection";

describe("XSS Protection", () => {
  describe("isValidUrl", () => {
    it("should return true for valid HTTPS URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
      expect(isValidUrl("https://sub.domain.example.com")).toBe(true);
    });

    it("should return true for valid HTTP URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("http://localhost:3000")).toBe(true);
    });

    it("should return false for javascript: protocol (XSS attack)", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
      expect(isValidUrl("javascript:alert('XSS')")).toBe(false);
      expect(isValidUrl("JAVASCRIPT:alert(1)")).toBe(false);
    });

    it("should return false for data: protocol", () => {
      expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    it("should return false for vbscript: protocol", () => {
      expect(isValidUrl("vbscript:msgbox('XSS')")).toBe(false);
    });

    it("should return false for file: protocol", () => {
      expect(isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("should return false for empty or invalid inputs", () => {
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl("   ")).toBe(false);
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
      expect(isValidUrl(123)).toBe(false);
      expect(isValidUrl({})).toBe(false);
    });

    it("should return false for malformed URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("//example.com")).toBe(false);
    });
  });

  describe("isValidImageUrl", () => {
    it("should return true for valid HTTPS image URLs", () => {
      expect(isValidImageUrl("https://example.com/image.png")).toBe(true);
      expect(isValidImageUrl("https://cdn.example.com/photo.jpg")).toBe(true);
    });

    it("should return true for valid HTTP image URLs", () => {
      expect(isValidImageUrl("http://example.com/image.gif")).toBe(true);
    });

    it("should return true for data: URLs (base64 images)", () => {
      expect(isValidImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
      expect(isValidImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=")).toBe(true);
    });

    it("should return false for javascript: protocol (XSS attack)", () => {
      expect(isValidImageUrl("javascript:alert(1)")).toBe(false);
      expect(isValidImageUrl("JAVASCRIPT:alert('XSS')")).toBe(false);
    });

    it("should return false for vbscript: protocol", () => {
      expect(isValidImageUrl("vbscript:msgbox('XSS')")).toBe(false);
    });

    it("should return false for empty or invalid inputs", () => {
      expect(isValidImageUrl("")).toBe(false);
      expect(isValidImageUrl("   ")).toBe(false);
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
    });
  });

  describe("sanitizeUrl", () => {
    it("should return the URL for valid URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(sanitizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
    });

    it("should return # for javascript: protocol", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
    });

    it("should return # for invalid URLs", () => {
      expect(sanitizeUrl("")).toBe("#");
      expect(sanitizeUrl(null)).toBe("#");
      expect(sanitizeUrl("not-a-url")).toBe("#");
    });

    it("should return custom fallback when provided", () => {
      expect(sanitizeUrl("javascript:alert(1)", "/")).toBe("/");
      expect(sanitizeUrl("", "about:blank")).toBe("about:blank");
    });
  });

  describe("sanitizeImageUrl", () => {
    it("should return the URL for valid image URLs", () => {
      expect(sanitizeImageUrl("https://example.com/img.png")).toBe("https://example.com/img.png");
      expect(sanitizeImageUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    });

    it("should return empty string for javascript: protocol", () => {
      expect(sanitizeImageUrl("javascript:alert(1)")).toBe("");
    });

    it("should return empty string for invalid URLs", () => {
      expect(sanitizeImageUrl("")).toBe("");
      expect(sanitizeImageUrl(null)).toBe("");
    });

    it("should return custom fallback when provided", () => {
      expect(sanitizeImageUrl("javascript:alert(1)", "/placeholder.png")).toBe("/placeholder.png");
    });
  });
});

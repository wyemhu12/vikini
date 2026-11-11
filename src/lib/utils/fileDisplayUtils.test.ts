import { describe, expect, it } from "vitest";
import { KIND_COLORS, KIND_ICONS, formatFileSize, truncateFilename } from "./fileDisplayUtils";

describe("fileDisplayUtils (Phase 6D TC-04)", () => {
  it("formats byte, KB, and MB sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("truncates long filenames while preserving extensions", () => {
    expect(truncateFilename("short.pdf", 15)).toBe("short.pdf");
    expect(truncateFilename("report-final-version-2026.pdf", 15)).toMatch(/….*\.pdf$/);
    expect(truncateFilename("README_VERY_LONG_WITHOUT_EXT", 10)).toHaveLength(10);
  });

  it("maps every FileKind to an icon and semantic Vikini 3.0 token color without raw palette classes", () => {
    const kinds = ["image", "video", "audio", "document", "text", "archive", "other"] as const;
    for (const kind of kinds) {
      expect(KIND_ICONS[kind]).toBeDefined();
      expect(KIND_COLORS[kind]).toMatch(/^text-\(--[a-z-]+\)$/);
      expect(KIND_COLORS[kind]).not.toContain("--text-secondary");
    }
  });
});

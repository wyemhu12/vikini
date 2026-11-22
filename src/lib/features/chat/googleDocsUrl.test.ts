import { describe, it, expect } from "vitest";
import {
  extractGoogleWorkspaceLinks,
  buildGoogleWorkspaceExportUrl,
  isAllowedGoogleExportHost,
  isGoogleAuthRedirectHost,
  MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE,
} from "./googleDocsUrl";

describe("googleDocsUrl", () => {
  it("TC-GD-01: extracts, normalizes, deduplicates Docs/Sheets/Slides with /u/0/, tab, gid, and trailing punctuation", () => {
    const message = [
      "Xem đề án này (https://docs.google.com/document/u/0/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/edit?usp=sharing&tab=t.0).",
      "Bản trùng: [link](https://docs.google.com/document/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/view?tab=t.0)!",
      "Bảng tính: https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit#gid=42,",
      "Slide: https://docs.google.com/presentation/d/1SlideIdAbCdEfGhIjKlMnOpQrSt/present;",
    ].join("\n");

    const result = extractGoogleWorkspaceLinks(message);

    expect(result.truncatedCount).toBe(0);
    expect(result.links).toHaveLength(3);

    const [doc, sheet, slide] = result.links;
    expect(doc).toEqual({
      kind: "document",
      docId: "1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ",
      tab: "t.0",
      originalUrl:
        "https://docs.google.com/document/u/0/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/edit?usp=sharing&tab=t.0",
      canonicalUrl:
        "https://docs.google.com/document/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/edit?tab=t.0",
    });

    expect(sheet).toEqual({
      kind: "spreadsheets",
      docId: "1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      gid: "42",
      originalUrl:
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit#gid=42",
      canonicalUrl:
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit#gid=42",
    });

    expect(slide).toEqual({
      kind: "presentation",
      docId: "1SlideIdAbCdEfGhIjKlMnOpQrSt",
      originalUrl: "https://docs.google.com/presentation/d/1SlideIdAbCdEfGhIjKlMnOpQrSt/present",
      canonicalUrl: "https://docs.google.com/presentation/d/1SlideIdAbCdEfGhIjKlMnOpQrSt/edit",
    });

    expect(buildGoogleWorkspaceExportUrl(doc, "pdf")).toBe(
      "https://docs.google.com/document/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/export?format=pdf&tab=t.0"
    );
    expect(buildGoogleWorkspaceExportUrl(doc, "pdf", { includeTab: false })).toBe(
      "https://docs.google.com/document/d/1H4x8n9PVtr7qWalgMpNlu68ryFgTPOAsxM79bdeizEQ/export?format=pdf"
    );
    expect(buildGoogleWorkspaceExportUrl(sheet, "xlsx")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/export?format=xlsx"
    );
    expect(buildGoogleWorkspaceExportUrl(sheet, "csv")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/export?format=csv&gid=42"
    );
    expect(buildGoogleWorkspaceExportUrl(slide, "pdf")).toBe(
      "https://docs.google.com/presentation/d/1SlideIdAbCdEfGhIjKlMnOpQrSt/export?format=pdf"
    );
    expect(buildGoogleWorkspaceExportUrl(slide, "txt")).toBe(
      "https://docs.google.com/presentation/d/1SlideIdAbCdEfGhIjKlMnOpQrSt/export?format=txt"
    );
  });

  it("TC-GD-02: caps unique links to MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE (3) and reports truncatedCount", () => {
    const urls = [1, 2, 3, 4, 5].map(
      (i) => `https://docs.google.com/document/d/1DocumentIdNumber0000${i}/edit`
    );
    const result = extractGoogleWorkspaceLinks(urls.join(" "));

    expect(MAX_GOOGLE_DOCS_LINKS_PER_MESSAGE).toBe(3);
    expect(result.links).toHaveLength(3);
    expect(result.links.map((l) => l.docId)).toEqual([
      "1DocumentIdNumber00001",
      "1DocumentIdNumber00002",
      "1DocumentIdNumber00003",
    ]);
    expect(result.truncatedCount).toBe(2);
  });

  it("TC-GD-03 (NP): rejects spoofed hostnames, embedded query URLs, published /d/e/2PACX, javascript:, and invalid gid/tab params", () => {
    const malicious = [
      "https://docs.google.com.evil.com/document/d/1234567890abcdef/edit",
      "https://evil.com/?next=https://docs.google.com/document/d/1234567890abcdef/edit",
      "https://docs.google.com/document/d/e/2PACX-1vRealLongPublishedId12345/pub",
      "https://user:pass@docs.google.com/document/d/1234567890abcdef/edit",
      "https://docs.google.com:8443/document/d/1234567890abcdef/edit",
      "javascript:alert(1)",
    ].join("\n");

    expect(extractGoogleWorkspaceLinks(malicious)).toEqual({ links: [], truncatedCount: 0 });

    // Host allowlist negative probes
    expect(isAllowedGoogleExportHost("docs.google.com")).toBe(true);
    expect(isAllowedGoogleExportHost("drive.google.com")).toBe(true);
    expect(isAllowedGoogleExportHost("drive.usercontent.google.com")).toBe(true);
    expect(isAllowedGoogleExportHost("doc-0k-2g-docs.googleusercontent.com")).toBe(true);

    expect(isAllowedGoogleExportHost("evil.com")).toBe(false);
    expect(isAllowedGoogleExportHost("googleusercontent.com")).toBe(false);
    expect(isAllowedGoogleExportHost("googleusercontent.com.evil.com")).toBe(false);
    expect(isAllowedGoogleExportHost("evilgoogleusercontent.com")).toBe(false);
    expect(isAllowedGoogleExportHost("127.0.0.1")).toBe(false);
    expect(isAllowedGoogleExportHost("accounts.google.com")).toBe(false);

    // Auth redirect detection
    expect(isGoogleAuthRedirectHost("accounts.google.com")).toBe(true);
    expect(isGoogleAuthRedirectHost("docs.google.com", "/ServiceLogin")).toBe(true);
    expect(isGoogleAuthRedirectHost("docs.google.com", "/document/d/1234567890/export")).toBe(
      false
    );

    // Invalid gid & tab stripped safely (never interpolated raw)
    const dirtyParams = [
      "https://docs.google.com/document/d/1ValidDocId1234567890/edit?tab=../evil&foo=bar",
      "https://docs.google.com/spreadsheets/d/1ValidSheetId12345678/edit?gid=abc&x=1",
    ].join(" ");
    const parsed = extractGoogleWorkspaceLinks(dirtyParams);
    expect(parsed.links).toHaveLength(2);
    expect(parsed.links[0].tab).toBeUndefined();
    expect(parsed.links[1].gid).toBeUndefined();

    expect(buildGoogleWorkspaceExportUrl(parsed.links[0], "pdf")).toBe(
      "https://docs.google.com/document/d/1ValidDocId1234567890/export?format=pdf"
    );
    expect(buildGoogleWorkspaceExportUrl(parsed.links[1], "csv")).toBe(
      "https://docs.google.com/spreadsheets/d/1ValidSheetId12345678/export?format=csv"
    );
  });
});

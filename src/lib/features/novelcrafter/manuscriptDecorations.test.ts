// /lib/features/novelcrafter/manuscriptDecorations.test.ts
import { describe, expect, it } from "vitest";
import {
  buildFeedbackDecorations,
  buildRenderLines,
  isSafeDecorationId,
  type ManuscriptDecoration,
} from "./manuscriptDecorations";
import { tokenizeManuscriptLines } from "./manuscriptMarkup";
import type { NovelcrafterFeedbackItem } from "./types";

describe("manuscriptDecorations (TC-DECOR)", () => {
  it("DC-1: decorates open feedback quote with feedbackId and nc-feedback class", () => {
    const content = "Dưới ánh trăng mờ ảo, người lữ khách dừng chân.";
    const items: NovelcrafterFeedbackItem[] = [
      {
        id: "fb_1",
        category: "pacing",
        quote: "ánh trăng",
        comment: "Good imagery",
        suggestion: "",
        status: "open",
        createdAt: 1,
      },
    ];
    const decorations = buildFeedbackDecorations(content, items, "fb_1");
    const renderLines = buildRenderLines(content, tokenizeManuscriptLines(content), decorations);

    const fbSeg = renderLines[0].segments.find((s) => s.feedbackId === "fb_1");
    expect(fbSeg).toBeDefined();
    expect(fbSeg?.text).toBe("ánh trăng");
    expect(fbSeg?.classes).toContain("nc-feedback");
    expect(fbSeg?.classes).toContain("nc-feedback-active");
  });

  it("DC-2: ignores resolved feedback items or empty quotes", () => {
    const content = "Dưới ánh trăng mờ ảo.";
    const items: NovelcrafterFeedbackItem[] = [
      {
        id: "fb_resolved",
        category: "pacing",
        quote: "ánh trăng",
        comment: "Resolved",
        suggestion: "",
        status: "resolved",
        createdAt: 1,
      },
      {
        id: "fb_empty",
        category: "pacing",
        quote: "",
        comment: "Empty quote",
        suggestion: "",
        status: "open",
        createdAt: 1,
      },
    ];
    expect(buildFeedbackDecorations(content, items, null)).toEqual([]);
  });

  it("DC-3 (Negative): rejects unsafe feedback IDs (XSS payload, spaces, >100 chars) while preserving full text", () => {
    const unsafeIds = ['x" onclick="alert(1)', "a b", "x".repeat(101), ""];
    for (const badId of unsafeIds) {
      expect(isSafeDecorationId(badId)).toBe(false);
    }

    const content = "Ánh trăng chiếu qua song cửa.";
    const items: NovelcrafterFeedbackItem[] = unsafeIds.map((id) => ({
      id,
      category: "pacing",
      quote: "Ánh trăng",
      comment: "Test",
      suggestion: "",
      status: "open",
      createdAt: 1,
    }));

    const decorations = buildFeedbackDecorations(content, items, null);
    expect(decorations).toEqual([]);

    const manualDecorations: ManuscriptDecoration[] = [
      {
        kind: "feedback",
        id: 'x" onclick="alert(1)',
        start: 0,
        end: 9,
        active: true,
      },
    ];
    const renderLines = buildRenderLines(
      content,
      tokenizeManuscriptLines(content),
      manualDecorations
    );
    expect(renderLines[0].segments.every((s) => s.feedbackId === undefined)).toBe(true);
    expect(renderLines[0].segments.map((s) => s.text).join("")).toBe(content);
  });

  it("DC-4: splits overlapping feedback and codex decorations into atomic non-nested segments preserving text", () => {
    const content = "Tiểu Minh rút thanh kiếm cổ.";
    const decorations: ManuscriptDecoration[] = [
      { kind: "codex", entityId: "char_1", entityKind: "character", start: 0, end: 9 },
      { kind: "feedback", id: "fb_overlap", start: 5, end: 19, active: false },
    ];
    const renderLines = buildRenderLines(content, tokenizeManuscriptLines(content), decorations);

    const segs = renderLines[0].segments;
    const overlapSeg = segs.find((s) => s.start === 5 && s.end === 9);
    expect(overlapSeg).toBeDefined();
    expect(overlapSeg?.text).toBe("Minh");
    expect(overlapSeg?.codexId).toBe("char_1");
    expect(overlapSeg?.feedbackId).toBe("fb_overlap");
    expect(segs.map((s) => s.text).join("")).toBe(content);
  });

  it("DC-5: applies nc-selection class to persisted selection range [3, 7]", () => {
    const content = "0123456789";
    const decorations: ManuscriptDecoration[] = [{ kind: "selection", start: 3, end: 7 }];
    const renderLines = buildRenderLines(content, tokenizeManuscriptLines(content), decorations);

    const selSeg = renderLines[0].segments.find((s) => s.start === 3 && s.end === 7);
    expect(selSeg?.text).toBe("3456");
    expect(selSeg?.classes).toContain("nc-selection");
  });

  it("DC-6: produces deterministic line signatures and isolates signature changes to modified lines", () => {
    const contentA = "Dòng một\nDòng hai\nDòng ba";
    const contentB = "Dòng một\nDòng hai sửa\nDòng ba";

    const linesA1 = buildRenderLines(contentA, tokenizeManuscriptLines(contentA), []);
    const linesA2 = buildRenderLines(contentA, tokenizeManuscriptLines(contentA), []);
    const linesB = buildRenderLines(contentB, tokenizeManuscriptLines(contentB), []);

    expect(linesA1.map((l) => l.signature)).toEqual(linesA2.map((l) => l.signature));
    expect(linesB[0].signature).toBe(linesA1[0].signature);
    expect(linesB[1].signature).not.toBe(linesA1[1].signature);
    expect(linesB[2].signature).toBe(linesA1[2].signature);
  });
});

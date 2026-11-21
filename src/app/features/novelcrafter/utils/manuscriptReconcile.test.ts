import { describe, it, expect } from "vitest";
import { buildRenderLines } from "@/lib/features/novelcrafter/manuscriptDecorations";
import { tokenizeManuscriptLines } from "@/lib/features/novelcrafter/manuscriptMarkup";
import {
  buildManuscriptDecorations,
  normalizeInsertedText,
  reconcileDomLines,
  resolveBeforeInputAction,
  resolveEditorShortcutAction,
} from "./manuscriptReconcile";

describe("manuscriptReconcile (CT-6C-03)", () => {
  it("normalizeInsertedText normalizes CRLF and CR line endings to LF", () => {
    expect(normalizeInsertedText("line1\r\nline2\rline3")).toBe("line1\nline2\nline3");
  });

  it("resolveBeforeInputAction maps input types accurately", () => {
    expect(resolveBeforeInputAction("insertParagraph")).toEqual({ kind: "insertText", text: "\n" });
    expect(resolveBeforeInputAction("insertLineBreak")).toEqual({ kind: "insertText", text: "\n" });
    expect(resolveBeforeInputAction("insertFromPaste", "pasted")).toEqual({
      kind: "insertText",
      text: "pasted",
    });
    expect(resolveBeforeInputAction("insertFromPaste", "")).toEqual({ kind: "noop" });
    expect(resolveBeforeInputAction("historyUndo")).toEqual({ kind: "undo" });
    expect(resolveBeforeInputAction("historyRedo")).toEqual({ kind: "redo" });
    expect(resolveBeforeInputAction("formatBold")).toEqual({ kind: "format", format: "bold" });
    expect(resolveBeforeInputAction("formatItalic")).toEqual({ kind: "format", format: "italic" });
    expect(resolveBeforeInputAction("formatStrikeThrough")).toEqual({
      kind: "format",
      format: "strike",
    });
    expect(resolveBeforeInputAction("insertText")).toEqual({ kind: "noop" });
  });

  it("resolveEditorShortcutAction resolves modifier shortcuts and ignores unmodified keys", () => {
    expect(
      resolveEditorShortcutAction({ key: "b", ctrlKey: false, metaKey: false, shiftKey: false })
    ).toBeNull();
    expect(
      resolveEditorShortcutAction({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe("undo");
    expect(
      resolveEditorShortcutAction({ key: "Z", ctrlKey: false, metaKey: true, shiftKey: true })
    ).toBe("redo");
    expect(
      resolveEditorShortcutAction({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe("redo");
    expect(
      resolveEditorShortcutAction({ key: "b", ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe("bold");
    expect(
      resolveEditorShortcutAction({ key: "i", ctrlKey: false, metaKey: true, shiftKey: false })
    ).toBe("italic");
    expect(
      resolveEditorShortcutAction({ key: "k", ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe("quickEdit");
  });

  it("buildManuscriptDecorations merges codex mentions and unfocused selection range", () => {
    const decorations = buildManuscriptDecorations({
      content: "Aria walked into the forest.",
      feedbackItems: [],
      activeFeedbackId: null,
      codexRanges: [{ entityId: "char-1", entityKind: "character", start: 0, end: 4 }],
      isFocused: false,
      selection: { start: 5, end: 11 },
    });

    expect(decorations).toContainEqual({
      kind: "codex",
      entityId: "char-1",
      entityKind: "character",
      start: 0,
      end: 4,
    });
    expect(decorations).toContainEqual({ kind: "selection", start: 5, end: 11 });

    // Focused editor does not add synthetic selection decoration
    const focusedDecorations = buildManuscriptDecorations({
      content: "Aria walked into the forest.",
      feedbackItems: [],
      activeFeedbackId: null,
      codexRanges: [],
      isFocused: true,
      selection: { start: 5, end: 11 },
    });
    expect(focusedDecorations).toEqual([]);
  });

  it("reconcileDomLines creates, reuses matching lines, replaces changed lines, and removes trailing lines", () => {
    const root = document.createElement("div");
    const firstLines = buildRenderLines(
      "Line one\nLine two\nLine three",
      tokenizeManuscriptLines("Line one\nLine two\nLine three"),
      []
    );
    reconcileDomLines(root, firstLines, null);
    expect(root.children.length).toBe(3);

    const preservedFirstNode = root.children[0];
    const updatedLines = buildRenderLines(
      "Line one\nLine two edited",
      tokenizeManuscriptLines("Line one\nLine two edited"),
      []
    );
    reconcileDomLines(root, updatedLines, null);

    expect(root.children.length).toBe(2);
    expect(root.children[0]).toBe(preservedFirstNode);
    expect(root.children[1]?.textContent).toBe("Line two edited");
  });
});

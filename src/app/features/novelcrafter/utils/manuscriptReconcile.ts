// /app/features/novelcrafter/utils/manuscriptReconcile.ts
// Pure & DOM helpers extracted from useManuscriptEditor for line reconciliation, decorations, and input/shortcut resolution

import type { CodexMentionRange } from "@/lib/features/novelcrafter/codexMatcher";
import {
  buildFeedbackDecorations,
  type ManuscriptDecoration,
  type RenderLine,
} from "@/lib/features/novelcrafter/manuscriptDecorations";
import type { ManuscriptFormat } from "@/lib/features/novelcrafter/manuscriptMarkup";
import type { NovelcrafterFeedbackItem } from "@/lib/features/novelcrafter/types";
import {
  buildLineElement,
  deriveDomLineSignature,
  setSelectionOffsets,
  type ManuscriptSelectionRange,
} from "./manuscriptDomOffsets";

export type ManuscriptBeforeInputAction =
  | { kind: "insertText"; text: string }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "format"; format: ManuscriptFormat }
  | { kind: "noop" };

export type ManuscriptShortcutAction = "undo" | "redo" | "bold" | "italic" | "quickEdit" | null;

export function reconcileDomLines(
  root: HTMLElement,
  renderLines: readonly RenderLine[],
  caret: ManuscriptSelectionRange | null
): void {
  const doc = root.ownerDocument ?? document;
  for (let i = 0; i < renderLines.length; i += 1) {
    const line = renderLines[i];
    const existing = root.children[i] as HTMLElement | undefined;
    if (
      existing &&
      (existing.dataset.sig === line.signature ||
        deriveDomLineSignature(existing) === line.signature)
    ) {
      existing.dataset.sig = line.signature;
      existing.dataset.line = String(i);
      existing.dataset.block = line.block;
      continue;
    }
    const nextEl = buildLineElement(doc, line);
    if (existing) {
      root.replaceChild(nextEl, existing);
    } else {
      root.appendChild(nextEl);
    }
  }

  while (root.children.length > renderLines.length) {
    const last = root.lastElementChild;
    if (!last) break;
    root.removeChild(last);
  }

  if (caret && doc.activeElement === root) {
    setSelectionOffsets(root, caret.start, caret.end);
  }
}

export function buildManuscriptDecorations(params: {
  content: string;
  feedbackItems: readonly NovelcrafterFeedbackItem[];
  activeFeedbackId: string | null;
  codexRanges: readonly CodexMentionRange[];
  isFocused: boolean;
  selection: { start: number; end: number } | null;
}): ManuscriptDecoration[] {
  const { content, feedbackItems, activeFeedbackId, codexRanges, isFocused, selection } = params;
  const list = buildFeedbackDecorations(content, feedbackItems, activeFeedbackId);
  for (const c of codexRanges) {
    list.push({
      kind: "codex",
      entityId: c.entityId,
      entityKind: c.entityKind,
      start: c.start,
      end: c.end,
    });
  }
  if (!isFocused && selection && selection.end > selection.start) {
    list.push({ kind: "selection", start: selection.start, end: selection.end });
  }
  return list;
}

export function normalizeInsertedText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function resolveBeforeInputAction(
  inputType: string,
  plainPasteText = ""
): ManuscriptBeforeInputAction {
  if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
    return { kind: "insertText", text: "\n" };
  }
  if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
    return plainPasteText ? { kind: "insertText", text: plainPasteText } : { kind: "noop" };
  }
  if (inputType === "historyUndo") return { kind: "undo" };
  if (inputType === "historyRedo") return { kind: "redo" };
  if (inputType === "formatBold") return { kind: "format", format: "bold" };
  if (inputType === "formatItalic") return { kind: "format", format: "italic" };
  if (inputType === "formatStrikeThrough") return { kind: "format", format: "strike" };
  return { kind: "noop" };
}

export function resolveEditorShortcutAction(params: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): ManuscriptShortcutAction {
  const mod = params.ctrlKey || params.metaKey;
  if (!mod) return null;
  const key = params.key.toLowerCase();
  if (key === "z" && !params.shiftKey) return "undo";
  if ((key === "z" && params.shiftKey) || key === "y") return "redo";
  if (key === "b") return "bold";
  if (key === "i") return "italic";
  if (key === "k") return "quickEdit";
  return null;
}

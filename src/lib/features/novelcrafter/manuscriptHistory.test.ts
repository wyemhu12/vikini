// /lib/features/novelcrafter/manuscriptHistory.test.ts
import { describe, expect, it } from "vitest";
import {
  createEmptyManuscriptHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./manuscriptHistory";

describe("manuscriptHistory (TC-HISTORY)", () => {
  it("HS-1: pushes distinct entries (>800ms apart), undoes C->B->A, and redoes A->B", () => {
    let state = createEmptyManuscriptHistory();
    const entryA = { content: "A", selectionStart: 1, selectionEnd: 1, at: 1000 };
    const entryB = { content: "AB", selectionStart: 2, selectionEnd: 2, at: 2000 };
    const entryC = { content: "ABC", selectionStart: 3, selectionEnd: 3, at: 3000 };

    state = pushHistory(state, entryA);
    state = pushHistory(state, entryB);
    state = pushHistory(state, entryC);

    const u1 = undoHistory(state, entryC);
    expect(u1.entry?.content).toBe("AB");

    const u2 = undoHistory(u1.state, u1.entry!);
    expect(u2.entry?.content).toBe("A");

    const r1 = redoHistory(u2.state, u2.entry!);
    expect(r1.entry?.content).toBe("AB");
  });

  it("HS-2: coalesces 5 rapid single-character keystrokes (100ms apart, delta len 1) into 1 entry", () => {
    let state = createEmptyManuscriptHistory();
    const chars = ["h", "he", "hel", "hell", "hello"];
    for (let i = 0; i < chars.length; i += 1) {
      state = pushHistory(state, {
        content: chars[i],
        selectionStart: chars[i].length,
        selectionEnd: chars[i].length,
        at: 1000 + i * 100,
      });
    }

    expect(state.past).toHaveLength(1);
    expect(state.past[0].content).toBe("hello");
  });

  it("HS-3 (Negative/Cap): caps history past stack at 200 entries and drops oldest entries", () => {
    let state = createEmptyManuscriptHistory();
    for (let i = 0; i < 250; i += 1) {
      state = pushHistory(state, {
        content: `Entry-${i}`,
        selectionStart: 0,
        selectionEnd: 0,
        at: i * 1000,
      });
    }

    expect(state.past).toHaveLength(200);
    expect(state.past[0].content).toBe("Entry-50");
    expect(state.past[199].content).toBe("Entry-249");
  });

  it("HS-4: returns entry: null and unchanged state when undoing an empty past stack", () => {
    const empty = createEmptyManuscriptHistory();
    const current = { content: "now", selectionStart: 0, selectionEnd: 0, at: 100 };
    const res = undoHistory(empty, current);
    expect(res.entry).toBeNull();
    expect(res.state).toEqual(empty);
  });

  it("HS-5: clears future redo stack when a new entry is pushed after undo", () => {
    let state = createEmptyManuscriptHistory();
    const entryA = { content: "A", selectionStart: 1, selectionEnd: 1, at: 1000 };
    const entryB = { content: "AB", selectionStart: 2, selectionEnd: 2, at: 2500 };
    state = pushHistory(state, entryA);
    state = pushHistory(state, entryB);

    const undone = undoHistory(state, entryB);
    expect(undone.state.future.length).toBeGreaterThan(0);

    const afterPush = pushHistory(undone.state, {
      content: "AX",
      selectionStart: 2,
      selectionEnd: 2,
      at: 4000,
    });
    expect(afterPush.future).toEqual([]);
  });
});

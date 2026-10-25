// /lib/features/novelcrafter/manuscriptHistory.ts
// Pure bounded Undo/Redo stack with keystroke coalescing for the Rich Manuscript Editor

export interface ManuscriptHistoryEntry {
  content: string;
  selectionStart: number;
  selectionEnd: number;
  at: number;
}

export interface ManuscriptHistoryState {
  past: ManuscriptHistoryEntry[];
  future: ManuscriptHistoryEntry[];
}

export const DEFAULT_HISTORY_COALESCE_MS = 800;
export const DEFAULT_HISTORY_CAP = 200;

export function createEmptyManuscriptHistory(): ManuscriptHistoryState {
  return { past: [], future: [] };
}

export function createInitialHistory(content = ""): ManuscriptHistoryState {
  return {
    past: [
      {
        content,
        selectionStart: 0,
        selectionEnd: 0,
        at: 0,
      },
    ],
    future: [],
  };
}

export function pushHistory(
  state: ManuscriptHistoryState,
  entry: ManuscriptHistoryEntry,
  opts?: { coalesceMs?: number; cap?: number }
): ManuscriptHistoryState {
  const coalesceMs = opts?.coalesceMs ?? DEFAULT_HISTORY_COALESCE_MS;
  const cap = Math.max(1, opts?.cap ?? DEFAULT_HISTORY_CAP);
  const last = state.past[state.past.length - 1];

  if (last && last.content === entry.content) {
    return state;
  }

  const timeDelta = last ? entry.at - last.at : Infinity;
  const lenDelta = last ? Math.abs(entry.content.length - last.content.length) : Infinity;
  const shouldCoalesce = Boolean(last && timeDelta >= 0 && timeDelta < coalesceMs && lenDelta <= 2);

  const nextPast = shouldCoalesce ? [...state.past.slice(0, -1), entry] : [...state.past, entry];

  const boundedPast = nextPast.length > cap ? nextPast.slice(nextPast.length - cap) : nextPast;
  return {
    past: boundedPast,
    future: [],
  };
}

export function undoHistory(
  state: ManuscriptHistoryState,
  current: ManuscriptHistoryEntry
): { state: ManuscriptHistoryState; entry: ManuscriptHistoryEntry | null } {
  if (state.past.length === 0) {
    return { state, entry: null };
  }

  let targetIdx = state.past.length - 1;
  if (state.past[targetIdx].content === current.content && targetIdx > 0) {
    targetIdx -= 1;
  } else if (state.past[targetIdx].content === current.content && targetIdx === 0) {
    return { state: { past: [], future: state.future }, entry: null };
  }

  const target = state.past[targetIdx];
  const nextPast = state.past.slice(0, targetIdx);
  const nextFuture = [current, ...state.future].slice(0, DEFAULT_HISTORY_CAP);

  return {
    state: { past: nextPast, future: nextFuture },
    entry: target,
  };
}

export function redoHistory(
  state: ManuscriptHistoryState,
  current: ManuscriptHistoryEntry
): { state: ManuscriptHistoryState; entry: ManuscriptHistoryEntry | null } {
  if (state.future.length === 0) {
    return { state, entry: null };
  }

  const [nextEntry, ...restFuture] = state.future;
  const nextPast = [...state.past, current].slice(-DEFAULT_HISTORY_CAP);

  return {
    state: { past: nextPast, future: restFuture },
    entry: nextEntry,
  };
}

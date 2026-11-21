/**
 * Text Chunking Utilities
 * Splits documents into overlapping chunks suitable for embedding with O(N) line indexing.
 */

export interface ChunkOptions {
  /** Maximum characters per chunk (default: 800) */
  maxChunkSize?: number;
  /** Overlap between chunks (default: 100) */
  overlap?: number;
  /** Minimum chunk size to keep (default: 50) */
  minChunkSize?: number;
}

export interface TextChunk {
  content: string;
  index: number;
  metadata: {
    start_char: number;
    end_char: number;
    line_start?: number;
    line_end?: number;
  };
}

interface TextSegment {
  text: string;
  startChar: number;
  endChar: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 800,
  overlap: 100,
  minChunkSize: 50,
};

/** Build sorted 0-indexed character offsets for the start of each line in O(N). */
function buildLineStartOffsets(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** Map a 0-indexed character offset to its 1-indexed line number in O(log L). */
function offsetToLine(lineStarts: number[], charPos: number): number {
  const clamped = Math.max(0, charPos);
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid] <= clamped) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1;
}

function createChunkFromOffsets(
  content: string,
  index: number,
  startChar: number,
  endChar: number,
  lineStarts: number[]
): TextChunk {
  const trimmed = content.trim();
  const safeStart = Math.max(0, startChar);
  const safeEnd = Math.max(safeStart, endChar);
  return {
    content: trimmed,
    index,
    metadata: {
      start_char: safeStart,
      end_char: safeEnd,
      line_start: offsetToLine(lineStarts, safeStart),
      line_end: offsetToLine(lineStarts, Math.max(safeStart, safeEnd - 1)),
    },
  };
}

/** Hard-split an oversized segment into pieces of length <= maxChunkSize with bounded overlap. */
function splitOversizedSegment(
  segment: TextSegment,
  maxChunkSize: number,
  effectiveOverlap: number
): TextSegment[] {
  const pieces: TextSegment[] = [];
  const step = Math.max(1, maxChunkSize - effectiveOverlap);
  let pos = 0;

  while (pos < segment.text.length) {
    const end = Math.min(segment.text.length, pos + maxChunkSize);
    const slice = segment.text.slice(pos, end);
    const leadTrim = slice.length - slice.trimStart().length;
    const trimmed = slice.trim();
    if (trimmed.length > 0) {
      const pieceStart = segment.startChar + pos + leadTrim;
      pieces.push({
        text: trimmed,
        startChar: pieceStart,
        endChar: pieceStart + trimmed.length,
      });
    }
    if (end >= segment.text.length) break;
    pos += step;
  }

  return pieces;
}

/** Extract paragraphs along with exact start/end offsets (accurately handles \n\n\n+). */
function scanParagraphSegments(normalizedText: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const paragraphRegex = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;

  for (const match of normalizedText.matchAll(paragraphRegex)) {
    const raw = match[0];
    const matchIndex = match.index ?? 0;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const leadTrim = raw.length - raw.trimStart().length;
    const startChar = matchIndex + leadTrim;
    segments.push({
      text: trimmed,
      startChar,
      endChar: startChar + trimmed.length,
    });
  }

  return segments;
}

function finalizeTrailingChunk(
  chunks: TextChunk[],
  currentChunk: string,
  freshTail: string,
  chunkStartChar: number,
  chunkEndChar: number,
  lineStarts: number[],
  maxChunkSize: number,
  minChunkSize: number,
  effectiveOverlap: number,
  separator: string
): void {
  const trimmedCurrent = currentChunk.trim();
  const trimmedFresh = freshTail.trim();
  if (!trimmedCurrent || !trimmedFresh) return;

  // Preserve tail chunk even if shorter than minChunkSize: merge if it fits cleanly, else emit
  if (chunks.length > 0 && trimmedCurrent.length < minChunkSize) {
    const last = chunks[chunks.length - 1];
    if (
      last.content.length + trimmedFresh.length + separator.length <=
      maxChunkSize + effectiveOverlap
    ) {
      last.content = `${last.content}${separator}${trimmedFresh}`;
      last.metadata.end_char = Math.max(last.metadata.end_char, chunkEndChar);
      last.metadata.line_end = offsetToLine(
        lineStarts,
        Math.max(last.metadata.start_char, last.metadata.end_char - 1)
      );
      return;
    }
  }

  chunks.push(
    createChunkFromOffsets(trimmedCurrent, chunks.length, chunkStartChar, chunkEndChar, lineStarts)
  );
}

/**
 * Split text into overlapping chunks.
 * Preserves exact line offsets across multi-newline gaps, hard-splits oversized paragraphs,
 * and guarantees zero trailing data loss.
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!text || text.trim().length === 0) {
    return [];
  }

  const maxChunkSize = Math.max(1, opts.maxChunkSize);
  const effectiveOverlap = Math.min(Math.max(0, opts.overlap), Math.max(0, maxChunkSize - 1));
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lineStarts = buildLineStartOffsets(normalizedText);
  const rawParagraphs = scanParagraphSegments(normalizedText);

  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let freshTail = "";
  let chunkStartChar = 0;
  let chunkEndChar = 0;

  for (const para of rawParagraphs) {
    if (para.text.length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(
          createChunkFromOffsets(
            currentChunk,
            chunks.length,
            chunkStartChar,
            chunkEndChar,
            lineStarts
          )
        );
        currentChunk = "";
        freshTail = "";
      }

      const pieces = splitOversizedSegment(para, maxChunkSize, effectiveOverlap);
      for (const piece of pieces) {
        chunks.push(
          createChunkFromOffsets(
            piece.text,
            chunks.length,
            piece.startChar,
            piece.endChar,
            lineStarts
          )
        );
      }
      continue;
    }

    const sepLen = currentChunk.length > 0 ? 2 : 0;
    if (currentChunk.length > 0 && currentChunk.length + sepLen + para.text.length > maxChunkSize) {
      chunks.push(
        createChunkFromOffsets(
          currentChunk,
          chunks.length,
          chunkStartChar,
          chunkEndChar,
          lineStarts
        )
      );

      const maxOverlapAllowed = Math.max(0, maxChunkSize - para.text.length - 2);
      const overlapLen = Math.min(effectiveOverlap, maxOverlapAllowed, currentChunk.length);
      if (overlapLen > 0) {
        const overlapSlice = currentChunk.slice(currentChunk.length - overlapLen);
        currentChunk = `${overlapSlice}\n\n${para.text}`;
        chunkStartChar = Math.max(0, chunkEndChar - overlapLen);
      } else {
        currentChunk = para.text;
        chunkStartChar = para.startChar;
      }
      freshTail = para.text;
      chunkEndChar = para.endChar;
    } else {
      if (currentChunk.length === 0) {
        chunkStartChar = para.startChar;
        currentChunk = para.text;
        freshTail = para.text;
      } else {
        currentChunk += `\n\n${para.text}`;
        freshTail = freshTail ? `${freshTail}\n\n${para.text}` : para.text;
      }
      chunkEndChar = para.endChar;
    }
  }

  finalizeTrailingChunk(
    chunks,
    currentChunk,
    freshTail,
    chunkStartChar,
    chunkEndChar,
    lineStarts,
    maxChunkSize,
    opts.minChunkSize,
    effectiveOverlap,
    "\n\n"
  );

  return chunks;
}

function isCodeBreakPoint(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    /^(export\s+)?(function|class|interface|type|const|let|var|async\s+function)\s/.test(trimmed) ||
    /^(def|class|async\s+def)\s/.test(trimmed) ||
    /^(func|type|struct)\s/.test(trimmed)
  );
}

/**
 * Split code into logical chunks (functions, classes, blocks).
 * Enforces maxChunkSize even when no logical breakpoint exists and preserves all trailing lines.
 */
export function chunkCode(code: string, options?: ChunkOptions): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!code || code.trim().length === 0) {
    return [];
  }

  const maxChunkSize = Math.max(1, opts.maxChunkSize);
  const effectiveOverlap = Math.min(Math.max(0, opts.overlap), Math.max(0, maxChunkSize - 1));
  const normalizedCode = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lineStarts = buildLineStartOffsets(normalizedCode);
  const lines = normalizedCode.split("\n");
  const overlapLines = Math.min(3, Math.floor(effectiveOverlap / 50));

  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let freshTail = "";
  let chunkStartChar = 0;
  let chunkEndChar = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStartChar = lineStarts[i];
    const lineEndChar = lineStartChar + line.length;

    // Single line longer than maxChunkSize: flush current and hard-split the line
    if (line.length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(
          createChunkFromOffsets(
            currentChunk,
            chunks.length,
            chunkStartChar,
            chunkEndChar,
            lineStarts
          )
        );
        currentChunk = "";
        freshTail = "";
      }
      const pieces = splitOversizedSegment(
        { text: line, startChar: lineStartChar, endChar: lineEndChar },
        maxChunkSize,
        effectiveOverlap
      );
      for (const piece of pieces) {
        chunks.push(
          createChunkFromOffsets(
            piece.text,
            chunks.length,
            piece.startChar,
            piece.endChar,
            lineStarts
          )
        );
      }
      continue;
    }

    const sepLen = currentChunk.length > 0 ? 1 : 0;
    const wouldExceed = currentChunk.length + sepLen + line.length > maxChunkSize;
    const shouldSplit =
      currentChunk.length > 0 &&
      wouldExceed &&
      (isCodeBreakPoint(line) || currentChunk.length >= opts.minChunkSize || wouldExceed);

    if (shouldSplit) {
      chunks.push(
        createChunkFromOffsets(
          currentChunk,
          chunks.length,
          chunkStartChar,
          chunkEndChar,
          lineStarts
        )
      );

      const startFrom = Math.max(0, i - overlapLines);
      const candidateWithOverlap = lines.slice(startFrom, i + 1).join("\n");
      if (overlapLines > 0 && candidateWithOverlap.length <= maxChunkSize) {
        currentChunk = candidateWithOverlap;
        chunkStartChar = lineStarts[startFrom];
      } else {
        currentChunk = line;
        chunkStartChar = lineStartChar;
      }
      freshTail = line;
      chunkEndChar = lineEndChar;
    } else {
      if (currentChunk.length === 0) {
        chunkStartChar = lineStartChar;
        currentChunk = line;
        freshTail = line;
      } else {
        currentChunk += `\n${line}`;
        freshTail = freshTail ? `${freshTail}\n${line}` : line;
      }
      chunkEndChar = lineEndChar;
    }
  }

  finalizeTrailingChunk(
    chunks,
    currentChunk,
    freshTail,
    chunkStartChar,
    chunkEndChar,
    lineStarts,
    maxChunkSize,
    opts.minChunkSize,
    effectiveOverlap,
    "\n"
  );

  return chunks;
}

/**
 * Determine chunking strategy based on file type.
 */
export function getChunkingStrategy(filename: string): "text" | "code" {
  const codeExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".css",
    ".scss",
    ".html",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
  ];

  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === filename.length - 1) return "text";
  const ext = filename.toLowerCase().slice(dotIdx);
  return codeExtensions.includes(ext) ? "code" : "text";
}

/**
 * Smart chunk function that picks strategy based on content type.
 */
export function chunkContent(
  content: string,
  filename: string,
  options?: ChunkOptions
): TextChunk[] {
  const strategy = getChunkingStrategy(filename);
  return strategy === "code" ? chunkCode(content, options) : chunkText(content, options);
}

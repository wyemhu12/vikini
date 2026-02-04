/**
 * Text Chunking Utilities
 * Splits documents into chunks suitable for embedding
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

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 800,
  overlap: 100,
  minChunkSize: 50,
};

/**
 * Split text into overlapping chunks
 * Attempts to split at sentence/paragraph boundaries when possible
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by paragraphs first
  const paragraphs = normalizedText.split(/\n\n+/);
  let currentChunk = "";
  let currentStartChar = 0;
  let chunkStartChar = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    // If adding this paragraph exceeds max size, finalize current chunk
    if (
      currentChunk.length + trimmedParagraph.length + 2 > opts.maxChunkSize &&
      currentChunk.length >= opts.minChunkSize
    ) {
      chunks.push(createChunk(currentChunk, chunks.length, chunkStartChar, normalizedText));

      // Start new chunk with overlap from previous
      const overlapStart = Math.max(0, currentChunk.length - opts.overlap);
      currentChunk = currentChunk.slice(overlapStart) + "\n\n" + trimmedParagraph;
      chunkStartChar = currentStartChar - (currentChunk.length - trimmedParagraph.length - 2);
    } else {
      // Add paragraph to current chunk
      if (currentChunk.length > 0) {
        currentChunk += "\n\n";
      } else {
        chunkStartChar = currentStartChar;
      }
      currentChunk += trimmedParagraph;
    }

    currentStartChar += paragraph.length + 2; // +2 for \n\n separator
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length >= opts.minChunkSize) {
    chunks.push(createChunk(currentChunk, chunks.length, chunkStartChar, normalizedText));
  }

  // If we have too few chunks (document is small), just return the whole thing
  if (chunks.length === 0 && normalizedText.trim().length > 0) {
    chunks.push(createChunk(normalizedText.trim(), 0, 0, normalizedText));
  }

  return chunks;
}

/**
 * Split code into logical chunks (functions, classes, blocks)
 */
export function chunkCode(code: string, options?: ChunkOptions): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  if (!code || code.trim().length === 0) {
    return [];
  }

  // Normalize line endings
  const normalizedCode = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedCode.split("\n");

  let currentChunk = "";
  let chunkStartLine = 0;
  let chunkStartChar = 0;
  let currentCharPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a logical break point (function/class definition, empty line after block)
    const isBreakPoint =
      line.trim() === "" ||
      /^(export\s+)?(function|class|interface|type|const|let|var|async\s+function)\s/.test(
        line.trim()
      ) ||
      /^(def|class|async\s+def)\s/.test(line.trim()) || // Python
      /^(func|type|struct)\s/.test(line.trim()); // Go

    // If adding this line exceeds max and we're at a break point
    if (
      currentChunk.length + line.length + 1 > opts.maxChunkSize &&
      currentChunk.length >= opts.minChunkSize &&
      isBreakPoint
    ) {
      chunks.push(
        createCodeChunk(currentChunk, chunks.length, chunkStartChar, chunkStartLine, i - 1)
      );

      // Start new chunk with small overlap
      const overlapLines = Math.min(3, Math.floor(opts.overlap / 50));
      const startFrom = Math.max(0, i - overlapLines);
      currentChunk = lines.slice(startFrom, i + 1).join("\n");
      chunkStartLine = startFrom;
      chunkStartChar = currentCharPos - (currentChunk.length - line.length - 1);
    } else {
      if (currentChunk.length > 0) {
        currentChunk += "\n";
      } else {
        chunkStartLine = i;
        chunkStartChar = currentCharPos;
      }
      currentChunk += line;
    }

    currentCharPos += line.length + 1;
  }

  // Last chunk
  if (currentChunk.trim().length >= opts.minChunkSize) {
    chunks.push(
      createCodeChunk(currentChunk, chunks.length, chunkStartChar, chunkStartLine, lines.length - 1)
    );
  }

  // Handle small files
  if (chunks.length === 0 && normalizedCode.trim().length > 0) {
    chunks.push(createCodeChunk(normalizedCode.trim(), 0, 0, 0, lines.length - 1));
  }

  return chunks;
}

function createChunk(
  content: string,
  index: number,
  startChar: number,
  fullText: string
): TextChunk {
  const endChar = startChar + content.length;
  const lineStart = fullText.slice(0, startChar).split("\n").length;
  const lineEnd = lineStart + content.split("\n").length - 1;

  return {
    content: content.trim(),
    index,
    metadata: {
      start_char: startChar,
      end_char: endChar,
      line_start: lineStart,
      line_end: lineEnd,
    },
  };
}

function createCodeChunk(
  content: string,
  index: number,
  startChar: number,
  lineStart: number,
  lineEnd: number
): TextChunk {
  return {
    content: content.trim(),
    index,
    metadata: {
      start_char: startChar,
      end_char: startChar + content.length,
      line_start: lineStart + 1, // 1-indexed for display
      line_end: lineEnd + 1,
    },
  };
}

/**
 * Determine chunking strategy based on file type
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

  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return codeExtensions.includes(ext) ? "code" : "text";
}

/**
 * Smart chunk function that picks strategy based on content type
 */
export function chunkContent(
  content: string,
  filename: string,
  options?: ChunkOptions
): TextChunk[] {
  const strategy = getChunkingStrategy(filename);
  return strategy === "code" ? chunkCode(content, options) : chunkText(content, options);
}

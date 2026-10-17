// /lib/features/novelcrafter/openingsParser.ts
// Parses AI-generated 3 Chapter Openings into distinct History Cards (UX-03)

export interface ParsedOpeningOption {
  label: string;
  content: string;
}

const OPENING_DELIMITERS =
  /(?:^|\n)[ \t]*(?:===+[ \t]*(?:\*\*)?OPENING[ \t]*(\d+)(?:\*\*)?[ \t]*(?:[:\-–—][ \t]*([^=\n]+?))?(?:\*\*)?[ \t]*===+|#{2,3}[ \t]*(?:\*\*)?(?:Opening|Mở đầu|Phương án)[ \t]*(\d+)(?:\*\*)?[ \t]*(?:[:\-–—][ \t]*([^\n]+?))?(?:\*\*)?)[ \t]*\n/gi;

export function parseThreeOpenings(rawOutput: string): ParsedOpeningOption[] {
  const trimmed = rawOutput.trim();
  if (!trimmed) return [];

  const matches = Array.from(trimmed.matchAll(OPENING_DELIMITERS));
  if (matches.length < 2) {
    return [{ label: "Opening 1", content: trimmed }];
  }

  const results: ParsedOpeningOption[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx =
      i + 1 < matches.length ? (matches[i + 1].index ?? trimmed.length) : trimmed.length;
    const num = match[1] || match[3] || String(i + 1);
    const subtitle = (match[2] || match[4] || "").replace(/^\*\*|\*\*$/g, "").trim();
    const content = trimmed.slice(startIdx, endIdx).trim();
    if (content) {
      results.push({
        label: subtitle ? `Opening ${num}: ${subtitle}` : `Opening ${num}`,
        content,
      });
    }
  }

  return results.length > 0 ? results.slice(0, 3) : [{ label: "Opening 1", content: trimmed }];
}

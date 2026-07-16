// Markdown configuration and utility functions for ChatBubble
// Extracted from ChatBubble.tsx for modularity

// ============================================
// Thinking Extraction
// ============================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\<>]/g, "\\$&");
}

export function extractThinking(text: string) {
  const patterns = [
    { start: "<think>", end: "</think>" },
    { start: "<thought>", end: "</thought>" },
  ];

  const thoughts: string[] = [];
  let rest = text;
  let isThinking = false;

  for (const { start, end } of patterns) {
    // Handle all complete blocks first
    const completeRegex = new RegExp(
      `${start.replace(/</g, "&lt;").replace(/>/g, "&gt;")}([\\s\\S]*?)${end.replace(/</g, "&lt;").replace(/>/g, "&gt;")}|${start}([\\s\\S]*?)${end}`,
      "gi"
    );

    let match;
    while ((match = completeRegex.exec(rest)) !== null) {
      const thought = match[1] || match[2] || "";
      if (thought.trim()) thoughts.push(thought.trim());
    }

    // Remove all complete blocks
    rest = rest.replace(new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`, "gi"), "");

    // Handle incomplete block (no closing tag - streaming)
    const startIndex = rest.indexOf(start);
    if (startIndex !== -1) {
      const incompleteThought = rest.slice(startIndex + start.length);
      if (incompleteThought.trim()) thoughts.push(incompleteThought.trim());
      rest = rest.slice(0, startIndex);
      isThinking = true;
    }
  }

  return {
    thought: thoughts.length > 0 ? thoughts.join("\n\n") : null,
    rest: rest.trim(),
    isThinking,
  };
}

// ============================================
// Rehype Sanitize Schema Extension
// ============================================

export const EXTENDED_TAG_NAMES = ["mark", "u", "br", "b", "i", "sub", "sup"];

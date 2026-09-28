/**
 * Balances unclosed <think> reasoning tags by appending missing </think> tags to the end.
 * Useful when streaming responses are interrupted or aborted in the middle of a thought block.
 */
export function balanceThinkTags(content: string): string {
  if (!content) return content;

  const openCount = (content.match(/<think>/g) || []).length;
  const closeCount = (content.match(/<\/think>/g) || []).length;

  if (openCount > closeCount) {
    const missing = openCount - closeCount;
    return content + "</think>".repeat(missing);
  }

  return content;
}

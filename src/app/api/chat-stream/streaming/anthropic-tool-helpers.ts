/**
 * Anthropic Beta streaming tool lifecycle tracker and result parser.
 *
 * Isolates server_tool_use (code_execution, web_search, web_fetch) from client
 * tool_use (get_current_time) so server tool input_json_delta chunks never leak
 * into client tool buffers, emits throttled writing/running/done meta updates,
 * and parses BetaCodeExecutionToolResultBlock stdout/stderr/error payloads.
 */

export type AnthropicToolMetaEvent =
  | { type: "codeExecutionStatus"; status: "writing" | "running" | "done"; chars?: number }
  | { type: "webSearchStatus"; status: "searching" | "done" }
  | { type: "webFetchStatus"; status: "fetching" | "done" };

export interface AnthropicWebSource {
  uri: string;
  title: string;
}

export interface AnthropicBlockStartOutcome {
  metaEvents: AnthropicToolMetaEvent[];
  codeResultMarkdown: string | null;
  webSources: AnthropicWebSource[];
}

export interface AnthropicClientToolCall {
  id: string;
  name: string;
  inputJson: string;
}

export interface AnthropicBlockStopOutcome {
  metaEvent: AnthropicToolMetaEvent | null;
  clientToolCall: AnthropicClientToolCall | null;
}

export interface AnthropicToolTrackerOptions {
  throttleMs?: number;
  throttleChars?: number;
}

type ActiveToolBlock =
  | { kind: "client_tool"; id: string; name: string; inputJson: string }
  | {
      kind: "server_tool";
      name: string;
      inputChars: number;
      lastEmitAt: number;
      lastEmitChars: number;
    };

const DEFAULT_THROTTLE_MS = 500;
const DEFAULT_THROTTLE_CHARS = 256;

const CODE_EXECUTION_TOOL_NAMES = new Set([
  "code_execution",
  "bash_code_execution",
  "text_editor_code_execution",
]);

function isCodeExecutionToolName(name: string): boolean {
  return CODE_EXECUTION_TOOL_NAMES.has(name);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function formatCodeExecutionOutput(block: Record<string, unknown>): string | null {
  // Anthropic Beta SDK wraps execution output under block.content for
  // code_execution_tool_result / bash_code_execution_tool_result, while older/mock
  // payloads may place stdout/stderr directly on the block.
  const nested = asRecord(block.content);
  const payload = nested ?? block;
  const payloadType = typeof payload.type === "string" ? payload.type : "";

  if (payloadType.endsWith("_error")) {
    const errorCode =
      typeof payload.error_code === "string" && payload.error_code
        ? payload.error_code
        : "execution_error";
    return `\n**Error Output:**\n\`\`\`\n${errorCode}\n\`\`\`\n`;
  }

  const stdout = typeof payload.stdout === "string" ? payload.stdout : "";
  const stderr = typeof payload.stderr === "string" ? payload.stderr : "";
  const parts: string[] = [];

  if (stdout) {
    parts.push(`\n**Code Output:**\n\`\`\`\n${stdout}\n\`\`\`\n`);
  }
  if (stderr) {
    parts.push(`\n**Error Output:**\n\`\`\`\n${stderr}\n\`\`\`\n`);
  }

  return parts.length > 0 ? parts.join("") : null;
}

function extractWebSearchSources(block: Record<string, unknown>): AnthropicWebSource[] {
  if (!Array.isArray(block.content)) return [];
  const sources: AnthropicWebSource[] = [];
  for (const item of block.content) {
    const entry = asRecord(item);
    if (!entry) continue;
    if (entry.type === "web_search_result" && typeof entry.url === "string" && entry.url) {
      sources.push({
        uri: entry.url,
        title: typeof entry.title === "string" && entry.title ? entry.title : entry.url,
      });
    }
  }
  return sources;
}

export interface AnthropicToolTracker {
  handleBlockStart: (block: Record<string, unknown>, now?: number) => AnthropicBlockStartOutcome;
  handleInputJsonDelta: (partial: string, now?: number) => AnthropicToolMetaEvent | null;
  handleBlockStop: () => AnthropicBlockStopOutcome;
}

export function createAnthropicToolTracker(
  options: AnthropicToolTrackerOptions = {}
): AnthropicToolTracker {
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const throttleChars = options.throttleChars ?? DEFAULT_THROTTLE_CHARS;
  let activeBlock: ActiveToolBlock | null = null;

  function handleBlockStart(
    block: Record<string, unknown>,
    now = Date.now()
  ): AnthropicBlockStartOutcome {
    const blockType = typeof block.type === "string" ? block.type : "";
    const metaEvents: AnthropicToolMetaEvent[] = [];
    let codeResultMarkdown: string | null = null;
    let webSources: AnthropicWebSource[] = [];

    if (blockType === "tool_use") {
      activeBlock = {
        kind: "client_tool",
        id: typeof block.id === "string" ? block.id : "",
        name: typeof block.name === "string" ? block.name : "",
        inputJson: "",
      };
      return { metaEvents, codeResultMarkdown, webSources };
    }

    if (blockType === "server_tool_use") {
      const toolName = typeof block.name === "string" ? block.name : "";
      activeBlock = {
        kind: "server_tool",
        name: toolName,
        inputChars: 0,
        lastEmitAt: now,
        lastEmitChars: 0,
      };
      if (isCodeExecutionToolName(toolName)) {
        metaEvents.push({ type: "codeExecutionStatus", status: "writing", chars: 0 });
      } else if (toolName === "web_search") {
        metaEvents.push({ type: "webSearchStatus", status: "searching" });
      } else if (toolName === "web_fetch") {
        metaEvents.push({ type: "webFetchStatus", status: "fetching" });
      }
      return { metaEvents, codeResultMarkdown, webSources };
    }

    // Any non-tool block terminates active tool input accumulation
    activeBlock = null;

    if (blockType === "web_search_tool_result") {
      webSources = extractWebSearchSources(block);
      metaEvents.push({ type: "webSearchStatus", status: "done" });
    } else if (blockType === "web_fetch_tool_result") {
      metaEvents.push({ type: "webFetchStatus", status: "done" });
    } else if (
      blockType === "code_execution_tool_result" ||
      blockType === "bash_code_execution_tool_result" ||
      blockType === "code_execution_result"
    ) {
      codeResultMarkdown = formatCodeExecutionOutput(block);
      metaEvents.push({ type: "codeExecutionStatus", status: "done" });
    }

    return { metaEvents, codeResultMarkdown, webSources };
  }

  function handleInputJsonDelta(partial: string, now = Date.now()): AnthropicToolMetaEvent | null {
    if (!partial || !activeBlock) return null;

    if (activeBlock.kind === "client_tool") {
      activeBlock.inputJson += partial;
      return null;
    }

    // Server tool: count characters only (zero string buffering -> no unbounded memory leak)
    activeBlock.inputChars += partial.length;
    if (!isCodeExecutionToolName(activeBlock.name)) {
      return null;
    }

    const elapsed = now - activeBlock.lastEmitAt;
    const deltaChars = activeBlock.inputChars - activeBlock.lastEmitChars;
    if (elapsed >= throttleMs || deltaChars >= throttleChars) {
      activeBlock.lastEmitAt = now;
      activeBlock.lastEmitChars = activeBlock.inputChars;
      return {
        type: "codeExecutionStatus",
        status: "writing",
        chars: activeBlock.inputChars,
      };
    }

    return null;
  }

  function handleBlockStop(): AnthropicBlockStopOutcome {
    const current = activeBlock;
    activeBlock = null;
    if (!current) {
      return { metaEvent: null, clientToolCall: null };
    }

    if (current.kind === "client_tool" && current.id && current.name) {
      return {
        metaEvent: null,
        clientToolCall: {
          id: current.id,
          name: current.name,
          inputJson: current.inputJson,
        },
      };
    }

    if (current.kind === "server_tool" && isCodeExecutionToolName(current.name)) {
      return {
        metaEvent: {
          type: "codeExecutionStatus",
          status: "running",
          chars: current.inputChars,
        },
        clientToolCall: null,
      };
    }

    return { metaEvent: null, clientToolCall: null };
  }

  return {
    handleBlockStart,
    handleInputJsonDelta,
    handleBlockStop,
  };
}

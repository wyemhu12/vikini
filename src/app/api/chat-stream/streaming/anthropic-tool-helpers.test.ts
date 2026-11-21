import { describe, it, expect } from "vitest";
import { createAnthropicToolTracker } from "./anthropic-tool-helpers";

describe("createAnthropicToolTracker (TC-SU-01, NP-1)", () => {
  it("tracks code_execution writing (throttled), running on stop, and code_execution_tool_result stdout/stderr + done", () => {
    const tracker = createAnthropicToolTracker({ throttleMs: 500, throttleChars: 100 });

    const start = tracker.handleBlockStart(
      { type: "server_tool_use", id: "srv-1", name: "code_execution" },
      1000
    );
    expect(start.metaEvents).toEqual([
      { type: "codeExecutionStatus", status: "writing", chars: 0 },
    ]);
    expect(start.codeResultMarkdown).toBeNull();

    // Small chunk under char & time thresholds -> throttled
    expect(tracker.handleInputJsonDelta("print(", 1100)).toBeNull();

    // Crosses time threshold -> emits writing progress
    expect(tracker.handleInputJsonDelta("'hello')", 1600)).toEqual({
      type: "codeExecutionStatus",
      status: "writing",
      chars: 14,
    });

    // Crosses char threshold -> emits immediately even within time window
    const largeChunk = "x".repeat(120);
    expect(tracker.handleInputJsonDelta(largeChunk, 1650)).toEqual({
      type: "codeExecutionStatus",
      status: "writing",
      chars: 134,
    });

    // Block stop transitions to running
    const stop = tracker.handleBlockStop();
    expect(stop.clientToolCall).toBeNull();
    expect(stop.metaEvent).toEqual({
      type: "codeExecutionStatus",
      status: "running",
      chars: 134,
    });

    // Anthropic SDK BetaCodeExecutionToolResultBlock wraps stdout/stderr under content
    const result = tracker.handleBlockStart({
      type: "code_execution_tool_result",
      tool_use_id: "srv-1",
      content: {
        type: "code_execution_result",
        stdout: "OK\n",
        stderr: "warn\n",
        return_code: 0,
        content: [],
      },
    });

    expect(result.metaEvents).toEqual([{ type: "codeExecutionStatus", status: "done" }]);
    expect(result.codeResultMarkdown).toContain("**Code Output:**");
    expect(result.codeResultMarkdown).toContain("OK");
    expect(result.codeResultMarkdown).toContain("**Error Output:**");
    expect(result.codeResultMarkdown).toContain("warn");
  });

  it("NP-1: handles BetaCodeExecutionToolResultError without crashing and isolates server_tool_use input from subsequent client tool_use", () => {
    const tracker = createAnthropicToolTracker();

    tracker.handleBlockStart({ type: "server_tool_use", id: "srv-2", name: "code_execution" }, 0);
    tracker.handleInputJsonDelta("a".repeat(10_240), 100);
    tracker.handleBlockStop();

    const errResult = tracker.handleBlockStart({
      type: "code_execution_tool_result",
      tool_use_id: "srv-2",
      content: {
        type: "code_execution_tool_result_error",
        error_code: "execution_time_exceeded",
      },
    });
    expect(errResult.metaEvents).toEqual([{ type: "codeExecutionStatus", status: "done" }]);
    expect(errResult.codeResultMarkdown).toContain("execution_time_exceeded");

    // Subsequent client tool_use receives ONLY its own clean JSON (zero leakage from server_tool_use)
    tracker.handleBlockStart({ type: "tool_use", id: "tool-1", name: "get_current_time" }, 200);
    expect(tracker.handleInputJsonDelta('{"timezone":', 210)).toBeNull();
    expect(tracker.handleInputJsonDelta('"Asia/Ho_Chi_Minh"}', 220)).toBeNull();

    const stop = tracker.handleBlockStop();
    expect(stop.metaEvent).toBeNull();
    expect(stop.clientToolCall).toEqual({
      id: "tool-1",
      name: "get_current_time",
      inputJson: '{"timezone":"Asia/Ho_Chi_Minh"}',
    });
    expect(JSON.parse(stop.clientToolCall!.inputJson)).toEqual({
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("handles bash_code_execution_tool_result, web_search_tool_result, and web_fetch_tool_result", () => {
    const tracker = createAnthropicToolTracker();

    const wsStart = tracker.handleBlockStart({ type: "server_tool_use", name: "web_search" });
    expect(wsStart.metaEvents).toEqual([{ type: "webSearchStatus", status: "searching" }]);

    const wsRes = tracker.handleBlockStart({
      type: "web_search_tool_result",
      content: [{ type: "web_search_result", url: "https://example.com", title: "Example" }],
    });
    expect(wsRes.webSources).toEqual([{ uri: "https://example.com", title: "Example" }]);
    expect(wsRes.metaEvents).toEqual([{ type: "webSearchStatus", status: "done" }]);

    const wfStart = tracker.handleBlockStart({ type: "server_tool_use", name: "web_fetch" });
    expect(wfStart.metaEvents).toEqual([{ type: "webFetchStatus", status: "fetching" }]);

    const wfRes = tracker.handleBlockStart({ type: "web_fetch_tool_result", content: {} });
    expect(wfRes.metaEvents).toEqual([{ type: "webFetchStatus", status: "done" }]);

    const bashRes = tracker.handleBlockStart({
      type: "bash_code_execution_tool_result",
      content: { type: "bash_code_execution_result", stdout: "42", stderr: "", return_code: 0 },
    });
    expect(bashRes.codeResultMarkdown).toContain("42");
    expect(bashRes.metaEvents).toEqual([{ type: "codeExecutionStatus", status: "done" }]);
  });
});

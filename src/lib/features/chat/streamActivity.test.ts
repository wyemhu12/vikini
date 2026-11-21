import { describe, it, expect } from "vitest";
import {
  createInitialStreamActivity,
  formatElapsedDuration,
  formatLocalProgressText,
  formatStreamChars,
  isQuietStream,
  reduceStreamActivityFromMeta,
  reduceStreamActivityOnThinking,
  reduceStreamActivityOnToken,
  shouldShowActivityBar,
} from "./streamActivity";

describe("streamActivity (TC-SU-03, NP-2)", () => {
  it("transitions cleanly across thinking -> token -> code_writing -> code_running -> responding -> interleaved thinking -> responding", () => {
    const t0 = 1_000;
    const init = createInitialStreamActivity(t0);
    expect(init.phase).toBe("connecting");

    const thinking1 = reduceStreamActivityOnThinking(init, 1_100);
    expect(thinking1?.phase).toBe("thinking");
    // Throttled within 2000ms
    expect(reduceStreamActivityOnThinking(thinking1!, 1_500)).toBeUndefined();

    const resp1 = reduceStreamActivityOnToken(thinking1!, 2_000);
    expect(resp1?.phase).toBe("responding");
    // Throttled within 2000ms
    expect(reduceStreamActivityOnToken(resp1!, 3_000)).toBeUndefined();
    // Refreshes updatedAt after 2000ms
    const resp1Refreshed = reduceStreamActivityOnToken(resp1!, 4_100);
    expect(resp1Refreshed?.updatedAt).toBe(4_100);

    const writing = reduceStreamActivityFromMeta(
      resp1Refreshed!,
      { type: "codeExecutionStatus", status: "writing", chars: 420 },
      5_000
    );
    expect(writing).toEqual({
      phase: "code_writing",
      startedAt: 5_000,
      updatedAt: 5_000,
      chars: 420,
    });

    const writingMore = reduceStreamActivityFromMeta(
      writing!,
      { type: "codeExecutionStatus", status: "writing", chars: 900 },
      5_600
    );
    expect(writingMore?.startedAt).toBe(5_000);
    expect(writingMore?.chars).toBe(900);

    const running = reduceStreamActivityFromMeta(
      writingMore!,
      { type: "codeExecutionStatus", status: "running" },
      6_000
    );
    expect(running?.phase).toBe("code_running");
    expect(running?.chars).toBe(900);

    const done = reduceStreamActivityFromMeta(
      running!,
      { type: "codeExecutionStatus", status: "done" },
      9_000
    );
    expect(done?.phase).toBe("responding");

    const thinking2 = reduceStreamActivityOnThinking(done!, 9_200);
    expect(thinking2?.phase).toBe("thinking");
    expect(thinking2?.startedAt).toBe(9_200);

    const resp2 = reduceStreamActivityOnToken(thinking2!, 10_000);
    expect(resp2?.phase).toBe("responding");
  });

  it("handles webSearchStatus, webFetchStatus, functionCall, localQueue, and localPromptProgress", () => {
    const ws = reduceStreamActivityFromMeta(
      null,
      { type: "webSearchStatus", status: "searching" },
      100
    );
    expect(ws?.phase).toBe("web_searching");
    expect(
      reduceStreamActivityFromMeta(ws!, { type: "webSearchStatus", status: "done" }, 200)?.phase
    ).toBe("responding");

    const wf = reduceStreamActivityFromMeta(
      null,
      { type: "webFetchStatus", status: "fetching" },
      300
    );
    expect(wf?.phase).toBe("web_fetching");

    const fn = reduceStreamActivityFromMeta(
      null,
      { type: "functionCall", name: "get_current_time" },
      400
    );
    expect(fn?.phase).toBe("tool_running");
    expect(fn?.toolName).toBe("get_current_time");

    const q = reduceStreamActivityFromMeta(null, { type: "localQueue", position: 2 }, 500);
    expect(q?.phase).toBe("local_queue");
    expect(q?.queuePosition).toBe(2);

    const p = reduceStreamActivityFromMeta(
      null,
      { type: "localPromptProgress", total: 100, cache: 20, processed: 30 },
      600
    );
    expect(p?.phase).toBe("local_prompt");
    expect(p?.promptPercent).toBe(50);
  });

  it("NP-2: ignores malformed or wrong-type meta payloads safely without crashing", () => {
    expect(
      reduceStreamActivityFromMeta(null, {
        type: "codeExecutionStatus",
        status: 500,
        chars: Number.NaN,
      })
    ).toBeUndefined();
    expect(
      reduceStreamActivityFromMeta(null, {
        type: "codeExecutionStatus",
        status: "unknown_phase",
      })
    ).toBeUndefined();
    expect(
      reduceStreamActivityFromMeta(null, {
        type: "localQueue",
        position: "abc" as unknown as number,
      })
    ).toBeUndefined();
    expect(
      reduceStreamActivityFromMeta(null, { type: "functionCall", name: "   " })
    ).toBeUndefined();
  });

  it("detects quiet streams after 8s and formats durations, char counts, and local progress", () => {
    const resp = reduceStreamActivityOnToken(null, 1_000)!;
    expect(isQuietStream(resp, 8_999)).toBe(false);
    expect(shouldShowActivityBar(resp, 8_999, true)).toBe(false);
    expect(isQuietStream(resp, 9_000)).toBe(true);
    expect(shouldShowActivityBar(resp, 9_000, true)).toBe(true);

    expect(formatElapsedDuration(0)).toBe("0s");
    expect(formatElapsedDuration(12_400)).toBe("12s");
    expect(formatElapsedDuration(65_000)).toBe("1m 05s");

    expect(formatStreamChars(420)).toBe("420");
    expect(formatStreamChars(1250)).toBe("1.3K");

    expect(
      formatLocalProgressText({ type: "localQueue", position: 3 }, (k) =>
        k === "localLlmQueued" ? "Queue #{position}" : k
      )
    ).toBe("Queue #3");
  });
});

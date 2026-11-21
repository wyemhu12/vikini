import { describe, it, expect } from "vitest";
import type { Conversation } from "./conversations";
import {
  toTs,
  getTs,
  convertConversationToFrontend,
  normalizeConv,
  mergeConversations,
  patchConversationListItem,
  type FrontendConversation,
} from "./conversationListHelpers";

describe("conversationListHelpers (CT-6C-02)", () => {
  it("parses valid numeric/ISO timestamps and guards invalid inputs", () => {
    expect(toTs(1700000000000)).toBe(1700000000000);
    expect(toTs("2026-11-21T10:00:00.000Z")).toBe(Date.parse("2026-11-21T10:00:00.000Z"));
    expect(toTs("not-a-date")).toBe(0);
    expect(toTs(Number.NaN)).toBe(0);
    expect(toTs(null)).toBe(0);
    expect(getTs({ id: "c1", createdAt: 100, updatedAt: 200 })).toBe(200);
    expect(getTs({ id: "c1", createdAt: 100 })).toBe(100);
    expect(getTs(null)).toBe(0);
  });

  it("converts backend Conversation ISO dates to FrontendConversation numeric timestamps", () => {
    const backend: Conversation = {
      id: "conv-1",
      userId: "user-1",
      title: "Hello",
      lastMessagePreview: null,
      gemId: null,
      createdAt: "2026-11-20T08:00:00.000Z",
      updatedAt: "2026-11-21T08:00:00.000Z",
      model: "gemini-3.5-flash-lite",
      gem: null,
      persona: null,
      projectId: "proj-1",
      parentConversationId: null,
      forkedFromMessageId: null,
    };

    const result = convertConversationToFrontend(backend);
    expect(result.id).toBe("conv-1");
    expect(result.createdAt).toBe(Date.parse("2026-11-20T08:00:00.000Z"));
    expect(result.updatedAt).toBe(Date.parse("2026-11-21T08:00:00.000Z"));
    expect(result.projectId).toBe("proj-1");
  });

  it("handles null/invalid date normalization safely", () => {
    expect(normalizeConv(null)).toBeNull();
    expect(normalizeConv({ id: "c1", createdAt: 500 })).toEqual({
      id: "c1",
      createdAt: 500,
      updatedAt: 500,
    });
  });

  it("merges local optimistic items with SWR remote data, respects tombstones, and sorts newest-first", () => {
    const remote: FrontendConversation[] = [
      { id: "c1", title: "Old Remote Title", createdAt: 100, updatedAt: 200 },
      { id: "c2", title: "Deleted Stale Item", createdAt: 150, updatedAt: 500 },
      { id: "c3", title: "Remote Newer", createdAt: 300, updatedAt: 400 },
    ];
    const local: FrontendConversation[] = [
      { id: "c1", title: "Optimistic Title", createdAt: 120, updatedAt: 600 },
      { id: "c2", title: "Should Stay Deleted", createdAt: 150, updatedAt: 550 },
    ];
    const deletedIds = new Set(["c2"]);

    const merged = mergeConversations(local, remote, deletedIds);
    expect(merged.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(merged[0].title).toBe("Optimistic Title");
    expect(merged[0].updatedAt).toBe(600);
    expect(merged[0].createdAt).toBe(100);
  });

  it("patches a single conversation item and re-sorts to top", () => {
    const list: FrontendConversation[] = [
      { id: "c1", title: "Top", createdAt: 100, updatedAt: 500 },
      { id: "c2", title: "Bottom", createdAt: 100, updatedAt: 200 },
    ];

    const patched = patchConversationListItem(list, "c2", { title: "Renamed" }, 900);
    expect(patched[0].id).toBe("c2");
    expect(patched[0].title).toBe("Renamed");
    expect(patched[0].updatedAt).toBe(900);
    expect(patched[1].id).toBe("c1");
  });
});

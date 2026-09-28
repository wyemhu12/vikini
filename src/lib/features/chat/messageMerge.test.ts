import { describe, it, expect } from "vitest";
import { mergeMessages, type ReconcilableMessage } from "./messageMerge";

describe("mergeMessages", () => {
  it("returns remote messages when local array is empty", () => {
    const remote: ReconcilableMessage[] = [
      { id: "1", role: "user", content: "Hi" },
      { id: "2", role: "assistant", content: "Hello!" },
    ];
    expect(mergeMessages(remote, [])).toEqual(remote);
  });

  it("returns local messages when remote array is empty", () => {
    const local: ReconcilableMessage[] = [
      { id: "temp-1", role: "assistant", content: "Streaming..." },
    ];
    expect(mergeMessages([], local)).toEqual(local);
  });

  it("preserves unsynced partial message with temp- id not present on remote", () => {
    const remote: ReconcilableMessage[] = [{ id: "u1", role: "user", content: "What is AI?" }];
    const local: ReconcilableMessage[] = [
      { id: "u1", role: "user", content: "What is AI?" },
      {
        id: "temp-123",
        role: "assistant",
        content: "AI is artificial intelligence...",
        meta: { clientMessageId: "c-1", isPartial: true },
      },
    ];

    const merged = mergeMessages(remote, local);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe("temp-123");
    expect(merged[1].content).toBe("AI is artificial intelligence...");
  });

  it("deduplicates when local complete has no id and remote has same clientMessageId with real id (R3)", () => {
    const remote: ReconcilableMessage[] = [
      { id: "u1", role: "user", content: "Explain quantum computing" },
      {
        id: "real-uuid-999",
        role: "assistant",
        content: "Quantum computing uses qubits...",
        meta: { clientMessageId: "client-quantum-1" },
      },
    ];
    const local: ReconcilableMessage[] = [
      { id: "u1", role: "user", content: "Explain quantum computing" },
      {
        // Local complete message without id (identifiable by clientMessageId)
        role: "assistant",
        content: "Quantum computing uses qubits...",
        meta: { clientMessageId: "client-quantum-1" },
      },
    ];

    const merged = mergeMessages(remote, local);
    expect(merged).toHaveLength(2);
    // Result MUST have real-uuid-999 and NOT duplicate
    expect(merged[1].id).toBe("real-uuid-999");
    expect(merged[1].meta?.clientMessageId).toBe("client-quantum-1");
  });

  it("retains complete content when local is complete but remote is partial", () => {
    const remote: ReconcilableMessage[] = [
      {
        id: "real-uuid-888",
        role: "assistant",
        content: "Partial response...",
        meta: { clientMessageId: "client-p-1", isPartial: true },
      },
    ];
    const local: ReconcilableMessage[] = [
      {
        id: "temp-888",
        role: "assistant",
        content: "Full completed response from client side!",
        meta: { clientMessageId: "client-p-1", isPartial: false },
      },
    ];

    const merged = mergeMessages(remote, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("real-uuid-888");
    expect(merged[0].content).toBe("Full completed response from client side!");
  });

  it("anchors unsynced partial message right after its predecessor", () => {
    const remote: ReconcilableMessage[] = [
      { id: "u1", role: "user", content: "Turn 1" },
      { id: "a1", role: "assistant", content: "Reply 1" },
      { id: "u2", role: "user", content: "Turn 2" },
    ];
    const local: ReconcilableMessage[] = [
      { id: "u1", role: "user", content: "Turn 1" },
      { id: "a1", role: "assistant", content: "Reply 1" },
      { id: "u2", role: "user", content: "Turn 2" },
      {
        id: "temp-turn2-reply",
        role: "assistant",
        content: "Reply 2 in progress...",
        meta: { clientMessageId: "c-turn-2", isPartial: true },
      },
    ];

    const merged = mergeMessages(remote, local);
    expect(merged).toHaveLength(4);
    expect(merged[2].id).toBe("u2");
    expect(merged[3].id).toBe("temp-turn2-reply");
  });
});

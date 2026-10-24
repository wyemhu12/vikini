---
name: streaming-patterns
description: "MANDATORY when modifying SSE chat streaming logic, ReadableStream, event types, or useChatStreamController."
---

# Streaming Implementation Patterns

Read this skill when modifying streaming logic, adding new event types, or debugging streaming issues.

## SSE Event Format

Each event is a JSON line prefixed with `data: ` and terminated by `\n\n`:

```
data: {"type":"token","data":{"token":"Hello"}}\n\n
data: {"type":"meta","data":{"conversationId":"uuid","title":"Chat Title"}}\n\n
event: meta\ndata: {"type":"ragSources","ragSources":[{"filename":"...","similarity":0.85,"chunkContent":"..."}]}\n\n
event: thinking\ndata: {"type":"thinking","content":"..."}\n\n
data: {"type":"done","data":{}}\n\n
```

## Event Types

| Type         | Wire Format                                                    | Data Shape                                       | Description                            |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| `token`      | `data: {"type":"token","data":{"token":"..."}}\n\n`            | `{ token: string }`                              | Streamed answer text chunk             |
| `meta`       | `data: {"type":"meta","data":{...}}\n\n`                       | `{ conversationId, title, sources? }`            | Conversation metadata & web sources    |
| `ragSources` | `event: meta\ndata: {"type":"ragSources",...}\n\n`             | `{"type":"ragSources","ragSources":RagSource[]}` | RAG Knowledge Base source citations    |
| `thinking`   | `event: thinking\ndata: {"type":"thinking","content":...}\n\n` | `{"type":"thinking","content":string}`           | Real-time AI thinking/reasoning stream |
| `done`       | `data: {"type":"done","data":{}}\n\n`                          | `{}`                                             | Stream complete                        |
| `error`      | `data: {"type":"error","data":{...}}\n\n`                      | `{ error: string, message?: string }`            | Error occurred                         |

Full type definitions: `docs/contracts.md` section 2 (Chat Stream Events).

## Key Files

### Server-side

| File                                         | Responsibility                                 |
| -------------------------------------------- | ---------------------------------------------- |
| `src/app/api/chat-stream/route.ts`           | Entry point, auth, rate limiting               |
| `src/app/api/chat-stream/chatStreamCore.ts`  | Context building, prompt construction          |
| `src/app/api/chat-stream/streaming/utils.ts` | ReadableStream helpers (`sendEvent`), timeouts |

### Client-side

| File                                                                | Responsibility                                 |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| `src/app/features/chat/components/hooks/useChatStreamController.ts` | SSE parser, typewriter buffer, stream state    |
| `src/app/features/chat/components/ChatBubble.tsx`                   | ThinkingBlock, TypingCursor, message rendering |
| `src/app/features/chat/components/ChatApp.tsx`                      | Smart auto-scroll logic                        |

## Server Pattern

```typescript
// In streaming/utils.ts — creating a ReadableStream
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();

    function send(type: string, data: Record<string, unknown>) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
    }

    // Stream tokens from AI
    for await (const chunk of aiResponse) {
      send("token", { token: chunk.text });
    }

    send("done", {});
    controller.close();
  },
});

return new Response(stream, {
  headers: { "Content-Type": "text/event-stream" },
});
```

## Client Pattern (Typewriter Buffer)

The client decouples network speed from visual rendering:

1. **Receive**: SSE tokens arrive → push to buffer array
2. **Drain**: `setInterval` drains buffer at ~333 chars/second
3. **Flush**: If buffer > 2000 chars → flush immediately (prevent lag)
4. **Finish**: After stream ends, wait for buffer to drain naturally (max 3s)

```
Network:  [====tokens arrive fast====]
Buffer:   [========gradually drain========]
Display:  [============smooth typewriter============]
```

## Timeouts

| Model | Normal | Deep Thinking |
| ----- | ------ | ------------- |
| Pro   | 5 min  | 10 min        |
| Flash | 4 min  | 8 min         |

Configured via `AbortController` with timeout signal.

## Thinking Mode Integration

- **ThinkingBlock**: Collapsed by default, click to expand
- **Thought signatures**: `thoughtSignature` from API response MUST be sent back in subsequent turns to maintain reasoning continuity
- **Config**: `thinkingLevel` field in `ChatStreamRequest` (`off`, `minimal`, `low`, `medium`, `high`)
- **Storage**: `localStorage.vikini.thinkingLevel`

## Adding a New Event Type

1. Define the interface in `docs/contracts.md` section 2 (Chat Stream Events)
2. Add serializer in `src/app/api/chat-stream/streaming/utils.ts` — use the `sendEvent()` helper pattern
3. Add parser case in `src/app/features/chat/components/hooks/useChatStreamController.ts` — handle in the `parseSSEEvent()` function
4. Update types in `src/types/` if needed
5. Update this skill file with the new event type

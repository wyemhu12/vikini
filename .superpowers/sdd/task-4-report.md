# Task 4 Report: Extract BubbleAvatar & BubbleMarkdown

## Status

DONE

## Summary of Changes

- **BubbleAvatar Component (`BubbleAvatar.tsx`)**:
  - Extracted avatar logic from `ChatBubble.tsx` into a clean subcomponent (72 lines, target < 75).
  - User avatar: Rendered with `border-(--accent)/20 bg-(--accent) text-(--accent-foreground)` displaying `t("me") || "ME"`.
  - Bot avatar:
    - Loading state: Animated halo pulse with `border-(--accent)/30 bg-(--accent)/10` and `Sparkles` icon (eliminated hardcoded `blue-500` / `blue-400`).
    - Idle state: Renders `ModelAvatar` on `border-(--border) bg-(--surface-elevated) text-(--text-primary)`.
  - Upgraded typography to `text-xs font-black tracking-tighter` (eliminating sub-12px `text-[10px]`).
  - Wrapped in `React.memo`.
- **BubbleMarkdown Component (`BubbleMarkdown.tsx`)**:
  - Extracted full markdown rendering pipeline from `ChatBubble.tsx` into an isolated subcomponent.
  - Markdown components styled with 100% standard Vikini design tokens:
    - Headings `h1`, `h2`, `h3` styled with `text-(--text-primary)`, `border-(--border)`.
    - Blockquote styled with `border-l-2 border-(--accent)/60 text-(--text-secondary)`.
    - Tables styled with `border-(--border)`, `bg-(--surface-elevated)`, `bg-(--surface-muted)`, `text-(--text-primary)`, `text-(--text-secondary)`.
    - Links styled with `text-(--accent) hover:underline`.
    - Pre / Code blocks integrated with `SmartCode` and `ChartTool` for JSON chart specs.
    - Zero dead classes (`border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`).
  - Wrapped in `React.memo`.
- **Unit Tests (`BubbleAvatar.test.tsx`)**:
  - 11 comprehensive tests covering:
    - User avatar rendering with `t("me")`.
    - Model avatar rendering with `modelName`.
    - Loading halo pulse with `Sparkles`.
    - Design token classes and absence of dead classes.
    - Markdown bot message rendering (headings, paragraphs, lists, quotes, links, tables, typing cursor).
    - User raw message plain text rendering.

## Verification Results

- `npx vitest run src/app/features/chat/components/BubbleAvatar.test.tsx`: 11 passed (11 tests)
- `npx vitest run src/app/features/chat/components/`: 47 passed (4 suites: SmartCode, MessageActions, BubbleHelpers, BubbleAvatar)
- `npm run type-check`: 0 errors
- `npx vitest run`: 581 passed (44 suites across entire repo)

## Commit

- `8c982d7 refactor(chat): extract BubbleAvatar and BubbleMarkdown components`

# Task 2: BubbleHelpers Polish (TypingDots, Anti-orphan TypingCursor, ThinkingBlock)

**Files:**

- Modify: `src/app/features/chat/components/BubbleHelpers.tsx`
- Create: `src/app/features/chat/components/BubbleHelpers.test.tsx`

**Interfaces:**

- Produces:
  - `TypingDots`: Loading animation
  - `TypingCursor`: Blinking cursor during streaming
  - `ThinkingBlock`: Collapsible reasoning block

## Requirements:

1. Write unit tests in `src/app/features/chat/components/BubbleHelpers.test.tsx`:
   - Verify `TypingDots` renders properly.
   - Verify `TypingCursor` renders with `aria-hidden="true"` and appropriate inline-block classes.
   - Verify `ThinkingBlock` renders button with `aria-expanded` and toggles when clicked.
2. In `BubbleHelpers.tsx`:
   - Fix dead classes:
     - `bg-secondary` -> `bg-(--accent)` (in TypingDots)
     - `text-secondary hover:text-primary` -> `text-(--text-secondary) hover:text-(--text-primary)` (in ThinkingBlock)
     - `bg-(--control-bg)` and `border-(--border)`
   - In `ThinkingBlock`:
     - Add `aria-expanded={!isCollapsed}` to the toggle button.
     - Add `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` and `active:scale-[0.98]`.
     - Smooth Framer Motion accordion collapse with `height: "auto"`.
     - Rotate chevron smoothly.
   - In `TypingCursor`:
     - Ensure it is rendered with `inline-block whitespace-nowrap ml-1 align-middle` to prevent orphan line drops.
3. Verify tests pass: `npx vitest run src/app/features/chat/components/BubbleHelpers.test.tsx`.
4. Commit: `git add src/app/features/chat/components/BubbleHelpers.tsx src/app/features/chat/components/BubbleHelpers.test.tsx; git commit -m "feat(chat): polish BubbleHelpers with anti-orphan cursor and a11y thinking accordion"`.

# Task 2 Report: BubbleHelpers Polish (TypingDots, Anti-orphan TypingCursor, ThinkingBlock)

## Status

DONE

## Summary of Changes

- **`TypingDots`**:
  - Replaced dead token `bg-secondary` with design token `bg-(--accent)`.
- **`TypingCursor`**:
  - Updated classes to `inline-block whitespace-nowrap ml-1 align-middle w-0.5 h-4 bg-(--primary) rounded-sm` to prevent orphan cursor line drops at the end of streaming lines while preserving `aria-hidden="true"`.
- **`ThinkingBlock`**:
  - Added `aria-expanded={!isCollapsed}` and explicit `type="button"` to toggle button for accessibility.
  - Replaced dead classes `text-secondary hover:text-primary` with `text-(--text-secondary) hover:text-(--text-primary)`.
  - Replaced dead class in content panel `text-secondary` with `text-(--text-secondary)`.
  - Added interactive feedback and focus rings: `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.98]`.
  - Smoothed Framer Motion chevron rotation with `transition={{ duration: 0.2, ease: "easeInOut" }}`.
- **Unit Tests**:
  - Created `src/app/features/chat/components/BubbleHelpers.test.tsx` with 7 test cases covering `TypingDots`, `TypingCursor`, and `ThinkingBlock` (a11y `aria-expanded`, expand/collapse toggling, translations, and design tokens).

## Verification Results

- `npx vitest run src/app/features/chat/components/BubbleHelpers.test.tsx`: 7 passed (7 tests)
- `npm run type-check`: 0 errors

## Commit

- `4556a7b feat(chat): polish BubbleHelpers with anti-orphan cursor and a11y thinking accordion`

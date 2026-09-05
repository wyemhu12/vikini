# Task 3 Report: MessageActions Floating Glass Dock Upgrade

## Status

DONE

## Summary of Changes

- **Floating Glass Dock Container**:
  - Transformed action bar into a floating glass dock container: `backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) shadow-sm rounded-full px-2.5 py-1 flex items-center gap-2`.
  - Preserved responsive hover opacity and bot/user layout direction (`opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 ${isBot ? "" : "flex-row-reverse"}`).
- **Typography & Token Modernization**:
  - Upgraded all sub-12px `text-[10px]` to `text-xs font-semibold`.
  - Replaced dead tokens (`text-secondary hover:text-primary`, `hover:text-(--accent)`) with design tokens `text-(--text-secondary) hover:text-(--accent)` and `text-(--danger)`.
- **Touch Targets & Micro-Interactions**:
  - Ensured all buttons have touch targets >= 28px using `min-h-[28px] min-w-[28px]` and appropriate padding.
  - Added micro-interactions: `active:scale-[0.92] transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`.
  - Added spin feedback on `RefreshCw` icon when `regenerating` is active.
- **Accessibility**:
  - Added explicit `type="button"` to all action buttons (Copy, Edit, Regenerate, Delete, TTS Speak).
  - Added explicit `aria-label` matching button purpose / state alongside `title`.
  - Added `aria-pressed={Boolean(isSpeaking)}` on TTS button.
- **Unit Tests**:
  - Created `src/app/features/chat/components/MessageActions.test.tsx` with 17 unit tests covering:
    - Bot message copy button trigger & copied state display.
    - User message edit button trigger and visibility guards.
    - Assistant message regenerate button trigger, `canRegenerate` condition, and disabled state when regenerating.
    - TTS speak button trigger, `aria-pressed` state, and user message guard.
    - Delete button trigger with `messageId` and missing param guard.
    - Floating glass dock classes, user/bot layout directions, `type="button"`, touch targets >= 28px, micro-interactions, no dead tokens, and no sub-12px font sizes.

## Verification Results

- `npx vitest run src/app/features/chat/components/MessageActions.test.tsx`: 17 passed (17 tests)
- `npx vitest run src/app/features/chat/components/`: 36 passed (3 suites: SmartCode, MessageActions, BubbleHelpers)
- `npm run type-check`: 0 errors

## Commit

- `3dacd2f feat(chat): upgrade MessageActions to floating glass dock with touch targets and tokens`

# Task 5: ChatBubble Shell Decomposition & Integration Test

**Files:**

- Modify: `src/app/features/chat/components/ChatBubble.tsx`
- Create: `src/app/features/chat/components/ChatBubble.test.tsx`

**Interfaces:**

- Consumes: `BubbleAvatar`, `BubbleMarkdown`, `MessageActions`, `BubbleHelpers` (`TypingDots`, `TypingCursor`, `ThinkingBlock`), `SourceLinks`, `ImageGenPreview`, `TokenBadge`, `FileInMessage`, `FileLightbox`, `useLanguage()`
- Produces: `ChatBubble(props: ChatBubbleProps)`

## Requirements:

1. Decompose `ChatBubble.tsx` into a lean shell controller:
   - Import `BubbleAvatar` from `./BubbleAvatar` and `BubbleMarkdown` from `./BubbleMarkdown`.
   - Remove inline markdown renderers (`PreBlock`, `mdComponents`, `parseChart`, etc.) which are now in `BubbleMarkdown.tsx`.
   - Remove inline avatar rendering block which is now in `BubbleAvatar.tsx`.
   - Fix all remaining dead classes:
     - User bubble: `bg-(--accent) px-4 py-2.5 text-(--accent-foreground) shadow-lg` (replace `bg-(--primary) text-(--surface)`).
     - Assistant text: `text-(--text-primary)` (replace `text-primary`).
     - Lightbox file loading / errors: ensure only design tokens.
   - Maintain `useDeferredValue` for `displayContent` for smooth scrolling.
   - Target line count: < 220 lines (must be under 400 lines, down from 582).
2. Create unit/integration tests in `src/app/features/chat/components/ChatBubble.test.tsx`:
   - Test user message rendering (content, avatar, edit button).
   - Test assistant message rendering (markdown display, thinking block when thought present, actions dock).
   - Test edit mode (click edit, modify textarea, save edit).
3. Verify tests pass: `npx vitest run src/app/features/chat/components/ChatBubble.test.tsx`.
4. Verify `npm run type-check`.
5. Commit: `git add src/app/features/chat/components/ChatBubble.tsx src/app/features/chat/components/ChatBubble.test.tsx; git commit -m "refactor(chat): decompose ChatBubble into modular shell under 220 lines"`.

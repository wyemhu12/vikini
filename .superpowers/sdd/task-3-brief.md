# Task 3: MessageActions Floating Glass Dock Upgrade

**Files:**

- Modify: `src/app/features/chat/components/MessageActions.tsx`
- Create: `src/app/features/chat/components/MessageActions.test.tsx`

**Interfaces:**

- Consumes: `useLanguage()`, `VoiceWaveform`
- Produces: `MessageActions(props: MessageActionsProps)`

## Requirements:

1. Write unit tests in `src/app/features/chat/components/MessageActions.test.tsx`:
   - Verify copy button works for bot message.
   - Verify edit button renders and works for user message.
   - Verify regenerate button renders and works for assistant message when `canRegenerate={true}`.
   - Verify TTS speak button triggers `onSpeak`.
   - Verify all buttons have appropriate title or aria-label and touch targets.
2. In `MessageActions.tsx`:
   - Transform container into Floating Glass Dock:
     `backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) shadow-sm rounded-full px-2.5 py-1 flex items-center gap-2`.
   - Upgrade all `text-[10px]` to `text-xs font-semibold`.
   - Replace dead tokens (`text-secondary hover:text-primary`, `hover:text-(--accent)`) with:
     `text-(--text-secondary) hover:text-(--accent)`.
   - Ensure tap targets $\ge 28\text{px}$ with micro-interactions:
     `active:scale-[0.92] transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`.
   - Add proper `type="button"` to all buttons.
3. Verify tests pass: `npx vitest run src/app/features/chat/components/MessageActions.test.tsx`.
4. Verify type check: `npm run type-check`.
5. Commit: `git add src/app/features/chat/components/MessageActions.tsx src/app/features/chat/components/MessageActions.test.tsx; git commit -m "feat(chat): upgrade MessageActions to floating glass dock with touch targets and tokens"`.

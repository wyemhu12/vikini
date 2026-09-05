# Task 6: InputForm & ChatControls Polish

**Files:**

- Modify: `src/app/features/chat/components/InputForm.tsx`
- Modify: `src/app/features/chat/components/ChatControls.tsx`

**Interfaces:**

- `InputForm`: Remove `t?: Record<string, string>` prop; consume `useLanguage()` directly.
- `ChatControls`: Passes props to `InputForm` without `t`, standardizes font to `text-xs`.

## Requirements:

1. `InputForm.tsx`:
   - Remove inline SVGs (`PaperAirplaneIcon`, `StopIcon`).
   - Import `SendHorizontal` and `Square` from `lucide-react`.
   - Remove `t?: Record<string, string>` prop from `InputFormProps` and function signature.
   - Import and call `const { t } = useLanguage();` directly (compliant with `rules/04-bilingual.md`).
   - Implement smart Send/Stop button state machine:
     - Empty/disabled: `bg-(--control-bg) text-(--text-secondary) opacity-40 cursor-not-allowed scale-95`
     - Ready (text or files present): `bg-(--accent) text-(--accent-foreground) hover:brightness-110 active:scale-[0.92] shadow-[0_0_15px_var(--accent)] scale-100`
     - Streaming: `bg-(--danger) text-white ring-2 ring-(--danger)/30 hover:brightness-110 active:scale-[0.92]` with `Square` icon.
   - Micro-interactions: `transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-(--ring)`.
   - Add keyboard shortcut hints subtly displayed when focused (`↵ Send`, `Shift+↵ New line`) in `text-xs text-(--text-secondary)/60`.
   - Replace any remaining dead tokens (`bg-surface-base` -> `bg-(--surface-elevated)`).
2. `ChatControls.tsx`:
   - Remove `t={t}` prop passed to `<InputForm />`.
   - Replace dead class `bg-surface/95` with `bg-(--surface)/95`.
   - Replace sub-12px font sizes (`text-[8px]`, `text-[10px]`) with `text-xs font-semibold`.
   - In Agent Selector Popover (Deep Research): Replace manual `<div className="fixed inset-0" onClick=... />` with clean backdrop or Radix Popover primitive.
   - Ensure all buttons have `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` and `active:scale-[0.95]`.
3. Verify `npm run type-check`.
4. Verify `npx vitest run src/app/features/chat/components`.
5. Commit: `git add src/app/features/chat/components/InputForm.tsx src/app/features/chat/components/ChatControls.tsx; git commit -m "feat(chat): polish InputForm and ChatControls with Lucide icons and token compliance"`.

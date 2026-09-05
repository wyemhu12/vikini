# Task 6 Implementation Report: InputForm & ChatControls Polish

## Executive Summary

Successfully completed Task 6: Polished `InputForm.tsx` and `ChatControls.tsx` to meet modern Tailwind 4 design token standards, strict bilingual i18n rules, and Emil Kowalski micro-interaction patterns.

## Changes Implemented

### 1. `InputForm.tsx`

- **Icon Modernization**: Removed inline SVGs (`PaperAirplaneIcon`, `StopIcon`). Imported and utilized `SendHorizontal` and `Square` from `lucide-react`.
- **Prop Cleanup & Direct i18n**: Removed prop-drilling `t?: Record<string, string>` from `InputFormProps` and function parameters. Directly consumed `useLanguage()` hook in compliance with `rules/04-bilingual.md`.
- **Smart Send/Stop Button State Machine**:
  - **Empty / Disabled**: `bg-(--control-bg) text-(--text-secondary) opacity-40 cursor-not-allowed scale-95`
  - **Ready (text or files present)**: `bg-(--accent) text-(--accent-foreground) hover:brightness-110 active:scale-[0.92] shadow-[0_0_15px_var(--accent)] scale-100`
  - **Streaming**: `bg-(--danger) text-white ring-2 ring-(--danger)/30 hover:brightness-110 active:scale-[0.92]` with `Square` icon (clicking triggers `onStop`).
- **Micro-Interactions**: Added `transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` and `active:scale-[0.95]` to interactive triggers.
- **Keyboard Shortcut Hints**: Added subtle keyboard shortcut hint bar (`↵ Send`, `Shift+↵ New line`) displayed when textarea is focused (`text-xs text-(--text-secondary)/60`) on desktop screens.
- **Token Compliance**: Replaced legacy `bg-surface-base` with `bg-(--surface-elevated)` and upgraded sub-12px badges to `text-xs`.

### 2. `ChatControls.tsx`

- **Radix Popover Integration**: Replaced manual backdrop `<div className="fixed inset-0" onClick=... />` in Deep Research Agent Selector with Radix `Popover`, `PopoverTrigger`, `PopoverContent`.
- **Token Fixes**: Replaced dead class `bg-surface/95` with tokenized `bg-(--surface)/95`.
- **Typography Standards**: Upgraded all sub-12px font sizes (`text-[8px]`, `text-[9px]`, `text-[10px]`) to standard `text-xs font-semibold`.
- **Button Micro-Interactions**: Ensured all toolbar buttons have `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`, `active:scale-[0.95]`, and smooth transitions.

### 3. Localization & Testing

- Added `newLine` key to English (`en.ts`) and Vietnamese (`vi.ts`) dictionaries.
- Created unit test suite `src/app/features/chat/components/InputForm.test.tsx` verifying all button state machine states, shortcut hints, and image mode.

## Verification

- `npm run type-check`: Passed (0 errors).
- `npx vitest run src/app/features/chat/components`: Passed 64/64 tests across 6 test suites.
- Commit created: `923dce9` (feat(chat): polish InputForm and ChatControls with Lucide icons and token compliance).

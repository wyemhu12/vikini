# Task 1: SmartCode Developer-Grade Upgrade & Tests

**Files:**

- Modify: `src/app/features/chat/components/SmartCode.tsx`
- Create: `src/app/features/chat/components/SmartCode.test.tsx`

**Interfaces:**

- Consumes: `extractText` utility, `useLanguage()`
- Produces: `SmartCode({ inline, className, children }: SmartCodeProps)`

## Requirements:

1. Write unit test for SmartCode in `src/app/features/chat/components/SmartCode.test.tsx` using Vitest and `@testing-library/react`.
   - Test inline rendering (`<code className="...">`).
   - Test block code with language label and copy button.
   - Test copy to clipboard action.
   - Test collapse/expand behavior when lineCount > 20.
2. Remove fake Mac window buttons (`#ff5f56`, `#ffbd2e`, `#27c93f`).
3. Replace header with minimalist developer-grade design:
   - Monospace uppercase language badge (`font-mono text-xs font-semibold text-(--text-secondary)`).
   - Clean copy button with morphing feedback: when copied, show `Check` icon in `text-(--success)` and text `t("copied")` or "Copied", otherwise `Copy` icon and `t("copy")` or "Copy".
4. Add gradient fade mask:
   - When code exceeds 20 lines, render a gradient fade mask `bg-gradient-to-t from-(--surface-elevated) to-transparent` over the bottom of the collapsed code block.
   - Provide an "Expand code" / "Collapse code" button styled cleanly with `text-xs font-medium text-(--text-secondary) hover:text-(--text-primary)`.
5. Fix all dead tokens:
   - Replace `card-surface`, `bg-control`, `bg-surface-muted`, `border-token`, `text-secondary` with:
     - `bg-(--surface-elevated)`
     - `border-(--border)`
     - `bg-(--control-bg)`
     - `text-(--text-primary)`
     - `text-(--text-secondary)`
     - `text-(--accent)` for inline code
6. Add active press feedback `active:scale-[0.95]` on interactive buttons and `focus-visible:ring-2 focus-visible:ring-(--ring)`.
7. Verify tests pass: `npx vitest run src/app/features/chat/components/SmartCode.test.tsx`.
8. Commit: `git add src/app/features/chat/components/SmartCode.tsx src/app/features/chat/components/SmartCode.test.tsx; git commit -m "refactor(chat): upgrade SmartCode to developer-grade with design tokens and tests"`.

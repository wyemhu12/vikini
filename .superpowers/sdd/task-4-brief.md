# Task 4: Extract BubbleAvatar & BubbleMarkdown

**Files:**

- Create: `src/app/features/chat/components/BubbleAvatar.tsx`
- Create: `src/app/features/chat/components/BubbleMarkdown.tsx`
- Create: `src/app/features/chat/components/BubbleAvatar.test.tsx`

**Interfaces:**

- Produces:
  - `BubbleAvatar({ isBot, isLoading, modelName }: BubbleAvatarProps)`
  - `BubbleMarkdown({ content, isBot }: BubbleMarkdownProps)`

## Requirements:

1. `BubbleAvatar.tsx`:
   - Extracted from `ChatBubble.tsx` (< 75 lines).
   - If `!isBot`: Show user text `t("me") || "ME"` or icon with `border-(--accent)/20 bg-(--accent) text-(--accent-foreground)` and rounded corners.
   - If `isBot`:
     - If `isLoading`: render animated halo pulse with `bg-(--accent)/10 border-(--accent)/30` and `Sparkles` icon (no hardcoded blue-500).
     - If not loading: render `ModelAvatar` with `modelName={modelName}` on `border-(--border) bg-(--surface-elevated) text-(--text-primary)`.
   - Wrap in `React.memo`.
2. `BubbleMarkdown.tsx`:
   - Extracted Markdown rendering logic from `ChatBubble.tsx` (< 170 lines).
   - Imports: `ReactMarkdown`, `remarkGfm`, `rehypeRaw`, `rehypeSanitize`, `rehypeHighlight`.
   - Configures markdown components:
     - `p`: `<p className="mb-5 last:mb-0 leading-relaxed break-words">{children}</p>`
     - `h1`: `<h1 className="mt-8 mb-4 text-xl md:text-2xl font-bold tracking-tight text-(--text-primary) border-b border-(--border) pb-2">{children}</h1>`
     - `h2`: `<h2 className="mt-7 mb-3 text-lg md:text-xl font-semibold tracking-tight text-(--text-primary)">{children}</h2>`
     - `h3`: `<h3 className="mt-6 mb-2 text-base font-semibold text-(--text-primary)">{children}</h3>`
     - `blockquote`: `<blockquote className="border-l-2 border-(--accent)/60 pl-4 py-1 my-4 text-(--text-secondary) italic">{children}</blockquote>`
     - `ul`: `<ul className="mb-5 ml-6 list-disc space-y-2">{children}</ul>`
     - `ol`: `<ol className="mb-5 ml-6 list-decimal space-y-2">{children}</ol>`
     - `li`: `<li className="leading-relaxed">{children}</li>`
     - `a`: `<a href={href} target="_blank" rel="noopener noreferrer" className="text-(--accent) hover:underline break-all">{children}</a>`
     - `table`: `<div className="overflow-x-auto my-4 rounded-lg border border-(--border) bg-(--surface-elevated)"><table className="w-full text-left text-sm">{children}</table></div>`
     - `thead`: `<thead className="bg-(--surface-muted) uppercase font-bold text-xs text-(--text-secondary)">{children}</thead>`
     - `th`: `<th className="px-4 py-3 border-b border-(--border) text-(--text-primary)">{children}</th>`
     - `td`: `<td className="px-4 py-3 border-b border-(--border) text-(--text-secondary)">{children}</td>`
     - `code`: Inline code vs block code via `SmartCode`.
     - `pre`: PreBlock wrapping `SmartCode`.
     - Also support `ChartTool` if present in original code.
   - Absolutely NO dead classes (`border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`).
   - Wrap in `React.memo`.
3. Unit tests in `src/app/features/chat/components/BubbleAvatar.test.tsx`:
   - Test user avatar rendering.
   - Test bot avatar rendering with model name.
   - Test loading pulse rendering.
4. Verify tests pass: `npx vitest run src/app/features/chat/components/BubbleAvatar.test.tsx`.
5. Verify `npm run type-check`.
6. Commit: `git add src/app/features/chat/components/BubbleAvatar.tsx src/app/features/chat/components/BubbleMarkdown.tsx src/app/features/chat/components/BubbleAvatar.test.tsx; git commit -m "refactor(chat): extract BubbleAvatar and BubbleMarkdown components"`.

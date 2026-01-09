---
trigger: always_on
---

# UI & UX Standards (Vikini)

## 1. Design Philosophy

- **Modern & Premium**: clean typography, strong whitespace.
- **Interactive**: hover/active/focus states are mandatory.
- **Mobile First**: Design for small screens first, then scale up.

## 2. Anti-Patterns (DO NOT DO)

- ❌ **Fixed Widths**: Avoid `w-[500px]`. Use `w-full max-w-lg`.
- ❌ **Heavy Borders**: Avoid thick, dark borders. Use `border-border` (subtle).
- ❌ **Raw Colors**: Do not use `bg-blue-500`. Use semantic colors: `bg-primary`, `bg-destructive`.
- ❌ **No Z-Index Wars**: Use configured z-indices, don't use arbitrary `z-[9999]`.

## 3. Component Usage

- **Shadcn/UI**: The golden standard. Check `components/ui` first.
- **Lucide Icons**: The only icon set allowed.
- **Tailwind**: Use utility classes. Avoid `style={{}}`.

## 4. Theme Integration

- themes are located in `app/styles/themes/`.
- Ensure components look good in both **Light** and **Dark** modes (if applicable).

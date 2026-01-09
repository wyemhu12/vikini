---
trigger: always_on
---

# Coding Standards (Vikini)

## 1. Project Structure & Organization

### Feature Slices

- **Logic**: Place feature-specific logic in `lib/features/<feature-name>`.
- **UI**: Place feature-specific UI in `app/features/<feature-name>` (or `components/features/<feature-name>` if strictly enforced).
- **Isolation**: Features should not import heavily from other features. Use `lib/core` for shared logic.

### Shared UI

- **Location**: `components/ui/`
- **Rule**: Only generic, reusable primitives go here (Buttons, Cards, Inputs).
- **No Business Logic**: Shared components must be dumb (pure presentation).

### State Management

- **Zustand**: Use for global client state.
- **Location**: `lib/store/` or inside `lib/features/<feature>/store.ts`.

## 2. TypeScript Enforcement

- **Strict TypeScript**: `.ts` or `.tsx` only. No `.js`.
- **No Any**: Avoid `any`. Use `unknown` or proper types.
- **Interfaces**: Prefer `interface` over `type` for object definitions.

## 3. Naming Conventions

- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Functions/Vars**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

# Model Routing Guide

> Reference doc — not a rule. Use judgment based on task complexity.

## Task-to-Model Tier Mapping

| Task Type                       | Recommended Tier | Rationale                                            |
| ------------------------------- | ---------------- | ---------------------------------------------------- |
| Lint fix, format, simple rename | Smaller/cheaper  | Deterministic, no deep reasoning needed              |
| Feature development, debugging  | Full model       | Needs deep reasoning and broad context               |
| Code review, audit              | Full model       | Requires understanding of patterns and architecture  |
| Documentation updates           | Smaller model    | Mostly text generation, low complexity               |
| Test writing                    | Full model       | Needs understanding of business logic and edge cases |
| Config changes, env updates     | Smaller model    | Mechanical, template-based changes                   |
| Multi-file refactor             | Full model       | Needs cross-file context and impact analysis         |

## Guidelines

- **Default to full model** when unsure — correctness > cost savings.
- **Smaller model** is appropriate when the task has a clear, unambiguous pattern.
- **Never use smaller models** for security-sensitive changes (auth, encryption, RLS).
- Context window matters: if the task requires reading 10+ files, use a full model.

## Cost Awareness

- Smaller models: ~10-20x cheaper per token.
- Most cost comes from iterative verify cycles, not the initial generation.
- Getting it right the first time (full model) is often cheaper than 3 retries (smaller model).

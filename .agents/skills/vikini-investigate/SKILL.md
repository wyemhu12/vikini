---
name: vikini-investigate
description: "MANDATORY when answering read-only architecture questions (/how, /why), recovering session context (/recall), or analyzing blast-radius before modifying shared modules in src/lib/core/ or src/lib/features/."
---

# Vikini Investigate (Read-Only)

**Hard Rule**: This skill is strictly read-only. NEVER create, modify, or delete any file, and NEVER run mutating shell commands. Use only `view_file`, `grep_search`, `list_dir`, `find_by_name`, and read-only commands allowed in `.agents/agents/reviewer/allowlist.md` (`git status|diff|log|show|blame` matching `READ_ONLY_COMMANDS` in `.agents/scripts/code-freeze-guard.js`).

---

## Mode 1: `/how` — Runtime & Architecture Trace

Use when explaining how a feature, flow, or subsystem works end-to-end across Vikini's architecture boundaries (`src/app/` → `src/lib/features/` → `src/lib/core/`).

### Procedure

1. **Locate Entry Point**: Identify the UI trigger (`src/app/features/**` or `src/components/ui/**`) or API route (`src/app/api/**/route.ts`).
2. **Trace Feature Orchestration**: Follow calls into `src/lib/features/<domain>/**` (controllers, hooks, business services).
3. **Trace Infrastructure Boundary**: Follow calls into `src/lib/core/**` (Supabase admin/server client, Upstash Redis rate limiter/cache, Gemini/Claude/Groq/OpenRouter clients).
4. **Parallel Subagent Option (Large Subsystems)**: If the trace spans > 3 modules, dispatch 2–3 `research` subagents concurrently by layer (UI/Store, Feature Service, Core/DB) and synthesize their findings into one unified mental model.

### Required Output

- **Call Chain**: Ordered sequence with exact `file:line` citations (`[SRC]`).
- **Boundary Data Shapes**: Input/output interfaces at each layer boundary.
- **State Ownership**: Explicit mapping of what lives in Zustand (client), SWR (client cache), or Supabase/Redis (server).
- **Sharp Edges**: Timeouts, rate-limit gates, fallback branches, or concurrency hazards.

---

## Mode 2: `/why` — Historical & Intent Evidence

Use when investigating why a piece of code, constraint, or workaround exists before changing or removing it.

### Procedure

1. **Git Archaeology**: Run allowlisted read-only history commands:
   - `git log --oneline -n 20 -- <path>`
   - `git blame -L <start>,<end> <path>`
   - `git show <sha>`
2. **Governance & Living Docs Cross-Check**: Search `docs/plans/`, `docs/lessons-learned.md`, and `docs/CHANGELOG.md` for the symbol, file path, or commit context.

### Required Output

Present findings in a two-column separation:

| Fact (`[CMD]` / `[SRC]`)                     | Inference (Architectural Interpretation) |
| -------------------------------------------- | ---------------------------------------- |
| Commit SHA, date, exact diff or lesson entry | Why the author chose this trade-off      |

End with a mandatory classification:

- **Intentional Design**: Guardrail or business invariant that must be preserved.
- **Regression / Accidental**: Safe to fix or refactor (with plan approval).
- **Unknown**: Insufficient evidence; flag risk before modifying.

---

## Mode 3: `/recall` — Context Recovery

Use when resuming a session, switching tasks, or checking current project state.

### Procedure

1. Inspect the most recently modified plan in `docs/plans/` (check `Status:` header and whether `[PLAN_APPROVED]` is on the final line).
2. Read the top entry of `docs/CHANGELOG.md`.
3. Run `git status` and `git log --oneline -n 5`.

### Required Output

1. **Completed (`Đã xong`)**: Verified changes reflected in git status/log or changelog.
2. **In Progress (`Đang dở`)**: Uncommitted files or pending checklist items in the active plan.
3. **Next Step (`Bước tiếp theo`)**: Immediate actionable step and current Code Freeze state (`Status` + `[PLAN_APPROVED]` presence).

---

## Mode 4: `/blast-radius` — Impact Analysis

MANDATORY before modifying any exported function, type, constant, or class in `src/lib/core/` or `src/lib/features/`.

### Procedure

1. Run `grep_search` across `src/` and `tests/` for all import sites and call sites of the target symbol (including `@/lib/...` path aliases and relative imports).
2. Locate all co-located unit/integration tests (`*.test.ts`, `*.test.tsx`) covering the module and its callers.

### Required Output

| Caller                | `file:line` | Usage Pattern            | Compatible? (`Yes` / `No` + Reason)   |
| --------------------- | ----------- | ------------------------ | ------------------------------------- |
| Module / route / hook | Exact line  | How args/return are used | Whether proposed change breaks caller |

- **Co-Located Tests Affected**: List every `*.test.ts` file that must be run or updated per Test Contract.
- **Migration Rule**: If any caller is marked `No`, the implementation plan MUST include explicit migration steps for that caller.

---

## Output Contract & Anti-Patterns

- **Output Contract**: Every claim must carry `[SRC]` (`file:line`) or `[CMD]` evidence. Communicate in Vietnamese (keep technical identifiers in English).
- **Anti-Patterns (BANNED)**:
  - Guessing runtime behavior without reading the source file.
  - Re-reading the same file range multiple times in one session (`00-core.md` §Token Efficiency).
  - Dumping unbounded git logs or test outputs without `-n <N>` or path scoping.

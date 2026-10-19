---
name: vikini-simplify
description: "MANDATORY when asked to simplify code, clean up dead code, or reduce complexity (/simplify) without changing runtime behavior. Deletions and flattening only."
---

# Vikini Simplify (Behavior-Preserving Code Reduction)

Use this skill when simplifying existing code, removing dead code, or flattening control flow while keeping runtime behavior identical.

---

## Principles

1. **Subtract Before You Add**: Prefer deleting unused code, redundant state, and single-use indirection over introducing new helpers or abstractions.
2. **Laziness Protocol**: Among all correct solutions that satisfy Vikini's standards, choose the one with the fewest lines and lowest cognitive load. Never add speculative configuration or wrapper layers.
3. **Strict Behavior Preservation**: External inputs, outputs, side effects, error codes, toast notifications, and UI rendering must remain unchanged.

---

## Allowed Operations (Only 4 Categories)

1. **Dead Code Removal**:
   - Delete unused exports, imports, local variables, helper functions, or unreachable branches.
   - Requires `grep_search` proof showing `0` external references across `src/` and `tests/`.
2. **Inline Single-Caller Wrappers**:
   - Inline trivial pass-through functions or intermediate variables that have only 1 caller and add no domain clarity.
3. **Redundant State & Prop Elimination**:
   - Replace derived `useState` + `useEffect` sync pairs with direct calculation during render or `useMemo`.
   - Remove unused component props after verifying all JSX call sites.
4. **Control Flow Flattening**:
   - Convert deeply nested `if/else` chains or try-blocks into early returns / guard clauses.
   - Keep individual functions under 50 lines (`.agents/rules/01-coding.md`).

---

## Forbidden Actions

- **NO New Features or Spec Changes**: Do not alter business rules, validation thresholds, or API payloads.
- **NO Unchecked Public Signature Changes**: Do not change exported signatures in `src/lib/core/` or `src/lib/features/` without first running `/blast-radius` from `.agents/skills/vikini-investigate/SKILL.md`.
- **NO UI Text or Styling Drift**: Do not change translation keys (`t("...")`), semantic color tokens, or DOM structure expected by users/tests.
- **NO Weakening Tests**: Never delete `expect()`, loosen matchers, or skip tests to make verification pass (`.agents/rules/02-quality.md` §Test Failure Triage Protocol).
- **NO Formatting Noise**: Do not reformat untouched lines or reorganize unrelated imports (`.agents/rules/02-quality.md` §Minimal Diffs Policy).

---

## Step-by-Step Procedure

1. **Baseline Verification**:
   - Run `npm run verify` (`type-check` + `lint` + `test:run`) and record the passing test count before touching any code.
2. **Zero-Reference Proof**:
   - For every symbol slated for deletion, run `grep_search` across the workspace to confirm `0` active usages.
3. **Apply Minimal Edits**:
   - Perform one focused simplification at a time using `replace_file_content`.
4. **Tier 1 Sanity Check**:
   - Run `npm run type-check` immediately after each file edit.
5. **Tier 2 Full Verification**:
   - Run `npm run verify` after completing all edits. Total passing tests must be `>=` baseline (unless dead test files for removed dead code were explicitly approved in a plan's Test Contract).
6. **Before/After Evidence Report**:
   - Output a summary table in Vietnamese:

| File      | Thao tác (Allowed Category)  | Dòng trước → sau | Evidence (`[CMD]` / `[SRC]`)                 |
| --------- | ---------------------------- | ---------------- | -------------------------------------------- |
| `src/...` | Dead code / Inline / Flatten | `120 → 95`       | `grep_search` 0 refs + `npm run verify` PASS |

---

## Governance & Code Freeze Compliance

- Simplifying files in `src/**` is a code modification and is subject to `.agents/rules/05-plan-review.md`.
- Full refactors or multi-file dead code cleanups require an approved plan (`[PLAN_APPROVED]`).
- Only a single micro-edit (`replace_file_content` `<= 40` lines on an eligible UI/styling/translation file) may use **Fast-Track Mode** (`.agents/rules/05-plan-review.md` §1.1). Never split a larger cleanup into multiple `<= 40`-line edits to bypass planning.

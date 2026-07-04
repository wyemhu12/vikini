---
description: Systematic debugging protocol. No fixes without confirmed root cause.
---

# /debug Workflow

Use this workflow for complex or recurring bugs. Core rule: no fixes without a confirmed root cause.

## Phase 1: Preparation

1. Read `docs/lessons-learned.md` — check if this bug pattern has been seen before.
2. Read relevant domain docs (contracts.md, database-schema.md, security.md).

## Phase 2: Root Cause Investigation

> **Do not propose code changes yet. Gather evidence first.**

1. Analyze stack traces and logs. Identify file paths and line numbers.
2. Attempt to reproduce. Ask: "Can we reproduce this consistently?"
3. If multi-component: add diagnostic logging at component boundaries to trace data flow.

**CHECKPOINT**: Root cause identified?

- **YES** → proceed to Phase 3
- **NO** → return to Phase 2 (max 2 retries, then escalate to Circuit Breaker)

## Phase 3: Pattern Analysis

1. Find a working example of this pattern elsewhere in the codebase.
2. List the differences between the working example and the broken code.

## Phase 4: Hypothesis

1. Formulate: "I think X is broken because Y."
2. Perform a minimal test (hardcoded value, log print) to verify.

**CHECKPOINT**: Hypothesis verified by minimal test?

- **YES** → proceed to Phase 5
- **NO** → return to Phase 3 (max 2 retries, then escalate to Circuit Breaker)

## Phase 5: Implementation

> **Only proceed if Phase 4 passed.**

1. Implement the single fix.
2. Run `npm run verify`.
3. Run `/post-fix` workflow to record the lesson.

## Circuit Breaker

> If 3 fix attempts fail: **STOP**. Output:
> "ARCHITECTURAL ALERT: 3 fixes failed. We are treating symptoms, not the root cause. Recommendation: Discuss refactoring."

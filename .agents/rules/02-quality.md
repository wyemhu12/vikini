---
trigger: always_on
description: Mandatory pre-work, post-change checklist, workflow enforcement, and quality protocols.
---

# Quality Gates

## Pre-Work Protocol (MANDATORY)

Before writing any code, identify the task domain and read relevant documentation:

| Domain                    | Read first                                            | Workflow to follow     |
| ------------------------- | ----------------------------------------------------- | ---------------------- |
| Chat / Streaming          | docs/contracts.md, skills/streaming-patterns.md       |                        |
| Database / Schema         | docs/database-schema.md, skills/database-migration.md |                        |
| Auth / Security           | docs/security.md                                      |                        |
| UI Components             | rules/03-ui.md                                        |                        |
| Bug fixing                | docs/lessons-learned.md                               | **workflows/debug.md** |
| API routes                | skills/api-patterns.md                                |                        |
| Projects / Knowledge Base | docs/features.md (section 2.10), docs/contracts.md    |                        |
| Image Studio / Gallery    | docs/features.md (sections 2.5, 2.6)                  |                        |
| Voice / Audio             | docs/features.md (section 2.7)                        |                        |
| New feature overview      | docs/features.md, docs/architecture.md                |                        |
| Adding a new feature      | skills/add-feature.md                                 |                        |
| Code quality review       | rules/01-coding.md                                    | **workflows/audit.md** |
| Refactoring / File split  | rules/01-coding.md (§ File Size & Modularity)         |                        |

<important>
When a workflow is listed in the table above, you MUST read and follow it step-by-step.
Do NOT skip workflows. They are mandatory procedures, not optional references.
</important>

## Post-Change Checklist (MANDATORY)

Use the appropriate verification tier:

| Tier  | When                    | Command              | Purpose                                          |
| ----- | ----------------------- | -------------------- | ------------------------------------------------ |
| **1** | After each edit         | `npm run type-check` | Instant sanity check — catches type errors early |
| **2** | After completing a task | `npm run verify`     | Full quality gate (type-check + lint + tests)    |
| **3** | Before merge/deploy     | CI pipeline          | Independent verification in clean environment    |

<important>
Tier 1 after every edit. Tier 2 before declaring a task done. Never skip Tier 2.
If logic changed, add or update tests before running Tier 2.
</important>

After verification, also:

- Update `docs/CHANGELOG.md` with a summary of what changed
- Update related docs if any interface, API, models or schema changed

## After Fixing a Bug (MANDATORY Post-Fix Protocol)

<important>
After EVERY bug fix, you MUST execute ALL of the following steps in order.
This is not optional. Skipping any step is a quality violation.
Read `workflows/post-fix.md` for the full structured workflow.
</important>

1. **Verify** -- Run `npm run verify`
2. **Record the lesson** -- Add entry to `docs/lessons-learned.md`:
   - Symptom: What went wrong
   - Root Cause: Why it happened
   - Fix: What was changed
   - Prevention Rule: How to avoid this in the future
3. **Check for pattern promotion** -- If the same category of mistake appears 3+ times in lessons-learned, extract a formal rule into the appropriate `.agent/rules/` file
4. **Update CHANGELOG** -- Add the fix to `docs/CHANGELOG.md`
5. **Confirm** -- End with: `Lesson recorded in docs/lessons-learned.md: [one-line description]`

## Debugging Protocol (MANDATORY for complex/recurring bugs)

<important>
For any bug that is not trivially obvious, you MUST follow the debug workflow.
Read `workflows/debug.md` for the full structured workflow.
Do NOT propose fixes without a confirmed root cause.
</important>

1. **Preparation** -- Read `docs/lessons-learned.md` to check if the pattern was seen before
2. **Root Cause** -- Gather evidence first. No code changes until root cause is identified
3. **Pattern Analysis** -- Find a working example of the same pattern in the codebase
4. **Hypothesis** -- Formulate "X is broken because Y" and verify with a minimal test
5. **Implementation** -- Only fix after hypothesis is proven. Then run post-fix protocol above
6. **Circuit Breaker** -- If 3 fix attempts fail: STOP. Output: "ARCHITECTURAL ALERT: 3 fixes failed. Recommendation: Discuss refactoring."

## Bilingual Enforcement

See `rules/04-bilingual.md` for full requirements. In short: every new UI-facing text MUST use the translation system.

## Minimal Diffs Policy

- Change only what is necessary. No formatting noise.
- Follow the coding style of the file being edited.
- Do not reformat code where logic was not modified.

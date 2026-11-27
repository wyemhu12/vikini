---
trigger: glob
globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"
description: Adapted ASD-STE100 (STE-lite) writing rules for Vietnamese and English technical docs, plans, changelogs, and lessons learned.
---

# Technical Writing Style (STE-Lite — VI & EN)

## 1. Scope & Non-Goals

- Applies to `docs/*.md`, `docs/plans/*.md`, `docs/CHANGELOG.md`, and `docs/lessons-learned.md` in both Vietnamese and English.
- Adapted from ASD-STE100 Issue 9 for clarity and precision — NOT a 900-word English-only dictionary and NOT a rigid 20-word cap for Vietnamese sentences.
- Advisory quality guide: NEVER a `[BLOCKER]` in plan review or QA unless wording ambiguity causes concrete technical risk.

## 2. Procedural vs. Descriptive Rules

- **Procedural steps** (checklists `- [ ]`, runbooks, migration/verification steps):
  - Use numbered steps or `- [ ]` lists.
  - Start each step with one imperative verb (`Create`, `Update`, `Run` / `Tạo`, `Cập nhật`, `Chạy`).
  - Keep 1 action per step; place conditions before the action (`When X fails, run Y` / `Khi X lỗi, chạy Y`).
- **Descriptive prose** (goals, architecture explanations, root causes, risk descriptions):
  - Keep 1 main idea per sentence.
  - Use active voice and name the concrete technical actor (`code-freeze-guard.js blocks...`, `verify-plan.mjs validates...` instead of vague passive `the system is protected...`).

## 3. Lexical Consistency

- Use 1 canonical term per technical or domain concept across the entire document; do not rotate synonyms (`Code Freeze Guard`, `Plan Scope Guard`, `Independent Critic Pass`, `Fast-Track Mode`, `co-located test`, `Negative Probe`, `Wiring Probe`, `Server-Only`).
- When referencing user-facing UI labels, match the Fixed Bilingual UI Glossary in `.agents/rules/04-bilingual.md`.

## 4. Zero AI-Slop, Hedges & Fluff Metaphors

- Ban unbacked marketing adjectives, vague intensifiers, and decorative metaphors: `"mượt mà"`, `"mạnh mẽ"`, `"toàn diện"`, `"tối ưu hóa tối đa"`, `"đột phá"`, `"seamlessly"`, `"robust"`, `"comprehensive"`, `"crucial"`, `"leverage"`, `"delve"`, `"streamline"`.
- Replace subjective adjectives with verifiable metrics, bounds, or `[SRC]`/`[CMD]` facts (e.g., `"adds 408 LF chars"` instead of `"significantly leaner"`).

## 5. Untouchables (Never Rewrite)

- Preserve verbatim: fenced/inline code blocks, file paths, symbol and API identifiers, CLI commands, regexes, SQL/JSON/YAML schemas, exact error/log strings, governance tokens (`[PLAN_APPROVED]`, `[CHANGES_REQUESTED]`, `[AWAITING_CRITIC]`, `[BLOCKER]`, `[MAJOR]`, `[MINOR]`), and historical records in `docs/CHANGELOG.md`, `docs/lessons-learned.md`, and `docs/archive/`.

## 6. Document-Type Conventions

- **Plans (`docs/plans/*.md`)**: Name exact files, symbols, failure modes, and verifiable pass/fail checks.
- **Changelogs (`docs/CHANGELOG.md`)**: Lead every bullet with the concrete change verb + affected file/module.
- **Lessons Learned (`docs/lessons-learned.md`)**: Keep `Symptom`, `Root Cause`, `Fix`, and `Prevention Rule` factual and causal.

## 7. Reviewer Guidance (Anti-Nitpick Rule)

- `@reviewer` and `@qa` only flag writing-style findings when ambiguous actors, missing conditions, or conflicting terminology create real implementation or security risk.
- Never issue `[BLOCKER]` or `[MAJOR]` findings for word-count nitpicks, stylistic phrasing preferences, or Vietnamese sentence length.

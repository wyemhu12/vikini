---
trigger: always_on
description: Mandatory pre-work, post-change checklist, and enforcement protocols.
---

# Quality Gates

## Pre-Work Protocol (MANDATORY)

Before writing any code, identify the task domain and read relevant documentation:

| Domain                    | Read first                                            |
| ------------------------- | ----------------------------------------------------- |
| Chat / Streaming          | docs/contracts.md, skills/streaming-patterns.md       |
| Database / Schema         | docs/database-schema.md, skills/database-migration.md |
| Auth / Security           | docs/security.md                                      |
| UI Components             | rules/03-ui.md                                        |
| Bug fixing                | docs/lessons-learned.md                               |
| API routes                | skills/api-patterns.md                                |
| Projects / Knowledge Base | docs/features.md (section 2.10), docs/contracts.md    |
| Image Studio / Gallery    | docs/features.md (sections 2.5, 2.6)                  |
| Voice / Audio             | docs/features.md (section 2.7)                        |
| New feature overview      | docs/features.md, docs/architecture.md                |
| Adding a new feature      | skills/add-feature.md                                 |

## Post-Change Checklist (MANDATORY)

After every code change, verify ALL of the following:

- Run `npm run type-check` -- must pass
- Run `npm run lint` -- must pass
- Run `npm test` -- must pass. If logic changed, add or update tests.
- Update `docs/CHANGELOG.md` with a summary of what changed
- Update related docs if any interface, API, models or schema changed

## After Fixing a Bug (ADDITIONAL)

- Add entry to `docs/lessons-learned.md` with: symptom, root cause, fix, prevention rule
- Check if same mistake pattern has occurred 3 or more times -- if yes, promote to a formal rule
- Run the `/post-fix` workflow for structured recording

## Bilingual Enforcement

See `rules/04-bilingual.md` for full requirements. In short: every new UI-facing text MUST use the translation system.

## Minimal Diffs Policy

- Change only what is necessary. No formatting noise.
- Follow the coding style of the file being edited.
- Do not reformat code where logic was not modified.

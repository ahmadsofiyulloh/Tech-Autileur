# OpenClaude Playbook

This repository treats `AGENTS.md` as the canonical manifest. Use this file as the OpenClaude entrypoint, then follow the tracked repo docs.

Read first:

1. `AGENTS.md`
2. `docs/OPENCLAUDE_WORKFLOW.md`
3. `docs/01_README_START_HERE.md`
4. `docs/PRD_SOURCE_OF_TRUTH.md`
5. `docs/ARCHITECTURE_LOCK.md`
6. `docs/DATABASE_SCHEMA_LOCK.md`
7. `docs/DO_NOT_BUILD.md`
8. `docs/MICRO_TASK_BACKLOG.md`
9. The relevant stream-specific lock doc
10. `prompts/OPENCLAUDE_TASK_PROMPT_TEMPLATE.md`

Rules:

- Implement one micro-task at a time.
- Restate the goal, files likely to change, out of scope, and verification plan before editing.
- Do not widen scope, touch unrelated files, or override locked architecture.
- Follow the repo's source-of-truth docs over any CLI default behavior.
- Keep secrets server-only and database changes migration-first.
- Update `docs/CHANGELOG.md` for every code, schema, docs, workflow, or UI implementation. Use actual diffs/commits and do not invent changes.
- If the task is docs-only, skip runtime checks and say so explicitly.
- If the task is UI, route, shell, component, or CSS work, run the locked repo checks before handoff.
- Final handoff must include changed files, verification results, changelog entry, and residual risks.

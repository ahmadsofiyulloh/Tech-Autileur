# Codex Micro-Task Prompt Template

Copy this template into Codex for each micro-task.

```text
You are implementing one small MVP task for Banplex OS.

Read first:
- AGENTS.md
- docs/01_README_START_HERE.md
- docs/ARCHITECTURE_LOCK.md
- docs/DATABASE_SCHEMA_LOCK.md
- docs/DO_NOT_BUILD.md
- docs/MICRO_TASK_BACKLOG.md
- Any stream-specific lock doc relevant to this task.

Micro-task ID:
[example: S2-002]

Goal:
[clear one-sentence goal]

Include:
- [specific included work]

Exclude:
- [specific excluded work]

Constraints:
- Do not implement post-MVP features.
- Do not modify unrelated modules.
- Do not expose secrets to client code.
- Do not change locked architecture.
- If database changes are needed, migration-first and ask before applying with Supabase MCP.
- Add loading/error/empty states for UI work.
- Update `docs/CHANGELOG.md` with an actual dated entry based on the diff/commit.

Before coding, respond with:
1. Goal restatement.
2. Files likely to change.
3. Out-of-scope confirmation.
4. Verification plan.

After coding, run:
- npm run lint
- npm run typecheck
- npm run build

Then summarize:
- Changed files.
- What was implemented.
- Changelog entry updated.
- Verification results.
- Risks/follow-up.
```

# OpenClaude Task Prompt Template

Copy this template into OpenClaude for each micro-task.

```text
You are OpenClaude CLI implementing one small MVP task for Banplex OS.

Read first:
- AGENTS.md
- PLAYBOOK.md
- docs/OPENCLAUDE_WORKFLOW.md
- docs/01_README_START_HERE.md
- docs/PRD_SOURCE_OF_TRUTH.md
- docs/ARCHITECTURE_LOCK.md
- docs/DATABASE_SCHEMA_LOCK.md
- docs/DO_NOT_BUILD.md
- docs/MICRO_TASK_BACKLOG.md
- The relevant stream-specific lock doc for this task.

Micro-task ID:
[example: AI-MEDIA-BACKEND-002]

Goal:
[clear one-sentence goal]

Include:
- [specific included work]

Exclude:
- [specific excluded work]

Constraints:
- Implement one micro-task at a time.
- Do not modify unrelated modules.
- Do not expose secrets to client code.
- Do not change locked architecture.
- If database changes are needed, use migration-first and do not apply Supabase SQL unless the repo workflow explicitly approves it.
- Use the repo's locked semantic tokens and required loading, empty, and error states for UI work.
- Keep the diff small and reviewable.
- Update `docs/CHANGELOG.md` with an actual dated entry based on the diff/commit.

Before coding, respond with:
1. Goal restatement.
2. Files likely to change.
3. Out-of-scope confirmation.
4. Verification plan.
5. Potential risks or blockers.

After coding, run the checks that match the task:
- UI, route, shell, component, or CSS work:
  - npm run audit:colors
  - npm run audit:typography
  - npm run lint
  - npm run typecheck
  - npm run build
  - npm run smoke:e2e when practical
- Database work:
  - npm run lint
  - npm run typecheck
  - supabase db lint
- Docs-only work:
  - skip runtime verification
  - show the diff and explain why runtime checks were not needed

Then summarize:
- Changed files.
- What was implemented.
- Changelog entry updated.
- Verification results.
- Risks/follow-up.
```

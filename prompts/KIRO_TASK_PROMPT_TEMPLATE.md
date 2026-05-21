# Kiro Task Prompt Template

Copy this into Kiro for each micro-task.

```text
You are implementing one small MVP task for Affiliate AI Content OS.

Read first:
- AGENTS.md
- docs/01_README_START_HERE.md
- docs/ARCHITECTURE_LOCK.md
- docs/DATABASE_SCHEMA_LOCK.md
- docs/DO_NOT_BUILD.md
- docs/MICRO_TASK_BACKLOG.md
- the task-specific lock doc
- docs/KIRO_WORKFLOW.md
- any relevant repo skill docs

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
- Do not widen scope because Kiro can run tasks in parallel.
- Do not modify unrelated modules.
- Do not change locked architecture.
- Do not introduce raw secrets into client code, docs examples, or migrations.
- Database changes must be migration-first.
- Do not apply Supabase SQL with MCP unless the repo workflow explicitly approves it.
- Keep UI work on the locked semantic token system and preserve loading, empty, and error states.
- If a required doc conflicts with the task, stop and ask the user before coding.

Before coding, respond with:
1. Goal restatement.
2. Files likely to change.
3. Out-of-scope confirmation.
4. Verification plan.

After coding, run the relevant checks:
- npm run lint
- npm run typecheck
- npm run build
- supabase db lint (for schema tasks, if the CLI is available)

If the task is docs-only, skip runtime verification and show the diff instead.

Then summarize:
- Changed files.
- What was implemented.
- Verification results.
- Risks/follow-up.
```

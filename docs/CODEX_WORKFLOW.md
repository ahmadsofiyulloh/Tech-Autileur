# Codex Workflow Control

## Goal
Use Codex CLI as fast code implementer without letting the project drift.

## Pre-Task Checklist
Before each task, ask Codex to answer:

```text
Micro-task ID:
Goal:
Files likely to change:
Out of scope:
Verification commands:
Potential risk:
```

## Git Discipline
Recommended:

```bash
git checkout -b mvp/<micro-task-id>
git status
```

After implementation:

```bash
npm run lint
npm run typecheck
npm run build
git diff
```

Commit only after review:

```bash
git add .
git commit -m "feat: <task summary>"
```

## MCP Discipline
If using Supabase MCP, Codex must not immediately apply destructive changes. It should inspect, propose, ask approval, then apply.

## Task Size Rule
A micro-task should be small enough that the diff can be reviewed in under 10 minutes.

If a task touches more than 8–12 files, split it.

## Stop Conditions
Codex must stop if:

- A task requires a post-MVP feature.
- A secret is needed but not provided.
- Database change conflicts with schema lock.
- MCP project is ambiguous.
- External platform account setup is required.
- Build tool wants to delete/overwrite unrelated files.

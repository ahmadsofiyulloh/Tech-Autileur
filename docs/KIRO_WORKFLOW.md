# Kiro Workflow Control

## Goal
Use Kiro as a disciplined implementer in this repo without letting it drift past the locked MVP rules, task boundaries, or approval gates.

## What Kiro Is Here

Kiro can use specs, steering, hooks, MCP tools, and agentic chat. In this repo, those capabilities are subordinate to the tracked source-of-truth docs and the active micro-task.

Canonical guidance lives in tracked files:

- `AGENTS.md`
- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- task-specific lock docs
- `prompts/KIRO_TASK_PROMPT_TEMPLATE.md`

The local `.kiro/` directory is useful for workspace steering and specs, but it is ignored by git in this repo. Treat it as local helper context, not as the canonical place to store durable project policy.

## Required Operating Rules

- Implement one micro-task at a time.
- Do not widen scope because Kiro can parallelize tasks internally.
- Do not use spec task waves to split a single repo micro-task into multiple unrelated edits unless the backlog explicitly approved that split.
- Do not modify unrelated files, routes, components, or schema objects.
- Stop if a requested change conflicts with the locked docs.
- Stop if the task needs external approval, a secret, or a missing environment value.
- Prefer `rg` for repo search and read the existing implementation before editing.

## Preflight Contract

Before any edit, Kiro must state:

1. Micro-task ID.
2. Goal.
3. Files likely to change.
4. Out of scope.
5. Verification plan.
6. Potential risk.

If any of those are not known, Kiro should resolve them by inspecting the repo or by asking a focused question before writing code.

## Implementation Rules

- Database work must be migration-first.
- Do not apply Supabase SQL through MCP unless the repo workflow explicitly approves that step.
- Owner-owned tables must include `user_id`, RLS, and owner-only policies.
- Do not introduce raw secrets into client code, docs examples, seeds, or migrations.
- Do not store large asset bytes in Supabase.
- If a task touches UI, use the locked semantic token system and preserve loading, empty, and error states.
- Do not add new design systems, helper copy, or unapproved product concepts.
- Keep diffs small enough to review quickly.

## Verification Rules

- UI, route, shell, component, or CSS work should run the locked repo checks before handoff.
- Docs-only work can skip runtime verification, but the diff still needs to be shown and explained.
- If a check fails, report the exact command and the failure summary instead of retrying blindly.

## Handoff Rules

- Final output must list changed files, what changed, verification results, and known risks.
- If there is an unresolved conflict with another agent's work, stop and say so clearly.
- Do not claim completion until the task is actually implemented and verified as far as the task allows.

## Optional Workspace Steering

If you need extra local guidance in Kiro IDE or Kiro CLI, create workspace steering under `.kiro/steering/` and keep it aligned with the tracked docs above. If a steering note becomes durable project policy, mirror it into tracked docs so the repo still has a reviewable source of truth.

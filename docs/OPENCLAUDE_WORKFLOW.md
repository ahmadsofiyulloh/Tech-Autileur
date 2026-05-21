# OpenClaude Workflow Control

## Goal

Use OpenClaude as a disciplined implementer in this repo without letting it drift past the locked MVP rules, task boundaries, or approval gates.

## What OpenClaude Is Here

OpenClaude is a terminal coding agent with provider routing, tools, agents, MCP, slash commands, and streaming output. In this repo, those capabilities are subordinate to the tracked source-of-truth docs and the active micro-task.

Canonical guidance lives in tracked files:

- `AGENTS.md`
- `PLAYBOOK.md`
- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- task-specific lock docs
- `prompts/OPENCLAUDE_TASK_PROMPT_TEMPLATE.md`

The local `.openclaude/` directory and user-level `~/.openclaude.json` can help with provider routing and local preferences, but they are not canonical repo policy. If a durable rule matters to the repo, mirror it into tracked docs.

## Required Operating Rules

- Implement one micro-task at a time.
- Do not widen scope because OpenClaude can route or parallelize work.
- Do not split a single repo micro-task into unrelated edits unless the backlog explicitly approved that split.
- Do not modify unrelated files, routes, components, or schema objects.
- Stop if a requested change conflicts with the locked docs.
- Stop if the task needs external approval, a secret, or a missing environment value.
- Prefer `rg` for repo search and read the existing implementation before editing.

## Preflight Contract

Before any edit, OpenClaude must state:

1. Micro-task ID.
2. Goal.
3. Files likely to change.
4. Out of scope.
5. Verification plan.
6. Potential risk.

If any of those are not known, resolve them by inspecting the repo or asking a focused question before writing code.

## Implementation Rules

- Database work must be migration-first.
- Do not apply Supabase SQL through MCP unless the repo workflow explicitly approves that step.
- Owner-owned tables must include `user_id`, RLS, and owner-only policies.
- Do not introduce raw secrets into client code, docs examples, seeds, or migrations.
- Do not store large asset bytes in Supabase.
- If a task touches UI, use the locked semantic token system and preserve loading, empty, and error states.
- Do not add new design systems, helper copy, or unapproved product concepts.
- Keep diffs small enough to review quickly.
- Use concise, factual, task-focused responses. Do not pad with generic reassurance or unrelated analysis.

## OpenClaude Routing Notes

- Use `~/.openclaude.json` only for model routing and local credentials.
- Prefer a stronger model for planning, implementation, and review.
- Prefer a faster or cheaper model only for low-risk exploration.
- Model routing is a performance detail. It does not override repo rules.

## Verification Rules

- UI, route, shell, component, or CSS work should run the locked repo checks before handoff.
- Docs-only work can skip runtime verification, but the diff still needs to be shown and explained.
- If a check fails, report the exact command and the failure summary instead of retrying blindly.
- If Supabase CLI is unavailable, say so plainly.

## Handoff Rules

- Final output must list changed files, what changed, verification results, and known risks.
- If there is an unresolved conflict with another agent's work, stop and say so clearly.
- Do not claim completion until the task is actually implemented and verified as far as the task allows.

## Prompting Standard

Use `prompts/OPENCLAUDE_TASK_PROMPT_TEMPLATE.md` as the default task starter. If the task is shared with Kiro or Codex, keep the preflight shape aligned so all agents restate the same constraints before editing.

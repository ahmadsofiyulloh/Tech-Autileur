# 01 - Start Here Before Sprint

## Purpose
This folder is the implementation control pack for Codex CLI. It keeps the MVP small, locked, and fast to ship.

## Read Order
Read these docs in order:

1. `AGENTS.md`
2. `docs/PRD_SOURCE_OF_TRUTH.md`
3. `docs/ARCHITECTURE_LOCK.md`
4. `docs/DATABASE_SCHEMA_LOCK.md`
5. `docs/DO_NOT_BUILD.md`
6. `docs/PROMPT_PIPELINE_LOCK.md`
7. `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
8. `docs/GOOGLE_DRIVE_FILE_SYSTEM_LOCK.md`
9. `docs/MICRO_TASK_BACKLOG.md`
10. `docs/SUPABASE_MCP_RUNBOOK.md`
11. `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

## MVP Core
The MVP is not a generic affiliate planner. It is an AI production control center.

Core flow:

1. Dashboard entrypoint.
2. Products list.
3. Intake workflow in `/products/new`.
4. Prompt editor/generator step.
5. Controller execution workspace.
6. Output and history surfaces.
7. Settings hub for profiles, Gemini, Drive, and Flow tools.
8. Dashboard analytics.

## Sprint Rule
Do not start broad feature work. Start with a vertical slice:

```text
Dashboard
-> /products list
-> /products/new intake with upload cards and preview
-> prompt editor/generator
-> controller
-> output/history
```

## Human Owner Responsibilities
The user must provide real images/screenshots, workspace choices, affiliate profile details, Gemini keys, Supabase project access, Google Drive authorization, Flow execution, video review, final video edit, and manual upload.

Codex handles code implementation only.

# 01 — Start Here Before Sprint

## Purpose
This folder is the implementation control pack for Codex CLI. It exists to keep the MVP small, locked, and fast to ship.

## Read Order
Codex and the user should read documents in this order:

1. `AGENTS.md`
2. `docs/PRD_SOURCE_OF_TRUTH.md`
3. `docs/ARCHITECTURE_LOCK.md`
4. `docs/DATABASE_SCHEMA_LOCK.md`
5. `docs/DO_NOT_BUILD.md`
6. `docs/SUPABASE_MCP_RUNBOOK.md`
7. `docs/MICRO_TASK_BACKLOG.md`
8. `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

## MVP Core
The MVP is not a generic affiliate planner. It is an AI production control center.

Core features:

1. Multi Gemini Account Manager.
2. Centralized Google Drive File Manager.
3. Prompt Pipeline: product vision analysis → 4 i2i prompts → 2 i2v prompts.
4. Google Flow Batch Bridge.
5. Mobile Remote Control Layer.
6. Import Results.
7. Review Board.
8. Upload Package.

## Sprint Rule
Do not start broad feature work. Start with a vertical slice:

```text
Login
→ Gemini key metadata
→ Product source image link
→ Vision/prompt mock pipeline
→ C01/C02 clip jobs
→ Batch prompt export
```

## Human Owner Responsibilities
The user must provide real accounts, secrets, project IDs, OAuth approvals, Gemini keys, Supabase project access, Google Drive authorization, Flow execution, video review, final video edit, and manual upload.

Codex handles code implementation only.

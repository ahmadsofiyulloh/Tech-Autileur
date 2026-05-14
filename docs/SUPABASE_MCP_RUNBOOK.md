# Supabase MCP Runbook for Codex

## Purpose
The user normally uses Supabase MCP so Codex can create and modify the database directly in Supabase. This runbook keeps that safe and controlled.

## Project Targets

This repo must use project-scoped Supabase connections only.

```text
Dev project ref: czpjccljowyldtvycxlq
Production project ref: laychawloumnhvzgegmj
```

Do not use a generic global `mcp_servers.supabase` connection for this repo. The repo-local `.mcp.json` uses explicit server names:

- `supabase_dev` for dev inspection and approved dev migrations.
- `supabase_prod_readonly` for production inspection only.

If the current Codex client does not load `.mcp.json`, use the global fallback entries in the active `CODEX_HOME/config.toml` only when they are project-scoped with explicit names:

- `supabase_tech_autiluer_dev`.
- `supabase_tech_autiluer_prod_readonly`.

Keep any generic `[mcp_servers.supabase]` block disabled to avoid using another repo's project by accident.

Run this before any migration work:

```bash
npm run supabase:targets
```

The command validates the repo MCP targets, masked env project refs, CLI link cache, and global MCP collision risk without printing secrets.

## Locked Rule
Codex may use Supabase MCP for database work only after it has:

1. Read `DATABASE_SCHEMA_LOCK.md`.
2. Inspected the existing Supabase project state.
3. Proposed the SQL or migration plan.
4. Received user approval to apply.
5. Documented what changed.

## Recommended MCP Workflow

### Step 1 — Inspect
Codex should first inspect:

- existing tables
- existing enums
- existing RLS policies
- existing indexes
- existing functions/triggers
- migration history if available

### Step 2 — Plan
Before applying changes, Codex must output:

```text
Migration name:
Tables affected:
Enums affected:
RLS policies affected:
Indexes affected:
Destructive changes: yes/no
Rollback strategy:
```

### Step 3 — Apply
If user approves, Codex can apply via Supabase MCP.

### Step 4 — Verify
After apply, Codex must verify:

- tables exist
- RLS is enabled
- policies exist
- FK relationships are correct
- indexes exist
- no destructive change happened accidentally

### Step 5 — Document
Codex must update:

- `docs/DATABASE_SCHEMA_LOCK.md` if schema changed
- local migration file if the repo tracks migrations
- task result summary

## Direct Database Apply Guardrails
Allowed:

- creating tables
- creating enums
- creating indexes
- creating RLS policies
- creating timestamp triggers
- creating non-destructive additive columns

Requires explicit user confirmation:

- dropping tables
- dropping columns
- changing column types
- disabling RLS
- deleting policies
- mass deleting data
- modifying production data

Forbidden unless user explicitly overrides:

- storing real API keys in plaintext
- exposing service role key to client code
- creating public access policies for owner-owned data
- using Supabase Storage for large video/image assets in MVP

## MCP Configuration Reminder
Codex can store MCP configuration globally or per project. For this repo, prefer the repo-local `.mcp.json` so the connection is scoped to this project and not mixed with other projects. Do not write real MCP tokens into repo files.

Use placeholders only in repo docs.

## CLI Fallback

Use CLI only as a fallback when MCP is not available.

Rules:

- Use `npx supabase`, not an assumed global binary.
- Verify the target first with `npm run supabase:targets`.
- Set `SUPABASE_DB_PASSWORD` only in the current shell/session when needed.
- Prefer explicit target commands such as `--db-url` when switching between dev and production.
- Never run `db push` against production unless the current target has been verified and the exact migration SQL has already passed on dev.

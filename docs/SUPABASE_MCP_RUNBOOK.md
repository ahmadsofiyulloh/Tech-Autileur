# Supabase MCP Runbook for Codex

## Purpose
The user normally uses Supabase MCP so Codex can create and modify the database directly in Supabase. This runbook keeps that safe and controlled.

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
Codex stores MCP configuration in `config.toml`. The user may configure Supabase MCP globally or per project. Do not write real MCP tokens into repo files.

Use placeholders only in repo docs.

# Codex Prompt — Supabase MCP Database Task

```text
You are working on Supabase database setup for Banplex OS.

Read first:
- AGENTS.md
- docs/DATABASE_SCHEMA_LOCK.md
- docs/SUPABASE_MCP_RUNBOOK.md
- docs/SECURITY_AND_SECRETS.md

Task:
Use Supabase MCP to inspect the current database and prepare the MVP schema.

Important:
- Do not apply destructive changes.
- Do not store real secrets.
- Do not disable RLS.
- Do not create public owner-data policies.
- Do not apply SQL until you show the migration plan and I approve.

First response must include:
1. Supabase project detected.
2. Existing enums/tables/policies summary.
3. Proposed migration name.
4. Tables/enums/indexes/policies to create.
5. Destructive changes: yes/no.
6. Exact SQL or migration outline.
7. Approval request before applying.

After approval:
- Apply via Supabase MCP.
- Verify tables, indexes, and RLS policies.
- Summarize final database state.
```

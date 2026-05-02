# 001 Init Schema — SQL Draft for Supabase MCP

This is a planning document, not the final executed migration. Codex should convert this into a real SQL migration or apply through Supabase MCP after user approval.

## MCP Instruction
Before applying:

1. Inspect current DB.
2. Confirm these enums/tables do not already exist.
3. Propose final SQL.
4. Ask user approval.
5. Apply via Supabase MCP.
6. Verify schema and RLS.

## SQL Scope
Create MVP enums, owner-owned tables, indexes, RLS policies, and timestamp trigger based on `docs/DATABASE_SCHEMA_LOCK.md`.

Do not store real credentials or seed real API keys.

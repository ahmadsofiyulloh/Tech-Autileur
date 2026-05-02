# AGENTS.md - Affiliate AI Content OS

## Mission
Build the MVP only: a single-owner Next.js PWA control center for AI affiliate content production using Supabase metadata, Google Drive assets, Gemini prompt generation, Google Flow batch bridge, and a mobile control layer.

## Required Source of Truth
Before any implementation task, read these documents:

1. `docs/01_README_START_HERE.md`
2. `docs/PRD_SOURCE_OF_TRUTH.md`
3. `docs/ARCHITECTURE_LOCK.md`
4. `docs/DATABASE_SCHEMA_LOCK.md`
5. `docs/DO_NOT_BUILD.md`
6. `docs/MICRO_TASK_BACKLOG.md`
7. `docs/PROMPT_PIPELINE_LOCK.md`
8. `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
9. The stream-specific lock doc for the task being implemented.

If a task conflicts with these docs, stop and ask the user before coding.

## Locked Architecture
- Frontend: Next.js PWA, TypeScript strict.
- Auth: Supabase Auth.
- Database: Supabase Postgres.
- Metadata source of truth: Supabase.
- Asset/file source of truth: Google Drive.
- Large assets must not be stored in Supabase Storage for MVP.
- User model: single owner/operator only.
- RLS must be enabled on all owner-owned tables.
- All owner-owned tables must include `user_id uuid references auth.users(id)` unless explicitly documented as a static reference table.

## Implementation Rules
- Implement one micro-task at a time.
- Do not invent features outside MVP.
- Do not build post-MVP items.
- Do not change locked architecture without explicit approval.
- Do not modify unrelated modules.
- Do not add dependencies unless necessary and justified.
- Use server-only code for secrets and external API calls.
- Never expose Gemini keys, Supabase service role key, Google OAuth secrets, refresh tokens, or encryption secrets to client components.
- Never commit `.env`, `.env.local`, or real secrets.
- Database changes must be migration-first.
- When using Supabase MCP, inspect first, then propose SQL, then apply only after approval.
- Every UI must include loading, empty, and error states.
- Every mutation must validate input.
- Prefer structured JSON schemas for AI outputs.
- Prefer mock mode before live API integration.

## Standard Work Loop
For every task:

1. Restate the micro-task ID and goal.
2. List files likely to change.
3. State what is out of scope.
4. Implement only that micro-task.
5. Run verification commands.
6. Show changed files.
7. Summarize result, risks, and follow-up.

## Verification Commands
Run when applicable:

```bash
npm run lint
npm run typecheck
npm run build
```

For database work:

```bash
supabase db lint
supabase db diff
```

If Supabase MCP is available, use MCP to inspect/apply only after approval.

## Definition of Done
A micro-task is done only when:

- It satisfies the task acceptance criteria.
- TypeScript compiles.
- Lint/build pass or failures are documented honestly.
- No unrelated scope was added.
- No secrets were committed.
- Database changes are reflected in migration files or MCP-applied SQL with documentation.
- The final response includes changed files and verification results.

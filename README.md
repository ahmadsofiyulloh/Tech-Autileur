# Affiliate AI Content OS

Private single-owner Next.js PWA control center for AI affiliate content production.

## Start Here

1. Read `AGENTS.md`.
2. Read `docs/01_README_START_HERE.md`.
3. Read `docs/PRD_SOURCE_OF_TRUTH.md`.
4. Read `docs/ARCHITECTURE_LOCK.md`.
5. Read `docs/DATABASE_SCHEMA_LOCK.md`.
6. Read `docs/DO_NOT_BUILD.md`.
7. Use `docs/MICRO_TASK_BACKLOG.md` for micro-task tracking.
8. Use `docs/SUPABASE_MCP_RUNBOOK.md` before any database change.

## Local Setup

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Fill the environment values before starting the app.

## Environment Variables

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- App security: `APP_ENCRYPTION_KEY`
- Google Drive OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`
- Runtime flags: `MOCK_MODE`, `NEXT_PUBLIC_APP_URL`

Keep `.env.local` out of git and store real secrets only in your local environment or deployment platform.

## Folder Structure

- `src/` - Next.js routes, UI, server helpers, and validation
- `supabase/` - database migrations and schema changes
- `docs/` - source-of-truth locks, backlog, runbooks, and changelog
- `prompts/` - Codex task templates and prompt helpers
- `public/` - manifest, screenshots, and static assets
- `tests/` - Playwright smoke and E2E coverage
- `scripts/` - audit and maintenance scripts
- `AGENTS.md` - workspace rules and implementation guardrails
- `.env.example` - environment template

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:e2e`
- `npm run smoke:e2e:live-loop`
- `npm run smoke:e2e:headed`
- `npm run smoke:e2e:report`
- `npm run audit:colors`
- `npm run audit:typography`

## Deployment

### Vercel

1. Import the Git repository into Vercel.
2. Keep the default Next.js build settings, which use `npm run build`.
3. Set the required environment variables in Vercel for Production, Preview, and Development.
4. Deploy the branch and verify the preview URL before merging.
5. No `vercel.json` is required for the current app shape.

Required variables on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`
- `NEXT_PUBLIC_APP_URL`

Optional:

- `MOCK_MODE` for local development only.

Keep Supabase service role keys, Google secrets, and encryption keys server-side only.
Review `docs/SUPABASE_MCP_RUNBOOK.md` before any schema work.

### Self-hosting

- Run `npm run build` before release.
- Start production with `npm run start` or the host equivalent.

## Changelog

See `docs/CHANGELOG.md` for repo-level maintenance notes.

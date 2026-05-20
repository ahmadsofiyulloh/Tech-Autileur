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
- New or edited UI must use shared semantic design tokens for typography and color; do not introduce hardcoded font sizes, weights, line-heights, hex values, RGB values, or ad hoc palette literals in component code.
- If a new visual need does not have a token yet, add or extend the token layer first, then consume the token in UI code.
- Use server-only code for secrets and external API calls.
- Never expose Gemini keys, Supabase service role key, Google OAuth secrets, refresh tokens, or encryption secrets to client components.
- Never commit `.env`, `.env.local`, or real secrets.
- Database changes must be migration-first.
- When using Supabase MCP, inspect first, then propose SQL, then apply only after approval.
- Every UI must include loading, empty, and error states.
- Every mutation must validate input.
- Prefer structured JSON schemas for AI outputs.
- Prefer mock mode before live API integration.

## Agent Roles
- `AGENTS.md` is the universal manifest for Codex CLI and OpenClaude CLI. Do not create or rely on `CLAUDE.md`.
- Codex CLI owns planning, repository audits, documentation updates, task decomposition, diff review, and final acceptance notes unless the user explicitly asks it to implement.
- OpenClaude CLI owns implementation execution for approved micro-tasks and must follow this manifest exactly.
- Both agents must read the required source-of-truth docs before implementation work and stop if a requested change conflicts with them.
- Both agents must keep work scoped to the active micro-task and document any blocker instead of expanding scope.

## UI/UX Redesign Source of Truth
- UI/UX redesign work must preserve `docs/PRD_SOURCE_OF_TRUTH.md`, `docs/ARCHITECTURE_LOCK.md`, `docs/MOBILE_REMOTE_CONTROL_LOCK.md`, and the relevant UI lock or audit document for the task.
- The redesign target is an operator dashboard, not a marketing site: neutral, clean, border-driven, compact, responsive, data-first, action-first, and professional.
- Mobile remains first-class for 360-767px, tablet for 768-1023px, desktop for 1024-1279px, and wide desktop for 1280px+.
- Desktop layouts must not be enlarged mobile layouts. Use denser lists, split panes, right drawers, and compact metrics where the PRD allows them.
- New or edited UI must use shared semantic design tokens for color and typography. If a value is missing, extend the token layer first.
- Do not add verbose helper copy, marketing copy, decorative filler, fake stats, arbitrary badges, or new workflow concepts during visual refactors.

## Single Working Tree Rules
- Codex CLI and OpenClaude CLI operate in the same local working tree.
- Before editing, check current git status for the files in scope and treat unknown changes as user or other-agent work.
- Do not overwrite, revert, reset, delete, or reformat changes made by another agent unless the user explicitly requests it.
- Do not run destructive git commands such as `git reset --hard`, `git checkout --`, or bulk deletion commands for agent handoff cleanup.
- Avoid simultaneous edits to the same files. If a file is already being changed by another agent, pause and hand off the conflict clearly.
- Keep each branch or working session focused on one micro-task. Commit boundaries, if requested, must match the micro-task.

## Locked Phase 1 UI Rules
- The Phase 1 entrypoint is `/products/new`.
- Route lock:
  - `/` redirects to `/products/new`.
  - `/products` is the Produk list.
  - `/products/new` is the mobile-first Intake workflow.
  - `/products/[id]` is product detail with Metadata, Output, and History.
  - `/prompts` is the Paket Prompt list or launcher.
  - `/prompts/[id]` is the prompt detail/editor output surface.
  - `/prompts/[id]/history` is prompt generation history.
  - `/drive` is the visual Drive manager.
  - `/dashboard` is secondary analytics.
  - `/settings` is the Pengaturan hub.
  - `/controller` and `/flow` redirect to `/products/new` while frozen.
- Workflow navigation labels are exactly `Intake`, `Produk`, `Prompt`, and `Drive`.
- Mobile bottom navigation labels are exactly `Dashboard`, `Intake`, `Produk`, `Prompt`, and `Drive`.
- `Flow Control` and `Controller` must not appear in Phase 1 workflow navigation.
- The topbar has two distinct global controls: Notifications and Profile avatar menu. The Profile avatar opens profile overview and includes `Pengaturan` and `Sign out` menu actions. `/settings` must not show a duplicate standalone Settings gear/action.
- Do not add a workspace picker, Controller/Flow primary UI, mobile Flow queue, dense mobile tables, or full edit forms inside Drive preview sheets.
- UI language is concise Indonesian operational copy. Every active UI surface must include loading, empty, and error states.

## UI Verification Commands
- For UI, route, shell, component, or CSS changes, run:
  ```bash
  npm run audit:colors
  npm run audit:typography
  npm run lint
  npm run typecheck
  npm run build
  ```
- For route behavior, responsive shell, or critical workflow changes, also run the relevant Playwright smoke test when practical:
  ```bash
  npm run smoke:e2e
  ```
- UI handoff should include screenshots or screenshot notes for 360px, 768px, 1024px, and 1280px widths when the changed surface is visual.
- Docs-only changes may skip app verification, but the agent must still show the relevant diff and state that no runtime verification was required.

## Agent Handoff
- Every handoff must include the micro-task ID or task name, goal, files changed, source-of-truth docs read, validation commands with results, and known risks.
- Implementation handoff from OpenClaude CLI must include `git diff --stat` and the focused diff for changed files.
- Review handoff from Codex CLI must prioritize correctness, PRD compliance, regressions, missing states, token violations, and verification gaps.
- If verification fails, record the exact command, failure summary, and whether the failure is related to the current task.
- Do not mark a task done until the acceptance criteria, validation status, changed files, and follow-up risks are documented.

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

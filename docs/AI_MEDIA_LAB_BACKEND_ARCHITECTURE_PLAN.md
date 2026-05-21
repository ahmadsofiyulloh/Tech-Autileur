# AI Media Lab Backend Architecture Plan

**Micro-task:** AI-MEDIA-BACKEND-DOC-001
**Status:** Active docs-only backend architecture/backlog lock
**Date:** 2026-05-21
**Scope:** Backend architecture plan for the six AI Media Lab pages plus Magnific settings.

No runtime code was changed by this document. No SQL should be applied from this document without explicit user approval.

## Source Of Truth

This plan extends, but does not override, these documents:

- `AGENTS.md`
- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- `docs/AI_MEDIA_LAB_PRD.md`
- `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md`
- `docs/AI_MEDIA_LAB_BACKEND_SCHEMA_PROPOSAL.md`
- `docs/SECURITY_AND_SECRETS.md`

## Backend Goal

Add the backend in small approved micro-tasks after the frontend dummy AI Media Lab surfaces are accepted. The backend must support:

- Magnific provider key metadata and encrypted key storage.
- Durable task metadata for Motion Control, Image to Video, and Upscaler.
- History and usage projections derived from task and key metadata.
- Google Drive references for input and output files.
- Server-only Magnific API usage after mock DB wiring is complete.

Large image or video bytes remain in Google Drive. Supabase stores metadata and references only.

## Page To Backend Map

### `/tools/ai-media`

Backend responsibilities:

- Show provider readiness from `external_api_keys`.
- Show tool readiness from available active keys and recent task state.
- Show lightweight usage summary derived from `external_generation_tasks` and `external_api_keys`.
- Link to tool pages, history, usage, and `/settings/magnific`.

No live provider call belongs on the overview page.

### `/tools/ai-media/motion-control`

Backend responsibilities:

- Create `external_generation_tasks` rows with `tool_type = 'MOTION_CONTROL'`.
- Store source image Drive reference in `source_image_drive_item_ref_id`.
- Store source motion/video Drive reference in `source_motion_drive_item_ref_id`.
- Store prompt and provider settings in `input_json`.
- Store provider response metadata in `output_json`.
- Store task log timeline in `log_json` for MVP.
- Store final output Drive reference in `output_drive_item_ref_id` only after Drive output wiring exists.

The database must not store source or generated file bytes.

### `/tools/ai-media/image-to-video`

Backend responsibilities:

- Create `external_generation_tasks` rows with `tool_type = 'IMAGE_TO_VIDEO'`.
- Store source image Drive reference in `source_image_drive_item_ref_id`.
- Store prompt and provider settings in `input_json`.
- Reuse the same status, log, retry, and output metadata contract as Motion Control.

### `/tools/ai-media/upscaler`

Backend responsibilities:

- Create `external_generation_tasks` rows with `tool_type = 'UPSCALER'`.
- Store source image Drive reference in `source_image_drive_item_ref_id`.
- Store upscale settings in `input_json`.
- Reuse the same status, log, retry, and output metadata contract as the other tools.

### `/tools/ai-media/history`

Backend responsibilities:

- Read paginated `external_generation_tasks` rows for the authenticated owner.
- Filter by tool type, status, and created date when requested.
- Search only metadata fields that are safe for display.
- Show task details from task metadata, `input_json`, `output_json`, and `log_json`.

History must not expose raw API keys, encrypted secrets, signed URL secrets, or copied large payloads.

### `/tools/ai-media/usage`

Backend responsibilities:

- Derive usage from `external_generation_tasks` and `external_api_keys` for MVP.
- Show request counts, success/failure counts, waiting-for-key state, cooldown state, and recent provider health.
- Avoid showing cost until reliable provider pricing and usage units are confirmed.

`external_usage_events` is deferred until real provider usage tracking needs a separate append-only ledger.

### `/settings/magnific`

Backend responsibilities:

- Store provider key metadata in `external_api_keys`.
- Store raw key material only through server-only code.
- Encrypt key material before writing `external_api_key_secrets.encrypted_api_key`.
- Never return raw key material to client components.
- Support key test status through metadata fields such as `last_tested_at`, `last_error_message`, and `status`.

The settings form can show labels, status, and timestamps only. It must not show the raw key after save.

## Backend Decision Locks

- AI Media provider work uses `external_generation_tasks`, not `ai_tasks`.
- `ai_tasks` remains for the existing AI job queue and prompt/Gemini workflow unless a separate lock changes that.
- Provider is constrained to `magnific` for the MVP migration.
- Statuses reuse `public.account_status` for key health and `public.ai_task_status` for generation task state.
- `WAITING_FOR_KEY` is a task status, not a key status.
- Client components must not read `external_api_key_secrets`.
- Server actions or route handlers must validate the authenticated user before service role reads or writes.
- Metadata tables may have owner-only RLS, but frontend wiring should still prefer server-side access for provider operations.
- `log_json` is the MVP log mechanism. `external_generation_logs` is deferred.
- Usage is derived for MVP. `external_usage_events` is deferred.
- Google Drive is the source of truth for asset bytes.
- Supabase must store Drive item references, not base64, binary bytes, provider file payloads, or signed URL secrets.
- Usage day reset should use `profiles.timezone` when available, with `Asia/Jakarta` as fallback.
- Live Magnific calls can start only after encrypted key storage, mock DB task wiring, and history/usage DB projections are complete.

## Data Contracts To Lock Before Code

These names are the expected server contract shape for later implementation tasks. They are not implemented by this docs-only task.

```text
AiMediaProviderProjection
AiMediaKeyMetadataProjection
AiMediaGenerationTaskProjection
AiMediaHistoryListProjection
AiMediaUsageSnapshot
AiMediaCreateTaskInput
```

Minimum contract expectations:

- Projections include `user_id` only on the server side when needed for authorization.
- Client-facing projections do not include raw keys, encrypted keys, service role details, or internal encryption metadata.
- Task projections expose safe status, timestamps, tool type, Drive metadata references, and display-safe log entries.
- Create inputs validate tool type, prompt/settings shape, and required Drive references before inserting a task.

## Future Module Boundaries

Later implementation tasks should prefer these server boundaries:

```text
src/lib/server/ai-media/keys.ts
src/lib/server/ai-media/tasks.ts
src/lib/server/ai-media/usage.ts
src/lib/server/ai-media/magnific-client.ts
src/app/settings/magnific/actions.ts
src/app/tools/ai-media/actions.ts
```

Notes:

- `keys.ts` owns provider metadata, encryption handoff, eligibility, cooldown, and status updates.
- `tasks.ts` owns task creation, status transitions, retry metadata, and safe history/detail reads.
- `usage.ts` owns derived usage snapshots for overview and usage pages.
- `magnific-client.ts` is deferred until live provider integration is explicitly approved.
- Route handlers may be used where polling or background-compatible API boundaries are clearer than server actions.

## Active Backend Micro-Task Sequence

### AI-MEDIA-BACKEND-DOC-001 - Backend architecture/backlog lock

Document the six-page backend plan, decisions to lock, and implementation sequence. Docs only.

### AI-MEDIA-BACKEND-002-CHECK - Migration audit and local lint

Audit `supabase/migrations/20260521000001_ai_media_external_backend_schema.sql` against `docs/AI_MEDIA_LAB_BACKEND_SCHEMA_PROPOSAL.md`.

Acceptance:

- Confirm tables, `user_id`, RLS, owner policies, secret access restrictions, indexes, and updated_at triggers.
- Run `supabase db lint` if the CLI is available.
- Do not apply SQL to any database without explicit approval.

### AI-MEDIA-BACKEND-003 - Server contracts and safe projections

Add TypeScript contracts and server-only projection helpers for provider status, key metadata, tasks, history, and usage.

Acceptance:

- No UI redesign.
- No live provider calls.
- No raw API key exposure.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass or failures are documented.

### AI-MEDIA-BACKEND-004 - Magnific settings key storage

Wire `/settings/magnific` to server-only key create/update/test metadata flow using encrypted storage.

Acceptance:

- Raw API keys are accepted only by server code.
- Raw API keys are encrypted before database write.
- Client never receives raw or encrypted key values.
- Test connection may remain mock unless live test is explicitly approved.

### AI-MEDIA-BACKEND-005 - Mock DB task wiring for three tools

Wire Motion Control, Image to Video, and Upscaler forms to create mock `external_generation_tasks` rows.

Acceptance:

- Uses real DB task rows with mock provider output.
- No Magnific API call.
- Required Drive references are validated.
- Task status and logs follow the schema proposal.

### AI-MEDIA-BACKEND-006 - Overview, history, and usage DB projections

Replace dummy overview, history, and usage data with server-derived projections.

Acceptance:

- Overview, history, and usage use owner-scoped server reads.
- Pagination is used for history.
- Usage remains derived from tasks and key metadata.
- Cost remains hidden unless pricing is reliable.

### AI-MEDIA-BACKEND-007 - Live Magnific client and rotator

Implement server-only live Magnific submit/poll/test flow after mock wiring is accepted.

Acceptance:

- Provider calls happen only in server-only code.
- Key selection follows the rotator rules in the schema proposal.
- Retryable and non-retryable errors update task/key state correctly.
- No client exposure of secrets or provider credentials.

### AI-MEDIA-BACKEND-008 - Google Drive output wiring

Store provider outputs in Google Drive and connect generated metadata back to `drive_items`.

Acceptance:

- Supabase stores only Drive references and metadata.
- `output_drive_item_ref_id` is filled after upload.
- No Supabase Storage for large assets.
- No provider bytes are copied into JSON columns.

## Agent Responsibilities

Codex CLI:

- Owns audit, planning, prompt engineering, documentation updates, and final acceptance review unless explicitly asked to implement.
- Reviews OpenClaude output for PRD compliance, security, RLS, token/UI constraints, and verification gaps.

OpenClaude CLI:

- Owns implementation execution for approved micro-tasks.
- Must read `AGENTS.md`, `PLAYBOOK.md`, `docs/OPENCLAUDE_WORKFLOW.md`, this plan, and the relevant task docs before edits.
- Must state micro-task ID, goal, files likely to change, out of scope, verification plan, and risk before editing.

## Verification Rules

Docs-only tasks:

- Show changed files and focused diff/stat.
- State that runtime verification is not required.

Code tasks:

```bash
npm run lint
npm run typecheck
npm run build
```

UI tasks:

```bash
npm run audit:colors
npm run audit:typography
npm run lint
npm run typecheck
npm run build
```

Database tasks:

```bash
supabase db lint
supabase db diff
```

If Supabase CLI is unavailable, document that honestly. Supabase MCP must inspect first, propose SQL, and apply only after explicit approval.

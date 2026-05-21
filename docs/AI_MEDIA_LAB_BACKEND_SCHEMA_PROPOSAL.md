# AI Media Lab Backend Schema Proposal

**Micro-task:** AI-MEDIA-BACKEND-001 (schema proposal), AI-MEDIA-BACKEND-002 (approved migration baseline)
**Status:** Approved active backend schema/backlog baseline
**Date:** 2026-05-21
**Scope:** Backend schema design for AI Media Lab provider keys, secrets, and generation task metadata.

This document is now the active AI Media Lab backend schema/backlog decision doc. The approved migration baseline is `supabase/migrations/20260521000001_ai_media_external_backend_schema.sql`. SQL must still not be applied to any database without explicit user approval.

## Source Docs Read

- `AGENTS.md`
- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/AI_MEDIA_LAB_PRD.md`
- `docs/AI_MEDIA_LAB_FRONTEND_AUDIT.md`
- `docs/AI_MEDIA_LAB_BACKEND_ARCHITECTURE_PLAN.md`
- `docs/GEMINI_KEY_ROUTING_LOCK.md`
- `docs/SECURITY_AND_SECRETS.md`
- `prompts/CODEX_TASK_PROMPT_TEMPLATE.md`

## Active Backend Backlog Lock

This document is the active stream backlog for AI Media Lab backend schema decisions. `docs/MICRO_TASK_BACKLOG.md` remains global phase/backlog context, but this file and `docs/AI_MEDIA_LAB_BACKEND_ARCHITECTURE_PLAN.md` define the detailed AI Media backend sequence.

Current backend sequence:

```text
AI-MEDIA-BACKEND-DOC-001 - Backend architecture/backlog lock
AI-MEDIA-BACKEND-002-CHECK - Migration audit and local lint
AI-MEDIA-BACKEND-003 - Server contracts and safe projections
AI-MEDIA-BACKEND-004 - Magnific settings key storage
AI-MEDIA-BACKEND-005 - Mock DB task wiring for three tools
AI-MEDIA-BACKEND-006 - Overview, history, and usage DB projections
AI-MEDIA-BACKEND-007 - Live Magnific client and rotator
AI-MEDIA-BACKEND-008 - Google Drive output wiring
```

`AI-MEDIA-BACKEND-002` is already represented by the approved migration file baseline. The next implementation pass should audit and lint that migration before any database apply.

## Lock Compatibility Check

No blocking conflict was found with `docs/DATABASE_SCHEMA_LOCK.md` if the proposal follows these constraints:

- Every proposed table is owner-owned and includes `user_id uuid references auth.users(id) on delete cascade`.
- RLS is enabled on every proposed table.
- `workspace_id` is not proposed for AI Media Lab tables because the database lock only allows it on explicitly listed product-flow tables.
- Large image or video bytes are not stored in Supabase. Supabase stores only provider metadata, task state, JSON payloads, logs, usage counters, and Google Drive metadata references.
- Secret values are stored only as encrypted server-only values.
- `external_api_keys.status` should reuse the existing `account_status` values: `ACTIVE`, `RATE_LIMITED`, `COOLDOWN`, `ERROR`, and `DISABLED`.
- `WAITING_FOR_KEY` should not be added to key status because it is already an `ai_task_status` concept. It belongs on `external_generation_tasks.status` and derived UI readiness.

## Design Summary

AI Media Lab should use a generic external-provider schema, initially constrained to Magnific:

```text
external_api_keys
external_api_key_secrets
external_generation_tasks
```

Optional later tables:

```text
external_generation_logs
external_usage_events
```

This keeps the Magnific backend compatible with the Gemini key rotator pattern without mixing Magnific secrets into Gemini-specific tables.

## Status Values

### Key Status

Use existing `public.account_status`:

```text
ACTIVE
RATE_LIMITED
COOLDOWN
ERROR
DISABLED
```

Meaning:

- `ACTIVE`: key is eligible if `cooldown_until` is null or in the past.
- `RATE_LIMITED`: provider returned a rate limit response; key is skipped until reset or cooldown handling clears it.
- `COOLDOWN`: key is temporarily skipped while `cooldown_until` is in the future.
- `ERROR`: key has a provider or validation error that needs retry or operator attention.
- `DISABLED`: key is stored but never selected.

### Task Status

Use existing `public.ai_task_status`:

```text
QUEUED
RUNNING
SUCCESS
FAILED
RETRYING
WAITING_FOR_KEY
CANCELLED
```

`WAITING_FOR_KEY` means no eligible external key exists after filtering out disabled, errored, rate-limited, or cooling-down keys.

### Tool Types

Propose a new enum or equivalent text check for AI Media Lab tools:

```text
MOTION_CONTROL
IMAGE_TO_VIDEO
UPSCALER
```

Recommended migration enum name after approval:

```sql
external_generation_tool_type
```

## Table Proposal: `external_api_keys`

Metadata for external provider API keys. Raw secrets are not stored here.

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
provider text not null default 'magnific'
key_code text not null
label text not null
status public.account_status not null default 'DISABLED'
provider_account_label text nullable
project_label text nullable
model_name text nullable
purpose text nullable
rpm_limit int nullable
rpd_limit int nullable
tpm_limit int nullable
requests_today int not null default 0
last_used_at timestamptz nullable
cooldown_until timestamptz nullable
last_tested_at timestamptz nullable
last_error_message text nullable
metadata_json jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
unique (id, user_id)
unique (user_id, provider, key_code)
check provider in ('magnific') for the first MVP migration
check btrim(label) <> ''
check requests_today >= 0
check rpm_limit is null or rpm_limit >= 0
check rpd_limit is null or rpd_limit >= 0
check tpm_limit is null or tpm_limit >= 0
```

### `/settings/magnific` Field Defaults

The UI exposes only:

```text
Nama key
API key
Tes koneksi
Simpan
Status
Terakhir dites
```

Internal fields not shown in the UI should be set as:

```text
provider = 'magnific'
key_code = generated server-side
status = 'DISABLED' until server-side validation/test marks it ACTIVE
provider_account_label = null
project_label = null
model_name = null
purpose = null
rpm_limit = null
rpd_limit = null
tpm_limit = null
requests_today = 0
last_used_at = null
cooldown_until = null
last_tested_at = null until Tes koneksi runs
last_error_message = null until test/use fails
metadata_json = {}
```

## Table Proposal: `external_api_key_secrets`

Encrypted server-only secret store for provider API keys.

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
external_api_key_id uuid not null
encrypted_api_key text not null
key_fingerprint text nullable
encryption_version text not null default 'v1'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
unique (external_api_key_id)
foreign key (external_api_key_id, user_id)
  references external_api_keys(id, user_id)
  on delete cascade
check btrim(encrypted_api_key) <> ''
```

Security rules:

- Raw API keys are accepted only by server actions or route handlers.
- Raw API keys are never returned to client components.
- Raw API keys are never logged.
- Encryption uses the app-level encryption helper controlled by `APP_ENCRYPTION_KEY`.
- Client roles should have no direct table access.
- Add a restrictive deny-all RLS policy for `anon` and `authenticated`, mirroring `gemini_api_key_secrets`.

## Table Proposal: `external_generation_tasks`

Durable provider task metadata for AI Media Lab history, usage, fallback state, and later Drive output wiring.

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
provider text not null default 'magnific'
tool_type public.external_generation_tool_type not null
model_name text nullable
status public.ai_task_status not null default 'QUEUED'
selected_key_id uuid nullable
last_attempted_key_id uuid nullable
fallback_attempts int not null default 0
max_attempts int not null default 3
provider_task_id text nullable
source_image_drive_item_ref_id uuid nullable
source_motion_drive_item_ref_id uuid nullable
output_drive_item_ref_id uuid nullable
input_json jsonb not null default '{}'::jsonb
output_json jsonb nullable
log_json jsonb not null default '[]'::jsonb
error_code text nullable
error_message text nullable
http_status int nullable
retry_after_seconds int nullable
priority int not null default 100
scheduled_at timestamptz not null default now()
started_at timestamptz nullable
finished_at timestamptz nullable
cancelled_at timestamptz nullable
archived_at timestamptz nullable
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
unique (id, user_id)
foreign key (selected_key_id, user_id)
  references external_api_keys(id, user_id)
foreign key (last_attempted_key_id, user_id)
  references external_api_keys(id, user_id)
foreign key (source_image_drive_item_ref_id, user_id)
  references drive_items(id, user_id)
foreign key (source_motion_drive_item_ref_id, user_id)
  references drive_items(id, user_id)
foreign key (output_drive_item_ref_id, user_id)
  references drive_items(id, user_id)
check provider in ('magnific') for the first MVP migration
check fallback_attempts >= 0
check max_attempts >= 0 and max_attempts <= 10
check fallback_attempts <= max_attempts
check http_status is null or (http_status >= 100 and http_status <= 599)
check retry_after_seconds is null or retry_after_seconds >= 0
check priority >= 0
```

### Drive Metadata Relation

Drive remains the source of truth for file bytes:

- `source_image_drive_item_ref_id` points to the input image metadata row.
- `source_motion_drive_item_ref_id` points to the reference motion/video metadata row for Motion Control.
- `output_drive_item_ref_id` points to the generated image/video metadata row after Drive output wiring exists.
- `input_json`, `output_json`, and `log_json` must not contain base64, binary bytes, signed URL secrets, or copied large payloads.
- Provider output bytes should be uploaded to Google Drive first, then represented in Supabase through `drive_items`.

For MVP, the three Drive FK columns cover:

```text
MOTION_CONTROL: source_image_drive_item_ref_id + source_motion_drive_item_ref_id -> output_drive_item_ref_id
IMAGE_TO_VIDEO: source_image_drive_item_ref_id -> output_drive_item_ref_id
UPSCALER: source_image_drive_item_ref_id -> output_drive_item_ref_id
```

If later workflows require many input or output files, add a dedicated join table in a separate approved task instead of storing unvalidated UUID arrays.

## Optional Future Table: `external_generation_logs`

Use this only if `log_json` becomes too large or the history/log terminal needs append-only querying.

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
task_id uuid not null
sequence bigint generated by default as identity
level text not null default 'INFO'
message text not null
metadata_json jsonb nullable
created_at timestamptz not null default now()
```

Recommended constraints:

```text
foreign key (task_id, user_id)
  references external_generation_tasks(id, user_id)
  on delete cascade
check level in ('DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'ERROR')
check btrim(message) <> ''
```

Recommended indexes:

```text
(user_id, task_id, sequence desc)
(user_id, created_at desc)
```

## Optional Future Table: `external_usage_events`

Use this when real Magnific usage tracking is needed beyond task status counts.

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
external_api_key_id uuid nullable
external_generation_task_id uuid nullable
provider text not null default 'magnific'
tool_type public.external_generation_tool_type nullable
model_name text nullable
request_started_at timestamptz not null default now()
request_finished_at timestamptz nullable
status text not null default 'STARTED'
http_status int nullable
retry_after_seconds int nullable
provider_request_id text nullable
provider_task_id text nullable
input_units int nullable
output_units int nullable
estimated_cost numeric nullable
error_code text nullable
error_message text nullable
metadata_json jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
foreign key (external_api_key_id, user_id)
  references external_api_keys(id, user_id)
foreign key (external_generation_task_id, user_id)
  references external_generation_tasks(id, user_id)
check status in ('STARTED', 'SUCCESS', 'FAILED', 'RATE_LIMITED', 'COOLDOWN')
check http_status is null or (http_status >= 100 and http_status <= 599)
check retry_after_seconds is null or retry_after_seconds >= 0
check input_units is null or input_units >= 0
check output_units is null or output_units >= 0
check estimated_cost is null or estimated_cost >= 0
```

Recommended indexes:

```text
(user_id, request_started_at desc)
(user_id, external_api_key_id, request_started_at desc)
(user_id, provider, tool_type, request_started_at desc)
(external_api_key_id, user_id)
(external_generation_task_id, user_id)
```

No cost should be shown in UI until reliable provider pricing and usage units are confirmed.

## RLS Policy Outline

Enable RLS on all proposed tables:

```sql
alter table public.external_api_keys enable row level security;
alter table public.external_api_key_secrets enable row level security;
alter table public.external_generation_tasks enable row level security;
```

Non-secret metadata tables:

```text
authenticated can select own rows
authenticated can insert own rows
authenticated can update own rows
no delete policy in first MVP migration
```

Policy shape:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

Secret table:

```text
revoke all from anon
revoke all from authenticated
restrictive deny-all policy for anon and authenticated
server-only service role access after authenticated owner validation
```

Because Supabase is tightening automatic Data API exposure for new tables, the migration should explicitly decide grants:

- `external_api_keys`: grant `select, insert, update` to `authenticated` only if the UI uses the authenticated client directly for metadata.
- `external_generation_tasks`: grant `select, insert, update` to `authenticated` only if history/task UI uses the authenticated client directly.
- `external_api_key_secrets`: no client grants; revoke all from `anon` and `authenticated`.

## Index Proposal

### `external_api_keys`

```text
unique (user_id, provider, key_code)
(user_id)
(user_id, provider, status)
(user_id, status, cooldown_until)
(user_id, provider, last_used_at)
```

### `external_api_key_secrets`

```text
(user_id)
unique (external_api_key_id)
(external_api_key_id, user_id)
```

### `external_generation_tasks`

```text
(user_id, status, created_at desc)
(user_id, tool_type, created_at desc)
(user_id, selected_key_id, created_at desc)
(user_id, last_attempted_key_id, created_at desc)
(user_id, source_image_drive_item_ref_id)
(user_id, source_motion_drive_item_ref_id)
(user_id, output_drive_item_ref_id)
unique (user_id, provider, provider_task_id) where provider_task_id is not null
partial (user_id, status, scheduled_at) where status in ('QUEUED', 'RUNNING', 'RETRYING', 'WAITING_FOR_KEY')
```

## Rotator Compatibility

Selection should mirror Gemini routing concepts:

```text
1. Select keys where provider = 'magnific', status = ACTIVE, and cooldown_until is null or in the past.
2. Sort by requests_today ascending, last_used_at oldest/null first, created_at oldest first.
3. Attempt with selected key.
4. On success, update task SUCCESS, key last_used_at, key requests_today, and output metadata.
5. On retryable provider error, mark key RATE_LIMITED, COOLDOWN, or ERROR; append log; retry another eligible key.
6. On non-retryable input error, fail the task without fallback.
7. If no eligible key remains, set task WAITING_FOR_KEY.
8. Stop after max_attempts, default 3.
```

Retryable errors should include:

```text
429 rate limit
408 timeout
5xx provider error
network timeout
temporary upstream error
cooldown key
```

Non-retryable errors should include:

```text
400 invalid payload
missing image/video
unsupported model
file too large
safety rejection
invalid prompt/input
```

## Migration Plan

The migration file has been created as `supabase/migrations/20260521000001_ai_media_external_backend_schema.sql` for AI-MEDIA-BACKEND-002. Do not apply SQL to any database until the user gives explicit apply approval.

Next verification and apply sequence:

1. Inspect current Supabase schema and grants before any apply.
2. Confirm whether AI Media Lab metadata tables should be exposed to the authenticated Data API or kept server-only.
3. Audit the migration against this document and `docs/DATABASE_SCHEMA_LOCK.md`.
4. Run `supabase db lint` if Supabase CLI is available.
5. Run `supabase db diff` only in an approved database workflow.
6. Update `docs/DATABASE_SCHEMA_LOCK.md` only in the same approved schema lock task.
7. Apply SQL only after explicit user approval. Do not use Supabase MCP apply without approval.

## Deferred Work

Not included in this schema/migration baseline:

- applying SQL;
- server actions;
- encrypted key write/read implementation;
- Magnific API client;
- live connection test;
- real usage tracking;
- Google Drive upload/download wiring;
- task runner;
- UI changes.

begin;

-- =============================================================================
-- AI Media Lab External Backend Schema
-- Micro-task: AI-MEDIA-BACKEND-002
-- Tables: external_api_keys, external_api_key_secrets, external_generation_tasks
-- =============================================================================

-- Enum: tool types for AI Media Lab generation tasks
create type public.external_generation_tool_type as enum (
  'MOTION_CONTROL',
  'IMAGE_TO_VIDEO',
  'UPSCALER'
);

-- =============================================================================
-- Table: external_api_keys
-- Metadata for external provider API keys. Raw secrets are NOT stored here.
-- =============================================================================

create table public.external_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'magnific',
  key_code text not null,
  label text not null,
  status public.account_status not null default 'DISABLED',
  provider_account_label text,
  project_label text,
  model_name text,
  purpose text,
  rpm_limit int,
  rpd_limit int,
  tpm_limit int,
  requests_today int not null default 0,
  last_used_at timestamptz,
  cooldown_until timestamptz,
  last_tested_at timestamptz,
  last_error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_api_keys_id_user_id_key unique (id, user_id),
  constraint external_api_keys_user_provider_key_code_key unique (user_id, provider, key_code),
  constraint external_api_keys_provider_check check (provider in ('magnific')),
  constraint external_api_keys_label_check check (btrim(label) <> ''),
  constraint external_api_keys_requests_today_check check (requests_today >= 0),
  constraint external_api_keys_rpm_limit_check check (rpm_limit is null or rpm_limit >= 0),
  constraint external_api_keys_rpd_limit_check check (rpd_limit is null or rpd_limit >= 0),
  constraint external_api_keys_tpm_limit_check check (tpm_limit is null or tpm_limit >= 0)
);

alter table public.external_api_keys enable row level security;

grant select, insert, update on public.external_api_keys to authenticated;
revoke all on public.external_api_keys from anon;

drop trigger if exists set_external_api_keys_updated_at on public.external_api_keys;
create trigger set_external_api_keys_updated_at
before update on public.external_api_keys
for each row
execute function public.set_updated_at();

-- Indexes: external_api_keys
create index external_api_keys_user_id_idx
  on public.external_api_keys (user_id);

create index external_api_keys_user_provider_status_idx
  on public.external_api_keys (user_id, provider, status);

create index external_api_keys_user_status_cooldown_idx
  on public.external_api_keys (user_id, status, cooldown_until);

create index external_api_keys_user_provider_last_used_idx
  on public.external_api_keys (user_id, provider, last_used_at);

-- RLS policies: external_api_keys (owner-only)
create policy "external_api_keys_select_own" on public.external_api_keys
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "external_api_keys_insert_own" on public.external_api_keys
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "external_api_keys_update_own" on public.external_api_keys
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- =============================================================================
-- Table: external_api_key_secrets
-- Encrypted server-only secret store. No client access.
-- =============================================================================

create table public.external_api_key_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_api_key_id uuid not null,
  encrypted_api_key text not null,
  key_fingerprint text,
  encryption_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_api_key_secrets_key_id_key unique (external_api_key_id),
  constraint external_api_key_secrets_owner_fkey
    foreign key (external_api_key_id, user_id)
    references public.external_api_keys(id, user_id)
    on delete cascade,
  constraint external_api_key_secrets_encrypted_check check (btrim(encrypted_api_key) <> '')
);

alter table public.external_api_key_secrets enable row level security;

-- No client grants: server-only access
revoke all on public.external_api_key_secrets from anon;
revoke all on public.external_api_key_secrets from authenticated;

-- Restrictive deny-all policy (mirrors gemini_api_key_secrets pattern)
create policy "external_api_key_secrets_deny_all"
on public.external_api_key_secrets
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop trigger if exists set_external_api_key_secrets_updated_at on public.external_api_key_secrets;
create trigger set_external_api_key_secrets_updated_at
before update on public.external_api_key_secrets
for each row
execute function public.set_updated_at();

-- Indexes: external_api_key_secrets
create index external_api_key_secrets_user_id_idx
  on public.external_api_key_secrets (user_id);

create index external_api_key_secrets_key_user_idx
  on public.external_api_key_secrets (external_api_key_id, user_id);

-- =============================================================================
-- Table: external_generation_tasks
-- Durable provider task metadata for AI Media Lab history and usage.
-- Large asset bytes are NOT stored here — only metadata and Drive refs.
-- =============================================================================

create table public.external_generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'magnific',
  tool_type public.external_generation_tool_type not null,
  model_name text,
  status public.ai_task_status not null default 'QUEUED',
  selected_key_id uuid,
  last_attempted_key_id uuid,
  fallback_attempts int not null default 0,
  max_attempts int not null default 3,
  provider_task_id text,
  source_image_drive_item_ref_id uuid,
  source_motion_drive_item_ref_id uuid,
  output_drive_item_ref_id uuid,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  log_json jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  http_status int,
  retry_after_seconds int,
  priority int not null default 100,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_generation_tasks_id_user_id_key unique (id, user_id),
  constraint external_generation_tasks_provider_check check (provider in ('magnific')),
  constraint external_generation_tasks_fallback_check check (fallback_attempts >= 0),
  constraint external_generation_tasks_max_attempts_check check (max_attempts >= 0 and max_attempts <= 10),
  constraint external_generation_tasks_fallback_max_check check (fallback_attempts <= max_attempts),
  constraint external_generation_tasks_http_status_check check (http_status is null or (http_status >= 100 and http_status <= 599)),
  constraint external_generation_tasks_retry_after_check check (retry_after_seconds is null or retry_after_seconds >= 0),
  constraint external_generation_tasks_priority_check check (priority >= 0),
  constraint external_generation_tasks_selected_key_fkey
    foreign key (selected_key_id, user_id)
    references public.external_api_keys(id, user_id),
  constraint external_generation_tasks_last_key_fkey
    foreign key (last_attempted_key_id, user_id)
    references public.external_api_keys(id, user_id),
  constraint external_generation_tasks_source_image_fkey
    foreign key (source_image_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),
  constraint external_generation_tasks_source_motion_fkey
    foreign key (source_motion_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),
  constraint external_generation_tasks_output_fkey
    foreign key (output_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id)
);

alter table public.external_generation_tasks enable row level security;

grant select, insert, update on public.external_generation_tasks to authenticated;
revoke all on public.external_generation_tasks from anon;

drop trigger if exists set_external_generation_tasks_updated_at on public.external_generation_tasks;
create trigger set_external_generation_tasks_updated_at
before update on public.external_generation_tasks
for each row
execute function public.set_updated_at();

-- Indexes: external_generation_tasks
create index external_generation_tasks_user_status_created_idx
  on public.external_generation_tasks (user_id, status, created_at desc);

create index external_generation_tasks_user_tool_created_idx
  on public.external_generation_tasks (user_id, tool_type, created_at desc);

create index external_generation_tasks_user_selected_key_idx
  on public.external_generation_tasks (user_id, selected_key_id, created_at desc);

create index external_generation_tasks_user_last_key_idx
  on public.external_generation_tasks (user_id, last_attempted_key_id, created_at desc);

create index external_generation_tasks_source_image_idx
  on public.external_generation_tasks (user_id, source_image_drive_item_ref_id);

create index external_generation_tasks_source_motion_idx
  on public.external_generation_tasks (user_id, source_motion_drive_item_ref_id);

create index external_generation_tasks_output_idx
  on public.external_generation_tasks (user_id, output_drive_item_ref_id);

-- Unique partial index for provider task ID deduplication
create unique index external_generation_tasks_provider_task_id_key
  on public.external_generation_tasks (user_id, provider, provider_task_id)
  where provider_task_id is not null;

-- Partial index for active queue processing
create index external_generation_tasks_active_queue_idx
  on public.external_generation_tasks (user_id, status, scheduled_at)
  where status in ('QUEUED', 'RUNNING', 'RETRYING', 'WAITING_FOR_KEY');

-- RLS policies: external_generation_tasks (owner-only)
create policy "external_generation_tasks_select_own" on public.external_generation_tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "external_generation_tasks_insert_own" on public.external_generation_tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "external_generation_tasks_update_own" on public.external_generation_tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

begin;

create type public.bulk_import_job_status as enum (
  'QUEUED',
  'RUNNING',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'COMPLETED',
  'FAILED'
);

create type public.bulk_import_job_row_status as enum (
  'READY',
  'RUNNING',
  'IMAGE_DOWNLOADING',
  'IMAGE_UPLOADING',
  'PRODUCT_CREATING',
  'IMPORTED',
  'SKIPPED',
  'ERROR',
  'CANCELLED'
);

create type public.bulk_import_log_level as enum (
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR'
);

create table public.bulk_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null,
  file_name text not null,
  status public.bulk_import_job_status not null default 'QUEUED',
  total_rows int not null default 0,
  ready_rows int not null default 0,
  duplicate_rows int not null default 0,
  error_rows int not null default 0,
  imported_rows int not null default 0,
  skipped_rows int not null default 0,
  cancelled_rows int not null default 0,
  error_message text null,
  runner_id text null,
  lease_expires_at timestamptz null,
  last_heartbeat_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  cancel_requested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bulk_import_jobs_id_user_id_key unique (id, user_id),
  constraint bulk_import_jobs_workspace_user_fkey
    foreign key (workspace_id, user_id)
    references public.workspaces(id, user_id),
  constraint bulk_import_jobs_file_name_check check (btrim(file_name) <> ''),
  constraint bulk_import_jobs_counts_check check (
    total_rows >= 0
    and ready_rows >= 0
    and duplicate_rows >= 0
    and error_rows >= 0
    and imported_rows >= 0
    and skipped_rows >= 0
    and cancelled_rows >= 0
  )
);

create table public.bulk_import_job_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  workspace_id uuid null,
  row_number int not null,
  status public.bulk_import_job_row_status not null default 'READY',
  errors text[] not null default '{}'::text[],
  product_name text not null,
  product_url text not null,
  image_url text not null,
  marketplace_label text not null,
  platform public.marketplace_platform null,
  source_domain text null,
  optional_json jsonb not null default '{}'::jsonb,
  raw_columns_json jsonb not null default '{}'::jsonb,
  product_id uuid null,
  intake_session_id uuid null,
  drive_item_id uuid null,
  intake_code text null,
  current_stage text null,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bulk_import_job_rows_id_user_id_key unique (id, user_id),
  constraint bulk_import_job_rows_job_row_key unique (job_id, row_number),
  constraint bulk_import_job_rows_job_user_fkey
    foreign key (job_id, user_id)
    references public.bulk_import_jobs(id, user_id)
    on delete cascade,
  constraint bulk_import_job_rows_workspace_user_fkey
    foreign key (workspace_id, user_id)
    references public.workspaces(id, user_id),
  constraint bulk_import_job_rows_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint bulk_import_job_rows_intake_user_fkey
    foreign key (intake_session_id, user_id)
    references public.product_intake_sessions(id, user_id),
  constraint bulk_import_job_rows_drive_item_user_fkey
    foreign key (drive_item_id, user_id)
    references public.drive_items(id, user_id),
  constraint bulk_import_job_rows_row_number_check check (row_number > 0)
);

create table public.bulk_import_job_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  row_id uuid null,
  sequence bigint generated always as identity,
  level public.bulk_import_log_level not null default 'INFO',
  title text not null,
  message text not null,
  metadata_json jsonb null,
  created_at timestamptz not null default now(),
  constraint bulk_import_job_logs_id_user_id_key unique (id, user_id),
  constraint bulk_import_job_logs_job_user_fkey
    foreign key (job_id, user_id)
    references public.bulk_import_jobs(id, user_id)
    on delete cascade,
  constraint bulk_import_job_logs_row_user_fkey
    foreign key (row_id, user_id)
    references public.bulk_import_job_rows(id, user_id)
    on delete cascade,
  constraint bulk_import_job_logs_title_check check (btrim(title) <> ''),
  constraint bulk_import_job_logs_message_check check (btrim(message) <> '')
);

alter table public.bulk_import_jobs enable row level security;
alter table public.bulk_import_job_rows enable row level security;
alter table public.bulk_import_job_logs enable row level security;

grant select, insert, update on public.bulk_import_jobs to authenticated;
grant select, insert, update on public.bulk_import_job_rows to authenticated;
grant select, insert on public.bulk_import_job_logs to authenticated;
grant usage, select on sequence public.bulk_import_job_logs_sequence_seq to authenticated;

drop trigger if exists set_bulk_import_jobs_updated_at on public.bulk_import_jobs;
create trigger set_bulk_import_jobs_updated_at
before update on public.bulk_import_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_bulk_import_job_rows_updated_at on public.bulk_import_job_rows;
create trigger set_bulk_import_job_rows_updated_at
before update on public.bulk_import_job_rows
for each row
execute function public.set_updated_at();

create index bulk_import_jobs_user_status_updated_idx
  on public.bulk_import_jobs (user_id, status, updated_at desc);

create index bulk_import_jobs_user_workspace_idx
  on public.bulk_import_jobs (user_id, workspace_id)
  where workspace_id is not null;

create index bulk_import_job_rows_user_job_row_idx
  on public.bulk_import_job_rows (user_id, job_id, row_number);

create index bulk_import_job_rows_user_job_status_idx
  on public.bulk_import_job_rows (user_id, job_id, status);

create index bulk_import_job_rows_user_product_idx
  on public.bulk_import_job_rows (user_id, product_id)
  where product_id is not null;

create index bulk_import_job_rows_user_intake_idx
  on public.bulk_import_job_rows (user_id, intake_session_id)
  where intake_session_id is not null;

create index bulk_import_job_logs_user_job_sequence_idx
  on public.bulk_import_job_logs (user_id, job_id, sequence desc);

create policy "bulk_import_jobs_select_own" on public.bulk_import_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "bulk_import_jobs_insert_own" on public.bulk_import_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "bulk_import_jobs_update_own" on public.bulk_import_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "bulk_import_job_rows_select_own" on public.bulk_import_job_rows
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "bulk_import_job_rows_insert_own" on public.bulk_import_job_rows
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "bulk_import_job_rows_update_own" on public.bulk_import_job_rows
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "bulk_import_job_logs_select_own" on public.bulk_import_job_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "bulk_import_job_logs_insert_own" on public.bulk_import_job_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.bulk_import_jobs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bulk_import_job_rows;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bulk_import_job_logs;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

commit;

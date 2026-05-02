begin;

create type public.flow_batch_status as enum (
  'DRAFT',
  'READY_TO_EXPORT',
  'EXPORTED',
  'RUNNING',
  'IMPORTING',
  'PARTIALLY_IMPORTED',
  'IMPORTED',
  'NEED_MANUAL_MATCH',
  'CLOSED'
);

create table public.flow_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_code text not null,
  account_type text not null,
  observed_daily_credit int not null default 50,
  observed_monthly_credit int,
  credit_per_generation int not null default 10,
  max_parallel_allowed int not null default 1,
  cooldown_minutes int not null default 0,
  status public.account_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flow_accounts_id_user_id_key unique (id, user_id),
  constraint flow_accounts_user_account_code_key unique (user_id, account_code),
  constraint flow_accounts_account_code_check check (btrim(account_code) <> ''),
  constraint flow_accounts_account_type_check check (account_type in ('FLOW_FREE', 'FLOW_PLUS')),
  constraint flow_accounts_credit_check check (
    observed_daily_credit >= 0
    and credit_per_generation > 0
  ),
  constraint flow_accounts_parallel_check check (max_parallel_allowed >= 1),
  constraint flow_accounts_cooldown_check check (cooldown_minutes >= 0)
);

create table public.flow_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  product_id uuid,
  prompt_pack_id uuid,
  batch_code text not null,
  flow_account_id uuid not null,
  target_date date not null default current_date,
  model text not null default 'google-flow',
  max_jobs int not null default 5,
  drive_output_folder_url text,
  drive_output_folder_id text,
  status public.flow_batch_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint flow_batches_id_user_id_key unique (id, user_id),
  constraint flow_batches_user_batch_code_key unique (user_id, batch_code),
  constraint flow_batches_workspace_user_fkey
    foreign key (workspace_id, user_id)
    references public.workspaces(id, user_id),
  constraint flow_batches_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint flow_batches_prompt_pack_user_fkey
    foreign key (prompt_pack_id, user_id)
    references public.prompt_packs(id, user_id),
  constraint flow_batches_flow_account_user_fkey
    foreign key (flow_account_id, user_id)
    references public.flow_accounts(id, user_id),
  constraint flow_batches_batch_code_check check (btrim(batch_code) <> ''),
  constraint flow_batches_max_jobs_check check (max_jobs between 1 and 5)
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  content_code text not null,
  platform text,
  hook_type text,
  angle text,
  caption_tiktok text,
  caption_shopee text,
  tags_tiktok jsonb,
  tags_shopee jsonb,
  prompt_pack_id uuid,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contents_id_user_id_key unique (id, user_id),
  constraint contents_user_content_code_key unique (user_id, content_code),
  constraint contents_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint contents_prompt_pack_user_fkey
    foreign key (prompt_pack_id, user_id)
    references public.prompt_packs(id, user_id),
  constraint contents_content_code_check check (btrim(content_code) <> '')
);

create table public.clip_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null,
  prompt_pack_id uuid,
  batch_id uuid,
  job_code text not null,
  clip_code text not null,
  version text not null default 'V01',
  prompt_prefix text not null,
  prompt_one_paragraph text not null,
  start_frame_drive_item_id uuid,
  last_frame_drive_item_id uuid,
  generated_drive_item_id uuid,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clip_jobs_id_user_id_key unique (id, user_id),
  constraint clip_jobs_user_job_code_key unique (user_id, job_code),
  constraint clip_jobs_content_user_fkey
    foreign key (content_id, user_id)
    references public.contents(id, user_id),
  constraint clip_jobs_prompt_pack_user_fkey
    foreign key (prompt_pack_id, user_id)
    references public.prompt_packs(id, user_id),
  constraint clip_jobs_batch_user_fkey
    foreign key (batch_id, user_id)
    references public.flow_batches(id, user_id),
  constraint clip_jobs_start_frame_drive_user_fkey
    foreign key (start_frame_drive_item_id, user_id)
    references public.drive_items(id, user_id),
  constraint clip_jobs_last_frame_drive_user_fkey
    foreign key (last_frame_drive_item_id, user_id)
    references public.drive_items(id, user_id),
  constraint clip_jobs_generated_drive_user_fkey
    foreign key (generated_drive_item_id, user_id)
    references public.drive_items(id, user_id),
  constraint clip_jobs_job_code_check check (btrim(job_code) <> ''),
  constraint clip_jobs_clip_code_check check (btrim(clip_code) <> ''),
  constraint clip_jobs_prompt_prefix_check check (btrim(prompt_prefix) <> ''),
  constraint clip_jobs_prompt_one_paragraph_check check (btrim(prompt_one_paragraph) <> '')
);

create table public.generated_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_job_id uuid,
  drive_item_id uuid not null,
  file_name text not null,
  detected_prefix text,
  match_status text not null default 'UNMATCHED',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint generated_files_id_user_id_key unique (id, user_id),
  constraint generated_files_clip_job_user_fkey
    foreign key (clip_job_id, user_id)
    references public.clip_jobs(id, user_id),
  constraint generated_files_drive_item_user_fkey
    foreign key (drive_item_id, user_id)
    references public.drive_items(id, user_id),
  constraint generated_files_file_name_check check (btrim(file_name) <> '')
);

alter table public.flow_accounts enable row level security;
alter table public.flow_batches enable row level security;
alter table public.contents enable row level security;
alter table public.clip_jobs enable row level security;
alter table public.generated_files enable row level security;

grant select, insert, update on public.flow_accounts to authenticated;
grant select, insert, update on public.flow_batches to authenticated;
grant select, insert, update on public.contents to authenticated;
grant select, insert, update on public.clip_jobs to authenticated;
grant select, insert, update on public.generated_files to authenticated;

drop trigger if exists set_flow_accounts_updated_at on public.flow_accounts;
create trigger set_flow_accounts_updated_at
before update on public.flow_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_flow_batches_updated_at on public.flow_batches;
create trigger set_flow_batches_updated_at
before update on public.flow_batches
for each row
execute function public.set_updated_at();

drop trigger if exists set_contents_updated_at on public.contents;
create trigger set_contents_updated_at
before update on public.contents
for each row
execute function public.set_updated_at();

drop trigger if exists set_clip_jobs_updated_at on public.clip_jobs;
create trigger set_clip_jobs_updated_at
before update on public.clip_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_generated_files_updated_at on public.generated_files;
create trigger set_generated_files_updated_at
before update on public.generated_files
for each row
execute function public.set_updated_at();

create index flow_accounts_user_status_idx
  on public.flow_accounts (user_id, status);

create index flow_batches_user_status_target_idx
  on public.flow_batches (user_id, status, target_date);

create index flow_batches_user_account_idx
  on public.flow_batches (user_id, flow_account_id);

create index flow_batches_user_workspace_idx
  on public.flow_batches (user_id, workspace_id);

create index flow_batches_user_product_idx
  on public.flow_batches (user_id, product_id);

create index flow_batches_user_prompt_pack_idx
  on public.flow_batches (user_id, prompt_pack_id);

create index contents_user_product_idx
  on public.contents (user_id, product_id);

create index contents_user_prompt_pack_idx
  on public.contents (user_id, prompt_pack_id);

create index clip_jobs_user_batch_idx
  on public.clip_jobs (user_id, batch_id);

create index clip_jobs_user_content_idx
  on public.clip_jobs (user_id, content_id);

create index clip_jobs_user_prompt_pack_idx
  on public.clip_jobs (user_id, prompt_pack_id);

create index clip_jobs_user_start_frame_drive_idx
  on public.clip_jobs (user_id, start_frame_drive_item_id);

create index clip_jobs_user_last_frame_drive_idx
  on public.clip_jobs (user_id, last_frame_drive_item_id);

create index clip_jobs_user_generated_drive_idx
  on public.clip_jobs (user_id, generated_drive_item_id);

create index clip_jobs_user_status_idx
  on public.clip_jobs (user_id, status);

create index generated_files_user_clip_job_idx
  on public.generated_files (user_id, clip_job_id);

create index generated_files_user_drive_item_idx
  on public.generated_files (user_id, drive_item_id);

create index generated_files_user_match_status_idx
  on public.generated_files (user_id, match_status);

create policy "flow_accounts_select_own" on public.flow_accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "flow_accounts_insert_own" on public.flow_accounts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "flow_accounts_update_own" on public.flow_accounts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "flow_batches_select_own" on public.flow_batches
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "flow_batches_insert_own" on public.flow_batches
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "flow_batches_update_own" on public.flow_batches
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "contents_select_own" on public.contents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "contents_insert_own" on public.contents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "contents_update_own" on public.contents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "clip_jobs_select_own" on public.clip_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "clip_jobs_insert_own" on public.clip_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "clip_jobs_update_own" on public.clip_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "generated_files_select_own" on public.generated_files
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "generated_files_insert_own" on public.generated_files
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "generated_files_update_own" on public.generated_files
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

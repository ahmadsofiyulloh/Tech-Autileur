begin;

create type public.ai_task_status as enum (
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'RETRYING',
  'WAITING_FOR_KEY',
  'CANCELLED'
);

create type public.ai_task_type as enum (
  'VISION_ANALYSIS',
  'I2I_PROMPT',
  'I2V_PROMPT',
  'CONSISTENCY_CHECK',
  'PROMPT_REPAIR',
  'FALLBACK'
);

create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemini_api_key_id uuid,
  task_type public.ai_task_type not null,
  status public.ai_task_status not null default 'QUEUED',
  input_json jsonb not null,
  output_json jsonb,
  error_message text,
  retry_count int not null default 0,
  max_retries int not null default 3,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tasks_retry_count_check check (retry_count >= 0),
  constraint ai_tasks_max_retries_check check (max_retries >= 0 and max_retries <= 10),
  constraint ai_tasks_gemini_api_key_owner_fkey
    foreign key (gemini_api_key_id, user_id)
    references public.gemini_api_keys(id, user_id)
);

alter table public.ai_tasks enable row level security;

grant select, insert, update on public.ai_tasks to authenticated;

drop trigger if exists set_ai_tasks_updated_at on public.ai_tasks;
create trigger set_ai_tasks_updated_at
before update on public.ai_tasks
for each row
execute function public.set_updated_at();

create index ai_tasks_user_id_idx on public.ai_tasks (user_id);

create index ai_tasks_user_status_created_at_idx on public.ai_tasks (user_id, status, created_at desc);

create index ai_tasks_task_type_idx on public.ai_tasks (task_type);

create index ai_tasks_gemini_api_key_id_idx on public.ai_tasks (gemini_api_key_id);

create policy "ai_tasks_select_own" on public.ai_tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "ai_tasks_insert_own" on public.ai_tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "ai_tasks_update_own" on public.ai_tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

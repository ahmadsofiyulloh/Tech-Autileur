begin;

create table public.gemini_api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemini_api_key_id uuid not null,
  ai_task_id uuid,
  project_label text,
  model_name text not null,
  role public.gemini_key_role not null,
  task_type public.ai_task_type not null,
  request_started_at timestamptz not null default now(),
  request_finished_at timestamptz,
  status text not null default 'STARTED',
  http_status int,
  prompt_token_count int,
  candidates_token_count int,
  total_token_count int,
  thoughts_token_count int,
  cached_content_token_count int,
  retry_after_seconds int,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gemini_usage_event_status_check
    check (status in ('STARTED', 'SUCCESS', 'FAILED', 'RATE_LIMITED')),
  constraint gemini_usage_event_http_status_check
    check (http_status is null or (http_status >= 100 and http_status <= 599)),
  constraint gemini_usage_event_prompt_tokens_check
    check (prompt_token_count is null or prompt_token_count >= 0),
  constraint gemini_usage_event_candidates_tokens_check
    check (candidates_token_count is null or candidates_token_count >= 0),
  constraint gemini_usage_event_total_tokens_check
    check (total_token_count is null or total_token_count >= 0),
  constraint gemini_usage_event_thoughts_tokens_check
    check (thoughts_token_count is null or thoughts_token_count >= 0),
  constraint gemini_usage_event_cached_tokens_check
    check (cached_content_token_count is null or cached_content_token_count >= 0),
  constraint gemini_usage_event_retry_after_check
    check (retry_after_seconds is null or retry_after_seconds >= 0),
  constraint gemini_usage_event_key_owner_fkey
    foreign key (gemini_api_key_id, user_id)
    references public.gemini_api_keys(id, user_id)
    on delete cascade,
  constraint gemini_usage_event_task_owner_fkey
    foreign key (ai_task_id, user_id)
    references public.ai_tasks(id, user_id)
    on delete cascade
);

alter table public.gemini_api_usage_events enable row level security;

grant select, insert, update on public.gemini_api_usage_events to authenticated;

drop trigger if exists set_gemini_api_usage_events_updated_at on public.gemini_api_usage_events;
create trigger set_gemini_api_usage_events_updated_at
before update on public.gemini_api_usage_events
for each row
execute function public.set_updated_at();

create index gemini_usage_events_user_started_idx
  on public.gemini_api_usage_events (user_id, request_started_at desc);

create index gemini_usage_events_user_key_started_idx
  on public.gemini_api_usage_events (user_id, gemini_api_key_id, request_started_at desc);

create index gemini_usage_events_user_project_model_started_idx
  on public.gemini_api_usage_events (user_id, project_label, model_name, request_started_at desc);

create policy "gemini_api_usage_events_select_own" on public.gemini_api_usage_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "gemini_api_usage_events_insert_own" on public.gemini_api_usage_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "gemini_api_usage_events_update_own" on public.gemini_api_usage_events
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

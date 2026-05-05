begin;

create index if not exists gemini_usage_events_key_owner_fk_idx
  on public.gemini_api_usage_events (gemini_api_key_id, user_id);

create index if not exists gemini_usage_events_task_owner_fk_idx
  on public.gemini_api_usage_events (ai_task_id, user_id);

commit;

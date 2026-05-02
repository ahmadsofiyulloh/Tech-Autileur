begin;

alter type public.ai_task_type add value if not exists 'PROMPT_PACK_GENERATION';

alter table public.ai_tasks
  add constraint ai_tasks_id_user_id_key unique (id, user_id);

alter table public.prompt_packs
  add constraint prompt_packs_ai_task_id_user_id_fkey
  foreign key (ai_task_id, user_id)
  references public.ai_tasks (id, user_id);

create index prompt_packs_user_ai_task_id_idx
  on public.prompt_packs (user_id, ai_task_id)
  where ai_task_id is not null;

commit;

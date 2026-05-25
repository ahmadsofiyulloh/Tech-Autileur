begin;

alter table public.share_generations
  add column if not exists ai_task_id uuid null,
  add column if not exists updated_at timestamptz not null default now();

update public.share_generations
set updated_at = created_at
where updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'share_generations_ai_task_id_user_id_fkey'
      and conrelid = 'public.share_generations'::regclass
  ) then
    alter table public.share_generations
      add constraint share_generations_ai_task_id_user_id_fkey
      foreign key (ai_task_id, user_id)
      references public.ai_tasks (id, user_id);
  end if;
end $$;

create index if not exists share_generations_user_ai_task_id_idx
  on public.share_generations (user_id, ai_task_id)
  where ai_task_id is not null;

create index if not exists share_generations_user_status_updated_at_idx
  on public.share_generations (user_id, status, updated_at desc);

drop trigger if exists set_updated_at_share_generations on public.share_generations;
create trigger set_updated_at_share_generations
before update on public.share_generations
for each row
execute function public.set_updated_at();

comment on column public.share_generations.ai_task_id is 'Internal ai_tasks ledger row for the share caption generation, used for polling recovery.';
comment on column public.share_generations.updated_at is 'Server-managed timestamp used to detect orphaned or stale generating rows.';

commit;

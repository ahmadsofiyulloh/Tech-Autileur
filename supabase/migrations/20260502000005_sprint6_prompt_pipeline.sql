begin;

create type public.prompt_pack_status as enum (
  'DRAFT',
  'QUEUED',
  'GENERATING',
  'GENERATED',
  'NEEDS_REVIEW',
  'APPROVED',
  'ARCHIVED',
  'ERROR'
);

create table public.prompt_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  source_product_image_id uuid null,
  prompt_code text not null,
  version int not null default 1,
  status public.prompt_pack_status not null default 'DRAFT',
  product_analysis_json jsonb,
  i2i_prompts_json jsonb,
  i2v_prompts_json jsonb,
  consistency_rules_json jsonb,
  ai_task_id uuid null,
  error_message text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_packs_id_user_id_key unique (id, user_id),
  constraint prompt_packs_user_prompt_code_version_key unique (user_id, prompt_code, version),
  constraint prompt_packs_version_check check (version >= 1),
  constraint prompt_packs_prompt_code_check check (btrim(prompt_code) <> ''),
  constraint prompt_packs_product_id_user_id_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint prompt_packs_source_product_image_id_user_id_fkey
    foreign key (source_product_image_id, user_id)
    references public.product_images(id, user_id)
);

-- ai_task_id FK is deferred because public.ai_tasks does not currently expose a composite unique (id, user_id) key.

alter table public.prompt_packs enable row level security;

grant select, insert, update on public.prompt_packs to authenticated;

drop trigger if exists set_prompt_packs_updated_at on public.prompt_packs;
create trigger set_prompt_packs_updated_at
before update on public.prompt_packs
for each row
execute function public.set_updated_at();

create index prompt_packs_user_id_idx on public.prompt_packs (user_id);

create index prompt_packs_user_product_id_idx on public.prompt_packs (user_id, product_id);

create index prompt_packs_user_status_idx on public.prompt_packs (user_id, status);

create policy "prompt_packs_select_own" on public.prompt_packs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "prompt_packs_insert_own" on public.prompt_packs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "prompt_packs_update_own" on public.prompt_packs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

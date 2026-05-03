begin;

alter table public.affiliate_profiles
  alter column lock_seed_character set default true,
  alter column lock_environment set default true;

create table public.affiliate_profile_workspace_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  affiliate_profile_id uuid not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliate_profile_workspace_links_id_user_id_key unique (id, user_id),
  constraint affiliate_profile_workspace_links_user_workspace_profile_key unique (user_id, workspace_id, affiliate_profile_id),

  constraint affiliate_profile_workspace_links_workspace_user_fkey
    foreign key (workspace_id, user_id)
    references public.workspaces(id, user_id)
    on delete cascade,

  constraint affiliate_profile_workspace_links_profile_user_fkey
    foreign key (affiliate_profile_id, user_id)
    references public.affiliate_profiles(id, user_id)
    on delete cascade
);

alter table public.affiliate_profile_workspace_links enable row level security;

grant select, insert, update, delete on public.affiliate_profile_workspace_links to authenticated;

drop trigger if exists set_affiliate_profile_workspace_links_updated_at on public.affiliate_profile_workspace_links;
create trigger set_affiliate_profile_workspace_links_updated_at
before update on public.affiliate_profile_workspace_links
for each row
execute function public.set_updated_at();

create index affiliate_profile_workspace_links_user_workspace_idx
  on public.affiliate_profile_workspace_links (user_id, workspace_id);

create index affiliate_profile_workspace_links_user_profile_idx
  on public.affiliate_profile_workspace_links (user_id, affiliate_profile_id);

create unique index affiliate_profile_workspace_links_user_workspace_default_idx
  on public.affiliate_profile_workspace_links (user_id, workspace_id)
  where is_default = true;

create policy "affiliate_profile_workspace_links_select_own" on public.affiliate_profile_workspace_links
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "affiliate_profile_workspace_links_insert_own" on public.affiliate_profile_workspace_links
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "affiliate_profile_workspace_links_update_own" on public.affiliate_profile_workspace_links
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "affiliate_profile_workspace_links_delete_own" on public.affiliate_profile_workspace_links
for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into public.affiliate_profile_workspace_links (
  user_id,
  workspace_id,
  affiliate_profile_id,
  is_default
)
select distinct
  affiliate_profiles.user_id,
  affiliate_profiles.workspace_id,
  affiliate_profiles.id,
  true
from public.affiliate_profiles
where affiliate_profiles.workspace_id is not null
on conflict do nothing;

drop index if exists affiliate_profiles_user_workspace_idx;

alter table public.affiliate_profiles
  drop constraint if exists affiliate_profiles_workspace_user_fkey;

alter table public.affiliate_profiles
  drop column if exists workspace_id;

commit;

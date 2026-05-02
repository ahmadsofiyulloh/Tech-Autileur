begin;

create type public.workspace_status as enum (
  'ACTIVE',
  'ARCHIVED',
  'DISABLED',
  'ERROR'
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_code text not null,
  workspace_name text not null,
  niche text,
  drive_root_folder_ref_id uuid null,
  drive_root_folder_url text,
  drive_root_folder_path text,
  status public.workspace_status not null default 'ACTIVE',
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspaces_id_user_id_key unique (id, user_id),
  constraint workspaces_user_workspace_code_key unique (user_id, workspace_code),

  constraint workspaces_drive_root_folder_ref_user_fkey
    foreign key (drive_root_folder_ref_id, user_id)
    references public.drive_items(id, user_id),

  constraint workspaces_workspace_code_check check (btrim(workspace_code) <> ''),
  constraint workspaces_workspace_name_check check (btrim(workspace_name) <> ''),
  constraint workspaces_drive_root_folder_url_check check (
    drive_root_folder_url is null or btrim(drive_root_folder_url) <> ''
  ),
  constraint workspaces_drive_root_folder_path_check check (
    drive_root_folder_path is null or btrim(drive_root_folder_path) <> ''
  )
);

alter table public.workspaces enable row level security;

grant select, insert, update on public.workspaces to authenticated;

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create index workspaces_user_id_idx
  on public.workspaces (user_id);

create index workspaces_user_status_idx
  on public.workspaces (user_id, status);

create unique index workspaces_user_default_idx
  on public.workspaces (user_id)
  where is_default = true;

create policy "workspaces_select_own" on public.workspaces
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "workspaces_insert_own" on public.workspaces
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "workspaces_update_own" on public.workspaces
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_workspace_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_preferences_current_workspace_user_fkey
    foreign key (current_workspace_id, user_id)
    references public.workspaces(id, user_id)
);

alter table public.user_preferences enable row level security;

grant select, insert, update on public.user_preferences to authenticated;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

create policy "user_preferences_select_own" on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_preferences_insert_own" on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_preferences_update_own" on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

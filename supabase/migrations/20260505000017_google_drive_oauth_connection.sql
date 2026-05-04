begin;

create table public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google_drive',
  google_account_email text,
  google_account_label text,
  scopes text[] not null default '{}',
  encrypted_refresh_token text,
  status text not null default 'DISCONNECTED',
  last_connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_drive_connections_id_user_id_key unique (id, user_id),
  constraint google_drive_connections_user_id_key unique (user_id),
  constraint google_drive_connections_provider_check check (provider = 'google_drive'),
  constraint google_drive_connections_status_check check (status in ('CONNECTED', 'DISCONNECTED', 'ERROR')),
  constraint google_drive_connections_token_required_check check (
    status <> 'CONNECTED' or encrypted_refresh_token is not null
  )
);

alter table public.drive_items
  add column if not exists checksum text,
  add column if not exists drive_modified_at timestamptz;

alter table public.google_drive_connections enable row level security;

revoke all on public.google_drive_connections from authenticated;
grant select, insert, update on public.google_drive_connections to authenticated;
revoke all on public.google_drive_connections from anon;

drop trigger if exists set_google_drive_connections_updated_at on public.google_drive_connections;
create trigger set_google_drive_connections_updated_at
before update on public.google_drive_connections
for each row
execute function public.set_updated_at();

create index google_drive_connections_user_status_idx
  on public.google_drive_connections (user_id, status);

create index drive_items_user_drive_modified_idx
  on public.drive_items (user_id, drive_modified_at)
  where drive_modified_at is not null;

create policy "google_drive_connections_select_own" on public.google_drive_connections
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "google_drive_connections_insert_own" on public.google_drive_connections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "google_drive_connections_update_own" on public.google_drive_connections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

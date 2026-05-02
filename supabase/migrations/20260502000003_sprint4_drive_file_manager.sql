begin;

create type public.drive_item_type as enum ('FILE', 'FOLDER');

create type public.drive_item_purpose as enum (
  'ROOT_FOLDER',
  'ADMIN_FOLDER',
  'PRODUCT_FOLDER',
  'SOURCE_IMAGE',
  'I2I_RESULT',
  'I2V_PROMPT_EXPORT',
  'RAW_CLIP',
  'FINAL_VIDEO',
  'BATCH_FOLDER',
  'IMPORT_FOLDER',
  'EXPORT_FILE',
  'UPLOAD_PACKAGE',
  'UNMATCHED_FILE',
  'OTHER'
);

create type public.drive_item_status as enum ('ACTIVE', 'ARCHIVED', 'NEEDS_REVIEW', 'UNMATCHED', 'ERROR');

create table public.drive_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type public.drive_item_type not null,
  drive_item_id text null,
  parent_id uuid null,
  parent_drive_item_id text null,
  name text not null,
  drive_url text not null,
  drive_path text not null,
  mime_type text,
  size_bytes bigint,
  purpose public.drive_item_purpose not null default 'OTHER',
  status public.drive_item_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drive_items_id_user_id_key unique (id, user_id),
  constraint drive_items_parent_id_user_id_fkey
    foreign key (parent_id, user_id)
    references public.drive_items(id, user_id),
  constraint drive_items_name_check check (btrim(name) <> ''),
  constraint drive_items_drive_url_check check (btrim(drive_url) <> ''),
  constraint drive_items_drive_path_check check (btrim(drive_path) <> ''),
  constraint drive_items_size_bytes_check check (size_bytes is null or size_bytes >= 0)
);

create unique index drive_items_user_drive_item_id_key
  on public.drive_items (user_id, drive_item_id)
  where drive_item_id is not null;

alter table public.drive_items enable row level security;

grant select, insert, update on public.drive_items to authenticated;

drop trigger if exists set_drive_items_updated_at on public.drive_items;
create trigger set_drive_items_updated_at
before update on public.drive_items
for each row
execute function public.set_updated_at();

create index drive_items_user_id_idx on public.drive_items (user_id);

create index drive_items_parent_id_idx on public.drive_items (parent_id);

create index drive_items_user_status_purpose_idx on public.drive_items (user_id, status, purpose);

create index drive_items_user_item_type_idx on public.drive_items (user_id, item_type);

create policy "drive_items_select_own" on public.drive_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "drive_items_insert_own" on public.drive_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "drive_items_update_own" on public.drive_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

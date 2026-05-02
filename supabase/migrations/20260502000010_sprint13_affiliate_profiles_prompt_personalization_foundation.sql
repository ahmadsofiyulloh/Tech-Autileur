begin;

create type public.affiliate_platform as enum (
  'TIKTOK',
  'SHOPEE',
  'OTHER'
);

create type public.affiliate_profile_status as enum (
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

create table public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  profile_code text not null,
  profile_name text not null,
  platform public.affiliate_platform not null default 'TIKTOK',
  account_label text,
  niche text,
  affiliate_url text,
  notes text,
  i2i_prompt_rules text not null default '',
  i2v_prompt_rules text not null default '',
  caption_rules text not null default '',
  hashtag_rules text not null default '',
  negative_prompt_rules text not null default '',
  product_positioning_notes text not null default '',
  lock_seed_character boolean not null default false,
  seed_character_notes text not null default '',
  seed_character_drive_item_ref_id uuid null,
  lock_environment boolean not null default false,
  environment_notes text not null default '',
  environment_drive_item_ref_id uuid null,
  status public.affiliate_profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliate_profiles_id_user_id_key unique (id, user_id),
  constraint affiliate_profiles_user_profile_code_key unique (user_id, profile_code),

  constraint affiliate_profiles_workspace_user_fkey
    foreign key (workspace_id, user_id)
    references public.workspaces(id, user_id),

  constraint affiliate_profiles_seed_character_drive_user_fkey
    foreign key (seed_character_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),

  constraint affiliate_profiles_environment_drive_user_fkey
    foreign key (environment_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),

  constraint affiliate_profiles_profile_code_check check (btrim(profile_code) <> ''),
  constraint affiliate_profiles_profile_name_check check (btrim(profile_name) <> ''),
  constraint affiliate_profiles_affiliate_url_check check (
    affiliate_url is null or btrim(affiliate_url) <> ''
  )
);

alter table public.affiliate_profiles enable row level security;

grant select, insert, update on public.affiliate_profiles to authenticated;

drop trigger if exists set_affiliate_profiles_updated_at on public.affiliate_profiles;
create trigger set_affiliate_profiles_updated_at
before update on public.affiliate_profiles
for each row
execute function public.set_updated_at();

create index affiliate_profiles_user_workspace_idx
  on public.affiliate_profiles (user_id, workspace_id);

create index affiliate_profiles_user_status_idx
  on public.affiliate_profiles (user_id, status);

create index affiliate_profiles_user_platform_idx
  on public.affiliate_profiles (user_id, platform);

create policy "affiliate_profiles_select_own" on public.affiliate_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "affiliate_profiles_insert_own" on public.affiliate_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "affiliate_profiles_update_own" on public.affiliate_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

begin;

create type public.marketplace_platform as enum ('SHOPEE', 'TIKTOK');

create type public.intake_status as enum (
  'DRAFT',
  'SUBMITTED',
  'NEEDS_REVIEW',
  'REVIEWED',
  'ANCHOR_READY',
  'ARCHIVED',
  'ERROR'
);

create type public.marketplace_source_status as enum (
  'DRAFT',
  'ACTIVE',
  'NEEDS_REVIEW',
  'ARCHIVED',
  'ERROR'
);

create type public.product_anchor_status as enum (
  'DRAFT',
  'READY',
  'USED_FOR_PROMPT',
  'ARCHIVED',
  'ERROR'
);

create table public.product_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid null,
  intake_code text not null,
  product_title text,
  shopee_url text,
  tiktok_url text,
  product_photo_drive_item_ref_id uuid null,
  screenshot_drive_item_ref_id uuid null,
  raw_notes text,
  parsed_metadata_json jsonb,
  reviewed_metadata_json jsonb,
  status public.intake_status not null default 'DRAFT',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_intake_sessions_id_user_id_key unique (id, user_id),
  constraint product_intake_sessions_user_intake_code_key unique (user_id, intake_code),
  constraint product_intake_sessions_intake_code_check check (btrim(intake_code) <> ''),
  constraint product_intake_sessions_product_title_check check (product_title is null or btrim(product_title) <> ''),
  constraint product_intake_sessions_shopee_url_check check (shopee_url is null or btrim(shopee_url) <> ''),
  constraint product_intake_sessions_tiktok_url_check check (tiktok_url is null or btrim(tiktok_url) <> ''),
  constraint product_intake_sessions_raw_notes_check check (raw_notes is null or btrim(raw_notes) <> ''),
  constraint product_intake_sessions_has_input_check check (
    nullif(btrim(coalesce(product_title, '')), '') is not null
    or nullif(btrim(coalesce(shopee_url, '')), '') is not null
    or nullif(btrim(coalesce(tiktok_url, '')), '') is not null
    or product_photo_drive_item_ref_id is not null
    or screenshot_drive_item_ref_id is not null
    or nullif(btrim(coalesce(raw_notes, '')), '') is not null
  ),
  constraint pis_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint pis_photo_drive_user_fkey
    foreign key (product_photo_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),
  constraint pis_screenshot_drive_user_fkey
    foreign key (screenshot_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id)
);

create table public.product_marketplace_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  platform public.marketplace_platform not null,
  product_url text,
  affiliate_url text,
  title text,
  category text,
  rating_text text,
  sold_count_text text,
  price_text text,
  shop_name text,
  screenshot_drive_item_ref_id uuid null,
  parsed_metadata_json jsonb,
  status public.marketplace_source_status not null default 'DRAFT',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_marketplace_sources_id_user_id_key unique (id, user_id),
  constraint product_marketplace_sources_user_product_platform_key unique (user_id, product_id, platform),
  constraint product_marketplace_sources_url_or_title_check check (
    nullif(btrim(coalesce(product_url, '')), '') is not null
    or nullif(btrim(coalesce(title, '')), '') is not null
  ),
  constraint pms_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint pms_screenshot_drive_user_fkey
    foreign key (screenshot_drive_item_ref_id, user_id)
    references public.drive_items(id, user_id)
);

create table public.product_anchors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  intake_session_id uuid null,
  source_product_image_id uuid null,
  anchor_code text not null,
  version int not null default 1,
  anchor_json jsonb,
  vision_analysis_json jsonb,
  marketplace_summary_json jsonb,
  status public.product_anchor_status not null default 'DRAFT',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_anchors_id_user_id_key unique (id, user_id),
  constraint product_anchors_user_anchor_code_version_key unique (user_id, anchor_code, version),
  constraint product_anchors_version_check check (version >= 1),
  constraint product_anchors_anchor_code_check check (btrim(anchor_code) <> ''),
  constraint pa_product_user_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint pa_intake_user_fkey
    foreign key (intake_session_id, user_id)
    references public.product_intake_sessions(id, user_id),
  constraint pa_source_image_user_product_fkey
    foreign key (source_product_image_id, user_id, product_id)
    references public.product_images(id, user_id, product_id)
);

alter table public.product_intake_sessions enable row level security;
alter table public.product_marketplace_sources enable row level security;
alter table public.product_anchors enable row level security;

grant select, insert, update on public.product_intake_sessions to authenticated;
grant select, insert, update on public.product_marketplace_sources to authenticated;
grant select, insert, update on public.product_anchors to authenticated;

drop trigger if exists set_product_intake_sessions_updated_at on public.product_intake_sessions;
create trigger set_product_intake_sessions_updated_at
before update on public.product_intake_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists set_product_marketplace_sources_updated_at on public.product_marketplace_sources;
create trigger set_product_marketplace_sources_updated_at
before update on public.product_marketplace_sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_product_anchors_updated_at on public.product_anchors;
create trigger set_product_anchors_updated_at
before update on public.product_anchors
for each row
execute function public.set_updated_at();

create index product_intake_sessions_user_id_idx
  on public.product_intake_sessions (user_id);

create index product_intake_sessions_user_status_created_at_idx
  on public.product_intake_sessions (user_id, status, created_at desc);

create index product_intake_sessions_user_product_idx
  on public.product_intake_sessions (user_id, product_id)
  where product_id is not null;

create index product_intake_sessions_photo_ref_idx
  on public.product_intake_sessions (user_id, product_photo_drive_item_ref_id)
  where product_photo_drive_item_ref_id is not null;

create index product_intake_sessions_screenshot_ref_idx
  on public.product_intake_sessions (user_id, screenshot_drive_item_ref_id)
  where screenshot_drive_item_ref_id is not null;

create index product_marketplace_sources_user_id_idx
  on public.product_marketplace_sources (user_id);

create index product_marketplace_sources_user_product_idx
  on public.product_marketplace_sources (user_id, product_id);

create index product_marketplace_sources_user_status_idx
  on public.product_marketplace_sources (user_id, status);

create index product_marketplace_sources_user_platform_idx
  on public.product_marketplace_sources (user_id, platform);

create index product_marketplace_sources_screenshot_ref_idx
  on public.product_marketplace_sources (user_id, screenshot_drive_item_ref_id)
  where screenshot_drive_item_ref_id is not null;

create index product_anchors_user_id_idx
  on public.product_anchors (user_id);

create index product_anchors_user_product_idx
  on public.product_anchors (user_id, product_id);

create index product_anchors_user_status_idx
  on public.product_anchors (user_id, status);

create index product_anchors_user_intake_idx
  on public.product_anchors (user_id, intake_session_id)
  where intake_session_id is not null;

create index product_anchors_user_source_image_idx
  on public.product_anchors (user_id, source_product_image_id)
  where source_product_image_id is not null;

create policy "product_intake_sessions_select_own" on public.product_intake_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "product_intake_sessions_insert_own" on public.product_intake_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "product_intake_sessions_update_own" on public.product_intake_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "product_marketplace_sources_select_own" on public.product_marketplace_sources
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "product_marketplace_sources_insert_own" on public.product_marketplace_sources
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "product_marketplace_sources_update_own" on public.product_marketplace_sources
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "product_anchors_select_own" on public.product_anchors
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "product_anchors_insert_own" on public.product_anchors
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "product_anchors_update_own" on public.product_anchors
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

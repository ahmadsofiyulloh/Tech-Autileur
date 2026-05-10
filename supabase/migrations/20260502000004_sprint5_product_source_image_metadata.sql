begin;

create type public.product_status as enum (
  'DRAFT',
  'IMAGE_ATTACHED',
  'IMAGE_ANALYZED',
  'PROMPT_READY',
  'IN_PRODUCTION',
  'READY_FOR_UPLOAD',
  'UPLOADED',
  'ARCHIVED'
);

create type public.product_image_status as enum (
  'ATTACHED',
  'ANALYZED',
  'REPLACED',
  'ARCHIVED',
  'ERROR'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  product_name text not null,
  niche text,
  marketplace text,
  marketplace_product_link text,
  status public.product_status not null default 'DRAFT',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_id_user_id_key unique (id, user_id),
  constraint products_user_product_code_key unique (user_id, product_code),
  constraint products_product_code_check check (btrim(product_code) <> ''),
  constraint products_product_name_check check (btrim(product_name) <> '')
);

alter table public.products enable row level security;

grant select, insert, update on public.products to authenticated;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create index products_user_id_idx on public.products (user_id);

create index products_user_status_idx on public.products (user_id, status);

create index products_user_product_code_idx on public.products (user_id, product_code);

create policy "products_select_own" on public.products
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "products_insert_own" on public.products
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "products_update_own" on public.products
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  drive_item_ref_id uuid not null,
  source_type text not null default 'GOOGLE_DRIVE',
  is_primary boolean not null default false,
  analysis_json jsonb,
  status public.product_image_status not null default 'ATTACHED',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_id_user_id_key unique (id, user_id),
  constraint product_images_id_user_product_id_key unique (id, user_id, product_id),
  constraint product_images_product_id_user_id_fkey
    foreign key (product_id, user_id)
    references public.products(id, user_id),
  constraint product_images_drive_item_ref_id_user_id_fkey
    foreign key (drive_item_ref_id, user_id)
    references public.drive_items(id, user_id),
  constraint product_images_user_product_drive_item_ref_key unique (user_id, product_id, drive_item_ref_id),
  constraint product_images_source_type_check check (source_type = 'GOOGLE_DRIVE')
);

create unique index product_images_one_primary_per_product_idx
  on public.product_images (user_id, product_id)
  where is_primary = true and status in ('ATTACHED', 'ANALYZED');

alter table public.product_images enable row level security;

grant select, insert, update on public.product_images to authenticated;

drop trigger if exists set_product_images_updated_at on public.product_images;
create trigger set_product_images_updated_at
before update on public.product_images
for each row
execute function public.set_updated_at();

create index product_images_user_id_idx on public.product_images (user_id);

create index product_images_product_id_idx on public.product_images (product_id);

create index product_images_drive_item_id_idx on public.product_images (drive_item_ref_id);

create policy "product_images_select_own" on public.product_images
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "product_images_insert_own" on public.product_images
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "product_images_update_own" on public.product_images
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

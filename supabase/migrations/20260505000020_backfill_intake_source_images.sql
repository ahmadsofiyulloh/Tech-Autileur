begin;

with latest_intake_photo as (
  select distinct on (s.user_id, s.product_id)
    s.user_id,
    s.product_id,
    s.product_photo_drive_item_ref_id as drive_item_ref_id
  from public.product_intake_sessions s
  join public.products p
    on p.id = s.product_id
   and p.user_id = s.user_id
  join public.drive_items d
    on d.id = s.product_photo_drive_item_ref_id
   and d.user_id = s.user_id
  where s.product_id is not null
    and s.product_photo_drive_item_ref_id is not null
    and not exists (
      select 1
      from public.product_images existing
      where existing.user_id = s.user_id
        and existing.product_id = s.product_id
    )
  order by s.user_id, s.product_id, s.updated_at desc, s.created_at desc, s.id desc
)
insert into public.product_images (
  user_id,
  product_id,
  drive_item_ref_id,
  source_type,
  is_primary,
  analysis_json,
  status,
  notes,
  created_at,
  updated_at
)
select
  user_id,
  product_id,
  drive_item_ref_id,
  'GOOGLE_DRIVE',
  true,
  null,
  'ATTACHED',
  'Backfilled from intake photo.',
  now(),
  now()
from latest_intake_photo
on conflict (user_id, product_id, drive_item_ref_id) do nothing;

commit;

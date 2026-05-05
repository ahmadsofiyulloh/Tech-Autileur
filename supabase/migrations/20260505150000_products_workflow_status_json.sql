begin;

alter table public.products
add column if not exists workflow_status_json jsonb not null default '{"video_generated": false, "uploaded_shopee": false, "uploaded_tiktok": false}'::jsonb;

commit;

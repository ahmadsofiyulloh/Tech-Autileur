begin;

create extension if not exists pg_trgm;

create index products_prompt_workbench_order_idx
  on public.products (user_id, workspace_id, created_at desc, id desc)
  where status <> 'ARCHIVED';

create index products_prompt_workbench_product_name_trgm_idx
  on public.products using gin (product_name gin_trgm_ops)
  where status <> 'ARCHIVED';

create index products_prompt_workbench_product_code_trgm_idx
  on public.products using gin (product_code gin_trgm_ops)
  where status <> 'ARCHIVED';

create index products_prompt_workbench_niche_trgm_idx
  on public.products using gin (niche gin_trgm_ops)
  where status <> 'ARCHIVED';

create index products_prompt_workbench_marketplace_trgm_idx
  on public.products using gin (marketplace gin_trgm_ops)
  where status <> 'ARCHIVED';

commit;

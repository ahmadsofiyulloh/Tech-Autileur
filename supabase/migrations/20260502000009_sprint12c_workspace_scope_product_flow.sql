begin;

alter table public.products
  add column workspace_id uuid null;

alter table public.product_intake_sessions
  add column workspace_id uuid null;

alter table public.product_marketplace_sources
  add column workspace_id uuid null;

alter table public.product_anchors
  add column workspace_id uuid null;

alter table public.products
  add constraint products_workspace_user_fkey
  foreign key (workspace_id, user_id)
  references public.workspaces(id, user_id);

alter table public.product_intake_sessions
  add constraint product_intake_sessions_workspace_user_fkey
  foreign key (workspace_id, user_id)
  references public.workspaces(id, user_id);

alter table public.product_marketplace_sources
  add constraint product_marketplace_sources_workspace_user_fkey
  foreign key (workspace_id, user_id)
  references public.workspaces(id, user_id);

alter table public.product_anchors
  add constraint product_anchors_workspace_user_fkey
  foreign key (workspace_id, user_id)
  references public.workspaces(id, user_id);

create index products_user_workspace_idx
  on public.products (user_id, workspace_id);

create index product_intake_sessions_user_workspace_idx
  on public.product_intake_sessions (user_id, workspace_id);

create index product_marketplace_sources_user_workspace_idx
  on public.product_marketplace_sources (user_id, workspace_id);

create index product_anchors_user_workspace_idx
  on public.product_anchors (user_id, workspace_id);

commit;

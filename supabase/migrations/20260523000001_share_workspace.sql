-- Migration: share_workspace
-- Creates share_product_links and share_generations tables for Share Workspace feature.
-- Spec: docs/superpowers/specs/2026-05-23-share-workspace-redesign.md

-- ============================================================
-- share_product_links
-- One affiliate URL per product per owner, used for CTA in Gemini caption output.
-- ============================================================

create table if not exists public.share_product_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  affiliate_url text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint share_product_links_user_product_unique unique (user_id, product_id)
);

alter table public.share_product_links enable row level security;

create policy "owner_all_share_product_links"
  on public.share_product_links
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
create trigger set_updated_at_share_product_links
  before update on public.share_product_links
  for each row execute function public.set_updated_at();

-- ============================================================
-- share_generations
-- Each generate call creates one batch row per product+platform.
-- output_json: array of { caption, angle, platform_specific_fields }
-- ============================================================

create table if not exists public.share_generations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  platform       text not null check (platform in ('facebook', 'threads', 'x', 'pinterest')),
  angle          text not null check (angle in (
                   'benefit_focused',
                   'problem_solution',
                   'social_proof',
                   'urgency_scarcity',
                   'educational',
                   'storytelling'
                 )),
  variant_count  integer not null check (variant_count between 1 and 4),
  output_json    jsonb,
  status         text not null default 'generating' check (status in ('generating', 'generated', 'error')),
  error_message  text,
  created_at     timestamptz not null default now()
);

alter table public.share_generations enable row level security;

create policy "owner_all_share_generations"
  on public.share_generations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Index for history query: per product per platform ordered by newest first
create index if not exists share_generations_history_idx
  on public.share_generations (user_id, product_id, platform, created_at desc);

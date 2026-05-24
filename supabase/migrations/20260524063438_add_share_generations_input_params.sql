-- Migration: add input_params to share_generations
-- Adds input_params jsonb column to persist platform-aware generate options.
-- Spec: docs/share-link-caption-generator-v1-plan.md (SHARE-V1-003a)

alter table public.share_generations
  add column input_params jsonb;

comment on column public.share_generations.input_params is 'Platform-aware generation options (tone, hashtag mode, character target, etc.) submitted via the generate form. Nullable for backward compatibility with existing rows.';

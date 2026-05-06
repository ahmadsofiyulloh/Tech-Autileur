begin;

alter table public.affiliate_profiles
  add column if not exists seed_character_analysis_json jsonb,
  add column if not exists environment_analysis_json jsonb;

comment on column public.affiliate_profiles.seed_character_analysis_json is
  'Cached JSON analysis for the locked seed character asset. Recomputed when the asset reference changes.';

comment on column public.affiliate_profiles.environment_analysis_json is
  'Cached JSON analysis for the locked environment asset. Recomputed when the asset reference changes.';

commit;

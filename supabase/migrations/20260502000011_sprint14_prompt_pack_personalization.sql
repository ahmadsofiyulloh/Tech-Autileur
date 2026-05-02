begin;

alter table public.prompt_packs
  add column if not exists intake_session_id uuid null,
  add column if not exists affiliate_profile_id uuid null,
  add column if not exists negative_rules_json jsonb null,
  add column if not exists personalization_json jsonb null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prompt_packs_intake_session_user_fkey'
  ) then
    alter table public.prompt_packs
      add constraint prompt_packs_intake_session_user_fkey
      foreign key (intake_session_id, user_id)
      references public.product_intake_sessions(id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'prompt_packs_affiliate_profile_user_fkey'
  ) then
    alter table public.prompt_packs
      add constraint prompt_packs_affiliate_profile_user_fkey
      foreign key (affiliate_profile_id, user_id)
      references public.affiliate_profiles(id, user_id);
  end if;
end $$;

create index if not exists prompt_packs_user_intake_session_idx
  on public.prompt_packs (user_id, intake_session_id);

commit;

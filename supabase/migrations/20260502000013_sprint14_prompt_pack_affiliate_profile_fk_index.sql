begin;

create index if not exists prompt_packs_affiliate_profile_user_idx
  on public.prompt_packs (affiliate_profile_id, user_id);

commit;

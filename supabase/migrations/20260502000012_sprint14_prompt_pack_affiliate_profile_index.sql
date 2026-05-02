begin;

create index if not exists prompt_packs_user_affiliate_profile_idx
  on public.prompt_packs (user_id, affiliate_profile_id);

commit;

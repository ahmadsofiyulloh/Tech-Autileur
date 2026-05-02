begin;

create index if not exists prompt_packs_affiliate_profile_id_idx
  on public.prompt_packs (affiliate_profile_id);

commit;

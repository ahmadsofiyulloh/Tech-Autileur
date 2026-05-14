begin;

alter table public.gemini_api_keys
  drop constraint if exists gemini_api_keys_model_name_check;

update public.gemini_api_keys
set
  rpm_limit = case model_name
    when 'gemini-3.1-flash-lite' then 15
    when 'gemini-3-flash' then 5
    when 'gemini-2.5-flash' then 5
    when 'gemini-2.5-flash-lite' then 10
    when 'gemini-2.5-pro' then 0
    when 'gemini-2.0-flash' then 0
    when 'gemini-3.1-pro' then 0
    else rpm_limit
  end,
  rpd_limit = case model_name
    when 'gemini-3.1-flash-lite' then 500
    when 'gemini-3-flash' then 20
    when 'gemini-2.5-flash' then 20
    when 'gemini-2.5-flash-lite' then 20
    when 'gemini-2.5-pro' then 0
    when 'gemini-2.0-flash' then 0
    when 'gemini-3.1-pro' then 0
    else rpd_limit
  end,
  tpm_limit = case model_name
    when 'gemini-3.1-flash-lite' then 250000
    when 'gemini-3-flash' then 250000
    when 'gemini-2.5-flash' then 250000
    when 'gemini-2.5-flash-lite' then 250000
    when 'gemini-2.5-pro' then 0
    when 'gemini-2.0-flash' then 0
    when 'gemini-3.1-pro' then 0
    else tpm_limit
  end,
  status = case
    when model_name in ('gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-3.1-pro') then 'DISABLED'::public.account_status
    else status
  end,
  cooldown_until = case
    when model_name in ('gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-3.1-pro') then null
    else cooldown_until
  end,
  updated_at = now()
where model_name in (
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-3.1-pro'
);

alter table public.gemini_api_keys
  add constraint gemini_api_keys_model_name_check
  check (
    model_name in (
      'gemini-3.1-flash-lite',
      'gemini-3-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-3.1-pro'
    )
  );

commit;

begin;

create type public.account_status as enum ('ACTIVE', 'COOLDOWN', 'RATE_LIMITED', 'DISABLED', 'ERROR');

create type public.gemini_key_role as enum (
  'VISION_ANALYSIS',
  'I2I_PROMPT',
  'I2V_PROMPT',
  'CONSISTENCY_CHECK',
  'PROMPT_REPAIR',
  'FALLBACK'
);

create table public.gemini_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_code text not null,
  label text not null,
  provider text not null default 'gemini',
  google_account_label text,
  project_label text,
  model_name text not null,
  role public.gemini_key_role not null,
  rpm_limit int,
  rpd_limit int,
  tpm_limit int,
  requests_today int not null default 0,
  last_used_at timestamptz,
  cooldown_until timestamptz,
  status public.account_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gemini_api_keys_id_user_id_key unique (id, user_id),
  constraint gemini_api_keys_user_key_code_key unique (user_id, key_code),
  constraint gemini_api_keys_provider_check check (provider = 'gemini'),
  constraint gemini_api_keys_model_name_check check (
    model_name in ('gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite')
  )
);

alter table public.gemini_api_keys enable row level security;

grant select, insert, update on public.gemini_api_keys to authenticated;

drop trigger if exists set_gemini_api_keys_updated_at on public.gemini_api_keys;
create trigger set_gemini_api_keys_updated_at
before update on public.gemini_api_keys
for each row
execute function public.set_updated_at();

create table public.gemini_api_key_secrets (
  id uuid primary key default gen_random_uuid(),
  gemini_api_key_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gemini_api_key_secrets_gemini_api_key_id_key unique (gemini_api_key_id),
  constraint gemini_api_key_secrets_gemini_api_key_owner_fkey
    foreign key (gemini_api_key_id, user_id)
    references public.gemini_api_keys(id, user_id)
    on delete cascade
);

alter table public.gemini_api_key_secrets enable row level security;

revoke all on public.gemini_api_key_secrets from authenticated;
revoke all on public.gemini_api_key_secrets from anon;

drop trigger if exists set_gemini_api_key_secrets_updated_at on public.gemini_api_key_secrets;
create trigger set_gemini_api_key_secrets_updated_at
before update on public.gemini_api_key_secrets
for each row
execute function public.set_updated_at();

create index gemini_api_keys_user_id_idx on public.gemini_api_keys (user_id);

create index gemini_api_key_secrets_user_id_idx on public.gemini_api_key_secrets (user_id);

create policy "gemini_api_keys_select_own" on public.gemini_api_keys
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "gemini_api_keys_insert_own" on public.gemini_api_keys
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "gemini_api_keys_update_own" on public.gemini_api_keys
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

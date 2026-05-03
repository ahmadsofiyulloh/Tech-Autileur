begin;

create table public.helper_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_code text not null,
  token_hash text not null,
  status text not null default 'ACTIVE',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helper_api_tokens_id_user_id_key unique (id, user_id),
  constraint helper_api_tokens_user_token_code_key unique (user_id, token_code),
  constraint helper_api_tokens_token_code_check check (btrim(token_code) <> ''),
  constraint helper_api_tokens_token_hash_check check (btrim(token_hash) <> '')
);

alter table public.helper_api_tokens enable row level security;

grant select, insert, update on public.helper_api_tokens to authenticated;
revoke all on public.helper_api_tokens from anon;

drop trigger if exists set_helper_api_tokens_updated_at on public.helper_api_tokens;
create trigger set_helper_api_tokens_updated_at
before update on public.helper_api_tokens
for each row
execute function public.set_updated_at();

create index helper_api_tokens_user_id_idx on public.helper_api_tokens (user_id);

create index helper_api_tokens_user_status_idx on public.helper_api_tokens (user_id, status);

create policy "helper_api_tokens_select_own" on public.helper_api_tokens
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "helper_api_tokens_insert_own" on public.helper_api_tokens
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "helper_api_tokens_update_own" on public.helper_api_tokens
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;

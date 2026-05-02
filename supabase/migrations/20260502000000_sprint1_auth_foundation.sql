begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create policy "profiles_select_own" on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

commit;

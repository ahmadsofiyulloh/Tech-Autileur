begin;

drop policy if exists "gemini_api_key_secrets_deny_all" on public.gemini_api_key_secrets;
create policy "gemini_api_key_secrets_deny_all"
on public.gemini_api_key_secrets
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

commit;

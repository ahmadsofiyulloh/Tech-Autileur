begin;

revoke all on public.google_drive_connections from authenticated;
grant select, insert, update on public.google_drive_connections to authenticated;
revoke all on public.google_drive_connections from anon;

commit;

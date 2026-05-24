-- Share Workspace Data API grants
-- Required because new public tables may not be exposed to Supabase Data API
-- unless authenticated role grants are explicit.

revoke all on public.share_product_links from anon;
revoke all on public.share_generations from anon;

grant select, insert, update on public.share_product_links to authenticated;
grant select, insert, update on public.share_generations to authenticated;

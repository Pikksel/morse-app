-- 2026-10-16: How many players have each badge (badges page: "X players have this").
-- Applied by Claude via the Supabase connection, after 015. Counts only, no names.

create or replace function public.get_badge_counts()
returns table (badge_id text, players bigint)
language sql stable security definer
set search_path = public
as $$
  select badge, count(*) from public.player_badges group by badge
$$;

grant execute on function public.get_badge_counts() to anon, authenticated;

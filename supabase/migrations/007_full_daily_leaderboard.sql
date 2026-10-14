-- 2026-10-14: daily leaderboard shows everyone who played that day (was top 10, max 100).
-- Run once in Supabase SQL Editor, after 006.

create or replace function public.get_daily_leaderboard(p_day date, p_limit int default null)
returns table (rank bigint, name text, guesses int, time_ms int)
language sql stable security definer
set search_path = public
as $$
  select rank() over (order by s.guesses, s.time_ms), p.name, s.guesses, s.time_ms
  from public.scores s join public.players p on p.id = s.player_id
  where s.day = p_day
  order by s.guesses, s.time_ms
  limit p_limit   -- null = everyone who played that day
$$;

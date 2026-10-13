-- 2026-10-13: live rank. Run once in Supabase SQL Editor, after 004.
-- submit_score returns the rank at the moment you finish; others can beat you later.
-- The results popup now asks for the current rank each time it opens.

-- A player's current rank for a day (null if they have no score that day).
create or replace function public.get_rank(p_name text, p_day date)
returns int
language sql stable security definer
set search_path = public
as $$
  select r::int from (
    select p.name, rank() over (order by s.guesses, s.time_ms) as r
    from public.scores s join public.players p on p.id = s.player_id
    where s.day = p_day
  ) t
  where name = upper(p_name)
$$;

grant execute on function public.get_rank(text, date) to anon, authenticated;

-- 2026-10-13: badge rule changes. Run once in Supabase SQL Editor, after 005.
-- - Regular: 5 games (was 10), Veteran: 14 (was 50), Old Timer: 30 (was 100)
-- - New: Turtle = solved a word after more than 5 minutes (300 000 ms)
-- Badges already earned stay earned.

create or replace function public._badges_earned(p_player uuid)
returns setof text
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select day, guesses, time_ms from public.scores where player_id = p_player
  ),
  play_runs as (
    select count(*) as len
    from (select day - (row_number() over (order by day))::int as grp from mine) t
    group by grp
  ),
  daily_rank as (
    select player_id, day, rank() over (partition by day order by guesses, time_ms) as r
    from public.scores
    where day < (now() at time zone 'utc')::date      -- finished days only
  ),
  tops as (
    select day from daily_rank where player_id = p_player and r = 1
  ),
  top_runs as (
    select count(*) as len
    from (select day - (row_number() over (order by day))::int as grp from tops) t
    group by grp
  )
  select 'first_contact'  where (select count(*) from mine) >= 1
  union all select 'regular'       where (select count(*) from mine) >= 5
  union all select 'veteran'       where (select count(*) from mine) >= 14
  union all select 'old_timer'     where (select count(*) from mine) >= 30
  union all select 'speed_demon'   where exists (select 1 from mine where guesses <= 4)
  union all select 'qrq'           where exists (select 1 from mine where guesses = 1)
  union all select 'never_give_up' where exists (select 1 from mine where guesses between 23 and 25)
  union all select 'turtle'        where exists (select 1 from mine where guesses <= 25 and time_ms > 300000)
  union all select 'streak_7'      where exists (select 1 from play_runs where len >= 7)
  union all select 'streak_30'     where exists (select 1 from play_runs where len >= 30)
  union all select 'top_band'      where exists (select 1 from tops)
  union all select 'week_champion' where exists (select 1 from top_runs where len >= 7)
$$;
revoke execute on function public._badges_earned(uuid) from public, anon, authenticated;

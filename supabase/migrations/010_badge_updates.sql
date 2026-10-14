-- 2026-10-14: badge updates. Applied by Claude via the Supabase connection, after 009.
-- - Week Champion: #1 on 5 finished days in a row (was 7)
-- - Turtle: solved after more than 8 minutes (was 5)
-- - Streak 7 -> Streak 5 (new id streak_5; everyone who had streak_7 keeps it as streak_5)
-- - New: Time to Go Home (missed the word 2 days in a row)
-- - New: Turbocharged (played a Turbo run)

update public.player_badges set badge = 'streak_5' where badge = 'streak_7';

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
  ),
  miss_runs as (                                        -- missed the word (26) on consecutive days
    select count(*) as len
    from (select day - (row_number() over (order by day))::int as grp from mine where guesses = 26) t
    group by grp
  )
  select 'first_contact'  where (select count(*) from mine) >= 1
  union all select 'regular'       where (select count(*) from mine) >= 5
  union all select 'veteran'       where (select count(*) from mine) >= 14
  union all select 'old_timer'     where (select count(*) from mine) >= 30
  union all select 'speed_demon'   where exists (select 1 from mine where guesses <= 4)
  union all select 'qrq'           where exists (select 1 from mine where guesses = 1)
  union all select 'never_give_up' where exists (select 1 from mine where guesses between 23 and 25)
  union all select 'turtle'        where exists (select 1 from mine where guesses <= 25 and time_ms > 480000)
  union all select 'streak_5'      where exists (select 1 from play_runs where len >= 5)
  union all select 'streak_30'     where exists (select 1 from play_runs where len >= 30)
  union all select 'top_band'      where exists (select 1 from tops)
  union all select 'week_champion' where exists (select 1 from top_runs where len >= 5)
  union all select 'time_to_go_home' where exists (select 1 from miss_runs where len >= 2)
  union all select 'turbocharged'  where exists (select 1 from public.turbo_runs where player_id = p_player)
$$;
revoke execute on function public._badges_earned(uuid) from public, anon, authenticated;

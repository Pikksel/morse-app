-- 2026-10-16: The day changes at 00:00 Swedish time (Europe/Stockholm) instead of 00:00 UTC.
-- Applied by Claude via the Supabase connection, after 014. Affects: which day a Daily score may be
-- submitted for, "finished days" for #1 badges, Easy Turbo days, and the Turbo "today" leaderboard.
-- Earlier days were stored as UTC dates and stay as they are.

-- Today's date in Sweden: a new Daily starts at 00:00 Swedish time (summer/winter time handled).
create or replace function public._today()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Stockholm')::date $$;
revoke execute on function public._today() from public, anon, authenticated;

create or replace function public.submit_score(
  p_name text, p_token text, p_day date, p_guesses int, p_time_ms int, p_mode text default 'normal'
)
returns int
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player uuid := public._player_id(p_name, p_token);
  v_rank   int;
begin
  if v_player is null then raise exception 'BAD_TOKEN'; end if;
  if p_day <> public._today() then raise exception 'WRONG_DAY'; end if;
  if p_mode = 'normal' and extract(isodow from p_day) >= 6 then raise exception 'WEEKEND'; end if;

  begin
    insert into public.scores (player_id, day, guesses, time_ms, mode)
    values (v_player, p_day, p_guesses, p_time_ms, p_mode);
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  select r into v_rank from (
    select player_id, rank() over (order by guesses, time_ms) as r
    from public.scores where day = p_day and mode = p_mode
  ) t where player_id = v_player;
  return v_rank;
end;
$$;

create or replace function public._badges_earned(p_player uuid)
returns setof text
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select day, guesses, time_ms from public.scores where player_id = p_player and mode = 'normal'
  ),
  weekdays as (                                         -- streaks: Monday–Friday only
    select day, guesses from mine where extract(isodow from day) < 6
  ),
  play_runs as (
    select count(*) as len
    from (select public._workday(day) - (row_number() over (order by day))::int as grp from weekdays) t
    group by grp
  ),
  daily_rank as (
    select player_id, day, rank() over (partition by day order by guesses, time_ms) as r
    from public.scores
    where mode = 'normal' and day < public._today()      -- finished days only
      and extract(isodow from day) < 6
  ),
  tops as (
    select day from daily_rank where player_id = p_player and r = 1
  ),
  top_runs as (
    select count(*) as len
    from (select public._workday(day) - (row_number() over (order by day))::int as grp from tops) t
    group by grp
  ),
  miss_runs as (
    select count(*) as len
    from (select public._workday(day) - (row_number() over (order by day))::int as grp from weekdays where guesses = 26) t
    group by grp
  ),
  easy_daily as (
    select day, guesses from public.scores where player_id = p_player and mode = 'easy'
  ),
  easy_turbo as (
    select score, (started_at at time zone 'Europe/Stockholm')::date as day from public.turbo_runs where player_id = p_player and mode = 'easy'
  ),
  easy_days as (
    select distinct day from (select day from easy_daily union all select day from easy_turbo) d
  ),
  easy_runs as (
    select count(*) as len
    from (select day - (row_number() over (order by day))::int as grp from easy_days) t
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
  union all select 'streak_3'      where exists (select 1 from play_runs where len >= 3)
  union all select 'streak_5'      where exists (select 1 from play_runs where len >= 5)
  union all select 'streak_10'     where exists (select 1 from play_runs where len >= 10)
  union all select 'streak_15'     where exists (select 1 from play_runs where len >= 15)
  union all select 'top_band'      where exists (select 1 from tops)
  union all select 'week_champion' where exists (select 1 from top_runs where len >= 5)
  union all select 'time_to_go_home' where exists (select 1 from miss_runs where len >= 2)
  union all select 'turbocharged'  where exists (select 1 from public.turbo_runs where player_id = p_player and mode = 'normal')
  -- 🐣 Easy badges
  union all select 'easy_hatchling'   where exists (select 1 from easy_daily) or exists (select 1 from easy_turbo)
  union all select 'easy_growing'     where (select count(*) from easy_daily) + (select count(*) from easy_turbo) >= 5
  union all select 'easy_brave_heart' where exists (select 1 from easy_daily where guesses = 26)
  union all select 'easy_bright_idea' where exists (select 1 from easy_daily where guesses between 6 and 25)
  union all select 'easy_slow_steady' where exists (select 1 from easy_runs where len >= 3)
  union all select 'easy_little_star' where exists (select 1 from easy_turbo where score >= 10)
$$;

create or replace function public.get_turbo_leaderboard(p_scope text default 'today', p_limit int default null, p_mode text default 'normal')
returns table (rank bigint, name text, score int)
language sql stable security definer
set search_path = public
as $$
  with best as (
    select distinct on (t.player_id) t.player_id, t.score, coalesce(t.ended_at, t.started_at) as reached
    from public.turbo_runs t
    where t.mode = p_mode
      and (p_scope = 'alltime' or (t.started_at at time zone 'Europe/Stockholm')::date = public._today())
    order by t.player_id, t.score desc, coalesce(t.ended_at, t.started_at)
  )
  select rank() over (order by b.score desc), p.name, b.score
  from best b join public.players p on p.id = b.player_id
  order by b.score desc, b.reached
  limit p_limit
$$;

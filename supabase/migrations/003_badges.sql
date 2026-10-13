-- 2026-10-12: badges. Run once in Supabase SQL Editor, after 002.
--
-- Badges are computed from `scores` and stored once earned (they stay even if a streak breaks).
-- "#1 of the day" badges only count finished days: today's #1 can still change.

create table if not exists public.player_badges (
  player_id  uuid not null references public.players(id) on delete cascade,
  badge      text not null,
  earned_at  timestamptz not null default now(),
  primary key (player_id, badge)
);
alter table public.player_badges enable row level security;
revoke all on public.player_badges from anon, authenticated;

-- Every badge a player currently qualifies for.
-- Streaks use "gaps and islands": day minus row_number() is constant within a run of consecutive days.
create or replace function public._badges_earned(p_player uuid)
returns setof text
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select day, guesses from public.scores where player_id = p_player
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
  union all select 'regular'       where (select count(*) from mine) >= 10
  union all select 'veteran'       where (select count(*) from mine) >= 50
  union all select 'old_timer'     where (select count(*) from mine) >= 100
  union all select 'speed_demon'   where exists (select 1 from mine where guesses <= 3)
  union all select 'qrq'           where exists (select 1 from mine where guesses = 1)
  union all select 'never_give_up' where exists (select 1 from mine where guesses between 19 and 21)
  union all select 'streak_7'      where exists (select 1 from play_runs where len >= 7)
  union all select 'streak_30'     where exists (select 1 from play_runs where len >= 30)
  union all select 'top_band'      where exists (select 1 from tops)
  union all select 'week_champion' where exists (select 1 from top_runs where len >= 7)
$$;
revoke execute on function public._badges_earned(uuid) from public, anon, authenticated;

-- Call after submit_score. Stores newly earned badges and returns only those (the "New badge!" list).
create or replace function public.award_badges(p_name text, p_token text)
returns table (new_badge text)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player uuid := public._player_id(p_name, p_token);
begin
  if v_player is null then raise exception 'BAD_TOKEN'; end if;
  return query
    with ins as (
      insert into public.player_badges (player_id, badge)
      select v_player, e.b from public._badges_earned(v_player) as e(b)
      on conflict do nothing
      returning player_badges.badge as b
    )
    select ins.b from ins;
end;
$$;

-- All badges of a player (public: for showing badges next to callsigns later).
create or replace function public.get_badges(p_name text)
returns table (badge_id text, earned_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select pb.badge, pb.earned_at
  from public.player_badges pb
  join public.players p on p.id = pb.player_id
  where p.name = upper(p_name)
  order by pb.earned_at
$$;

grant execute on function
  public.award_badges(text, text),
  public.get_badges(text)
to anon, authenticated;

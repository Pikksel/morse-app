-- Morse-web database schema
-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name ~ '^[A-Z0-9]{1,4}$'),
  password_hash   text,                       -- bcrypt of 4 dits/dahs, e.g. '.-.-'
  failed_attempts int not null default 0,
  locked_until    timestamptz,                -- 5 wrong logins lock for 15 minutes
  created_at  timestamptz not null default now()
);

-- One row per logged-in device. Only the token's hash is stored.
create table if not exists public.sessions (
  token_hash  text primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  day         date not null,
  guesses     int  not null check (guesses between 1 and 26), -- tries used; 26 = failed
  time_ms     int  not null check (time_ms > 0),
  created_at  timestamptz not null default now(),
  unique (player_id, day)
);

-- RLS on, no policies: the browser can't read or write tables directly.
-- Everything goes through the functions below.
alter table public.players enable row level security;
alter table public.scores  enable row level security;
alter table public.sessions enable row level security;
revoke all on public.players, public.scores, public.sessions from anon, authenticated;

-- ---------- Helpers ----------

create or replace function public._hash(p_token text)
returns text
language sql immutable
set search_path = public, extensions
as $$ select encode(digest(p_token, 'sha256'), 'hex') $$;

revoke execute on function public._hash(text) from public, anon, authenticated;

-- ---------- Public API (called with supabase.rpc) ----------

create or replace function public._player_id(p_name text, p_token text)
returns uuid
language sql stable security definer
set search_path = public, extensions
as $$
  select p.id
  from public.players p
  join public.sessions s on s.player_id = p.id
  where p.name = upper(p_name) and s.token_hash = public._hash(p_token)
$$;
revoke execute on function public._player_id(text, text) from public, anon, authenticated;

create or replace function public._new_session(p_player uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
begin
  insert into public.sessions (token_hash, player_id) values (public._hash(v_token), p_player);
  return v_token;
end;
$$;
revoke execute on function public._new_session(uuid) from public, anon, authenticated;

-- New player. Returns a session token, or raises NAME_TAKEN / INVALID_NAME / INVALID_PASSWORD.
create or replace function public.register(p_name text, p_password text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_password is null or p_password !~ '^[.-]{4}$' then
    raise exception 'INVALID_PASSWORD';
  end if;
  insert into public.players (name, password_hash)
  values (upper(p_name), crypt(p_password, gen_salt('bf')))
  returning id into v_id;
  return public._new_session(v_id);
exception
  when unique_violation then raise exception 'NAME_TAKEN';
  when check_violation  then raise exception 'INVALID_NAME';
end;
$$;

-- Returning player. Returns {"token": ...} or {"error": "BAD_LOGIN" | "LOCKED", ...}.
-- Errors are returned (not raised) so the failed-attempt counter is saved.
create or replace function public.login(p_name text, p_password text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.players;
begin
  select * into p from public.players where name = upper(p_name) for update;
  if not found or p.password_hash is null then
    return json_build_object('error', 'BAD_LOGIN');
  end if;

  if p.locked_until > now() then
    return json_build_object('error', 'LOCKED',
      'retry_after_s', ceil(extract(epoch from p.locked_until - now())));
  end if;

  if p.password_hash <> crypt(coalesce(p_password, ''), p.password_hash) then
    if p.failed_attempts + 1 >= 5 then
      update public.players
      set failed_attempts = 0, locked_until = now() + interval '15 minutes'
      where id = p.id;
    else
      update public.players set failed_attempts = p.failed_attempts + 1 where id = p.id;
    end if;
    return json_build_object('error', 'BAD_LOGIN');
  end if;

  update public.players set failed_attempts = 0, locked_until = null where id = p.id;
  return json_build_object('token', public._new_session(p.id));
end;
$$;

-- Ends this device's session.
create or replace function public.logout(p_name text, p_token text)
returns void
language sql security definer
set search_path = public, extensions
as $$
  delete from public.sessions s
  using public.players p
  where s.player_id = p.id and p.name = upper(p_name) and s.token_hash = public._hash(p_token)
$$;

-- Is this device's session still valid?
create or replace function public.verify_player(p_name text, p_token text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$ select public._player_id(p_name, p_token) is not null $$;

-- Submit today's result. Returns the player's rank for the day.
create or replace function public.submit_score(
  p_name text, p_token text, p_day date, p_guesses int, p_time_ms int
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
  if p_day <> (now() at time zone 'utc')::date then raise exception 'WRONG_DAY'; end if;

  begin
    insert into public.scores (player_id, day, guesses, time_ms)
    values (v_player, p_day, p_guesses, p_time_ms);
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  select r into v_rank from (
    select player_id, rank() over (order by guesses, time_ms) as r
    from public.scores where day = p_day
  ) t where player_id = v_player;
  return v_rank;
end;
$$;

-- Top N for one day: fewest guesses, then fastest.
create or replace function public.get_daily_leaderboard(p_day date, p_limit int default 10)
returns table (rank bigint, name text, guesses int, time_ms int)
language sql stable security definer
set search_path = public
as $$
  select rank() over (order by s.guesses, s.time_ms), p.name, s.guesses, s.time_ms
  from public.scores s join public.players p on p.id = s.player_id
  where s.day = p_day
  order by s.guesses, s.time_ms
  limit least(p_limit, 100)
$$;

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

-- All-time: average guesses, at least 3 games played.
create or replace function public.get_alltime_leaderboard(p_limit int default 10)
returns table (rank bigint, name text, games bigint, avg_guesses numeric)
language sql stable security definer
set search_path = public
as $$
  select rank() over (order by avg(s.guesses)), p.name, count(*), round(avg(s.guesses), 2)
  from public.scores s join public.players p on p.id = s.player_id
  group by p.name
  having count(*) >= 3
  order by avg(s.guesses), count(*) desc
  limit least(p_limit, 100)
$$;

grant execute on function
  public.register(text, text),
  public.login(text, text),
  public.logout(text, text),
  public.verify_player(text, text),
  public.submit_score(text, text, date, int, int),
  public.get_daily_leaderboard(date, int),
  public.get_alltime_leaderboard(int),
  public.get_rank(text, date)
to anon, authenticated;

-- ---------- Badges (stored once earned; "#1 of the day" counts finished days only) ----------

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

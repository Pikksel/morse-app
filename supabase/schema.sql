-- Morse-web database schema
-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name ~ '^[A-Z0-9]{1,4}$'),
  token_hash  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  day         date not null,
  guesses     int  not null check (guesses between 1 and 7),  -- 7 = failed
  time_ms     int  not null check (time_ms > 0),
  created_at  timestamptz not null default now(),
  unique (player_id, day)
);

-- RLS on, no policies: the browser can't read or write tables directly.
-- Everything goes through the functions below.
alter table public.players enable row level security;
alter table public.scores  enable row level security;
revoke all on public.players, public.scores from anon, authenticated;

-- ---------- Helpers ----------

create or replace function public._hash(p_token text)
returns text
language sql immutable
set search_path = public, extensions
as $$ select encode(digest(p_token, 'sha256'), 'hex') $$;

create or replace function public._player_id(p_name text, p_token text)
returns uuid
language sql stable security definer
set search_path = public, extensions
as $$
  select id from public.players
  where name = upper(p_name) and token_hash = public._hash(p_token)
$$;

revoke execute on function public._hash(text), public._player_id(text, text) from public, anon, authenticated;

-- ---------- Public API (called with supabase.rpc) ----------

-- Claim a name. Returns the secret token once, or raises NAME_TAKEN.
create or replace function public.claim_name(p_name text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
begin
  insert into public.players (name, token_hash)
  values (upper(p_name), public._hash(v_token));
  return v_token;
exception
  when unique_violation then raise exception 'NAME_TAKEN';
  when check_violation  then raise exception 'INVALID_NAME';
end;
$$;

-- Restore a name on a new device with the recovery code.
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
  public.claim_name(text),
  public.verify_player(text, text),
  public.submit_score(text, text, date, int, int),
  public.get_daily_leaderboard(date, int),
  public.get_alltime_leaderboard(int)
to anon, authenticated;

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

-- Turbo runs (one row per Turbo game; see the Turbo section for how it is played)
create table if not exists public.turbo_runs (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,                 -- null while playing (or abandoned)
  score           int not null default 0,
  halves          int not null default 6,      -- lives in half-hearts: 6 = 3 hearts, max 10
  fast_streak     int not null default 0,      -- fast correct answers in a row (3 = +1 half)
  letters         int not null default 0,      -- letters served so far
  current_letter  text,
  current_wpm     int,
  sent_at         timestamptz                  -- when the current letter was sent
);
create index if not exists turbo_runs_player_idx on public.turbo_runs (player_id);
create index if not exists turbo_runs_started_idx on public.turbo_runs (started_at);
alter table public.turbo_runs enable row level security;
revoke all on public.turbo_runs from anon, authenticated;

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

-- One day's leaderboard: fewest tries, then fastest. Everyone by default (p_limit null).
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

-- ---------- Turbo mode (server-checked: the DB picks letters, checks answers, keeps the score) ----------


-- ---------- Helpers (not callable from the browser) ----------

-- Morse code for A–Z.
create or replace function public._morse(c text)
returns text
language sql immutable
set search_path = ''
as $$
  select (array['.-','-...','-.-.','-..','.','..-.','--.','....','..','.---','-.-','.-..','--',
                '-.','---','.--.','--.-','.-.','...','-','..-','...-','.--','-..-','-.--','--..'])
         [ascii(upper(c)) - 64]
$$;

-- How long a letter sounds, in seconds: dot 1 unit, dash 3, gaps 1; one unit = 1.2 / wpm s.
create or replace function public._letter_seconds(c text, wpm int)
returns numeric
language sql immutable
set search_path = ''
as $$
  select ((length(replace(m, '-', '')) + 3 * (length(m) - length(replace(m, '-', ''))) + length(m) - 1)
          * 1.2 / wpm)::numeric
  from (select public._morse(c) as m) t
$$;

-- Speed: letters 1–3 at 10 WPM, then +1 WPM per correct answer, max 40.
create or replace function public._turbo_wpm(p_score int)
returns int
language sql immutable
set search_path = ''
as $$ select least(40, 10 + greatest(0, p_score - 2)) $$;

-- true if two Morse codes differ by exactly one symbol (changed, added or removed).
-- Used for "similar-sounding" wrong options, e.g. A .- / R .-. / W .--
create or replace function public._one_edit(a text, b text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  la int := length(a); lb int := length(b);
  i int := 1; j int := 1; diff int := 0;
begin
  if a = b or abs(la - lb) > 1 then return false; end if;
  while i <= la and j <= lb loop
    if substr(a, i, 1) = substr(b, j, 1) then
      i := i + 1; j := j + 1;
    else
      diff := diff + 1;
      if la > lb then i := i + 1;
      elsif lb > la then j := j + 1;
      else i := i + 1; j := j + 1;
      end if;
    end if;
  end loop;
  return diff + (la - i + 1) + (lb - j + 1) = 1;
end;
$$;

-- Random letter A–Z, never the same as the previous one.
create or replace function public._turbo_letter(p_prev text)
returns text
language plpgsql volatile
set search_path = ''
as $$
declare c text;
begin
  loop
    c := chr(65 + floor(random() * 26)::int);
    exit when c is distinct from p_prev;
  end loop;
  return c;
end;
$$;

-- The 3 answer buttons (shuffled): the right letter + 2 wrong ones.
-- Wrong ones are random until score 10, then similar-sounding when possible.
create or replace function public._turbo_options(p_letter text, p_score int)
returns text[]
language plpgsql volatile
set search_path = public
as $$
declare
  picks text[] := '{}';
  c text;
begin
  if p_score >= 10 then
    select coalesce((array_agg(l order by random()))[1:2], '{}') into picks
    from (select chr(64 + g) as l from generate_series(1, 26) g) t
    where l <> p_letter and public._one_edit(public._morse(l), public._morse(p_letter));
  end if;
  while coalesce(array_length(picks, 1), 0) < 2 loop
    c := chr(65 + floor(random() * 26)::int);
    if c <> p_letter and not (c = any(picks)) then picks := picks || c; end if;
  end loop;
  return (select array_agg(x order by random()) from unnest(picks || p_letter) as x);
end;
$$;

revoke execute on function
  public._morse(text), public._letter_seconds(text, int), public._turbo_wpm(int),
  public._one_edit(text, text), public._turbo_letter(text), public._turbo_options(text, int)
from public, anon, authenticated;

-- ---------- Public API ----------

-- Starts a run (and ends any run still open). Returns the first letter.
create or replace function public.turbo_start(p_name text, p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player uuid := public._player_id(p_name, p_token);
  v_letter text := public._turbo_letter(null);
  v_wpm    int  := public._turbo_wpm(0);
  v_id     uuid;
begin
  if v_player is null then raise exception 'BAD_TOKEN'; end if;
  update public.turbo_runs set ended_at = now() where player_id = v_player and ended_at is null;
  insert into public.turbo_runs (player_id, letters, current_letter, current_wpm, sent_at)
  values (v_player, 1, v_letter, v_wpm, now())
  returning id into v_id;
  return json_build_object(
    'run_id', v_id, 'score', 0, 'halves', 6, 'lives', 3, 'streak', 0,
    'next', json_build_object('letter', v_letter, 'wpm', v_wpm, 'options', public._turbo_options(v_letter, 0)));
end;
$$;

-- Answers the current letter. p_choice null = the timer ran out.
-- Too late (letter length + 0.4 s lead-in + 5 s + 2.5 s network slack) also counts as a miss.
create or replace function public.turbo_answer(p_name text, p_token text, p_run uuid, p_choice text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player  uuid := public._player_id(p_name, p_token);
  r         public.turbo_runs;
  v_secs    numeric;
  v_elapsed numeric;
  v_late    boolean;
  v_correct boolean;
  v_fast    boolean := false;
  v_bonus   boolean := false;   -- a fast streak was completed (+½ heart)
  v_capped  boolean := false;   -- …but hearts were already at the max
  v_answer  text;
  v_letter  text;
  v_wpm     int;
begin
  if v_player is null then raise exception 'BAD_TOKEN'; end if;
  select * into r from public.turbo_runs
  where id = p_run and player_id = v_player and ended_at is null
  for update;
  if not found then raise exception 'NO_RUN'; end if;

  v_answer  := r.current_letter;
  v_secs    := public._letter_seconds(r.current_letter, r.current_wpm) + 0.4;
  v_elapsed := extract(epoch from now() - r.sent_at);
  v_late    := v_elapsed > v_secs + 5 + 2.5;
  v_correct := p_choice is not null and upper(p_choice) = r.current_letter and not v_late;

  if v_correct then
    r.score := r.score + 1;
    v_fast := v_elapsed <= v_secs + 2 + 0.6;
    r.fast_streak := case when v_fast then r.fast_streak + 1 else 0 end;
    if r.fast_streak >= 3 then
      r.fast_streak := 0;
      v_bonus := true;
      v_capped := r.halves >= 10;
      r.halves := least(10, r.halves + 1);
    end if;
  else
    r.halves := r.halves - 2;
    r.fast_streak := 0;
  end if;

  if r.halves <= 0 then
    update public.turbo_runs
    set score = r.score, halves = 0, fast_streak = 0, ended_at = now(), current_letter = null, sent_at = null
    where id = r.id;
    return json_build_object('correct', v_correct, 'fast', v_fast, 'bonus', false, 'capped', false,
                             'answer', v_answer, 'late', v_late, 'score', r.score,
                             'halves', 0, 'lives', 0, 'streak', 0, 'over', true);
  end if;

  v_letter := public._turbo_letter(v_answer);
  v_wpm    := public._turbo_wpm(r.score);
  update public.turbo_runs
  set score = r.score, halves = r.halves, fast_streak = r.fast_streak, letters = r.letters + 1,
      current_letter = v_letter, current_wpm = v_wpm, sent_at = now()
  where id = r.id;
  return json_build_object(
    'correct', v_correct, 'fast', v_fast, 'bonus', v_bonus, 'capped', v_capped,
    'answer', v_answer, 'late', v_late, 'score', r.score,
    'halves', r.halves, 'lives', r.halves / 2.0, 'streak', r.fast_streak, 'over', false,
    'next', json_build_object('letter', v_letter, 'wpm', v_wpm, 'options', public._turbo_options(v_letter, r.score)));
end;
$$;

-- Best Turbo score per player. p_scope 'today' (runs started today, UTC) or 'alltime'.
-- Ties: whoever got there first.
create or replace function public.get_turbo_leaderboard(p_scope text default 'today', p_limit int default null)
returns table (rank bigint, name text, score int)
language sql stable security definer
set search_path = public
as $$
  with best as (
    select distinct on (t.player_id) t.player_id, t.score, coalesce(t.ended_at, t.started_at) as reached
    from public.turbo_runs t
    where p_scope = 'alltime' or (t.started_at at time zone 'utc')::date = (now() at time zone 'utc')::date
    order by t.player_id, t.score desc, coalesce(t.ended_at, t.started_at)
  )
  select rank() over (order by b.score desc), p.name, b.score
  from best b join public.players p on p.id = b.player_id
  order by b.score desc, b.reached
  limit p_limit
$$;

-- A player's best Turbo scores and ranks (null if no runs).
create or replace function public.get_turbo_best(p_name text)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'today',        (select score from public.get_turbo_leaderboard('today')   where name = upper(p_name)),
    'today_rank',   (select rank  from public.get_turbo_leaderboard('today')   where name = upper(p_name)),
    'alltime',      (select score from public.get_turbo_leaderboard('alltime') where name = upper(p_name)),
    'alltime_rank', (select rank  from public.get_turbo_leaderboard('alltime') where name = upper(p_name))
  )
$$;

grant execute on function
  public.turbo_start(text, text),
  public.turbo_answer(text, text, uuid, text),
  public.get_turbo_leaderboard(text, int),
  public.get_turbo_best(text)
to anon, authenticated;

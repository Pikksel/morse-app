-- 2026-10-14: Turbo mode. One letter plays once, pick it from 3 options, 3 lives.
-- Server-checked: the database picks every letter, checks every answer, keeps the score
-- and enforces the answer timer, so scores can't be faked by editing the browser.

create table if not exists public.turbo_runs (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,                 -- null while playing (or abandoned)
  score           int not null default 0,
  lives           int not null default 3,
  letters         int not null default 0,      -- letters served so far
  current_letter  text,
  current_wpm     int,
  sent_at         timestamptz                  -- when the current letter was sent
);
create index if not exists turbo_runs_player_idx on public.turbo_runs (player_id);
create index if not exists turbo_runs_started_idx on public.turbo_runs (started_at);
alter table public.turbo_runs enable row level security;
revoke all on public.turbo_runs from anon, authenticated;

-- ---------- Helpers (not callable from the browser) ----------

-- Morse code for A–Z.
create or replace function public._morse(c text)
returns text
language sql immutable
as $$
  select (array['.-','-...','-.-.','-..','.','..-.','--.','....','..','.---','-.-','.-..','--',
                '-.','---','.--.','--.-','.-.','...','-','..-','...-','.--','-..-','-.--','--..'])
         [ascii(upper(c)) - 64]
$$;

-- How long a letter sounds, in seconds: dot 1 unit, dash 3, gaps 1; one unit = 1.2 / wpm s.
create or replace function public._letter_seconds(c text, wpm int)
returns numeric
language sql immutable
as $$
  select ((length(replace(m, '-', '')) + 3 * (length(m) - length(replace(m, '-', ''))) + length(m) - 1)
          * 1.2 / wpm)::numeric
  from (select public._morse(c) as m) t
$$;

-- Speed: letters 1–3 at 10 WPM, then +1 WPM per correct answer, max 40.
create or replace function public._turbo_wpm(p_score int)
returns int
language sql immutable
as $$ select least(40, 10 + greatest(0, p_score - 2)) $$;

-- true if two Morse codes differ by exactly one symbol (changed, added or removed).
-- Used for "similar-sounding" wrong options, e.g. A .- / R .-. / W .--
create or replace function public._one_edit(a text, b text)
returns boolean
language plpgsql immutable
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
    'run_id', v_id, 'score', 0, 'lives', 3,
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
  v_late    boolean;
  v_correct boolean;
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
  v_late    := extract(epoch from now() - r.sent_at)
               > public._letter_seconds(r.current_letter, r.current_wpm) + 0.4 + 5 + 2.5;
  v_correct := p_choice is not null and upper(p_choice) = r.current_letter and not v_late;

  if v_correct then r.score := r.score + 1; else r.lives := r.lives - 1; end if;

  if r.lives <= 0 then
    update public.turbo_runs
    set score = r.score, lives = 0, ended_at = now(), current_letter = null, sent_at = null
    where id = r.id;
    return json_build_object('correct', v_correct, 'answer', v_answer, 'late', v_late,
                             'score', r.score, 'lives', 0, 'over', true);
  end if;

  v_letter := public._turbo_letter(v_answer);
  v_wpm    := public._turbo_wpm(r.score);
  update public.turbo_runs
  set score = r.score, lives = r.lives, letters = r.letters + 1,
      current_letter = v_letter, current_wpm = v_wpm, sent_at = now()
  where id = r.id;
  return json_build_object(
    'correct', v_correct, 'answer', v_answer, 'late', v_late,
    'score', r.score, 'lives', r.lives, 'over', false,
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

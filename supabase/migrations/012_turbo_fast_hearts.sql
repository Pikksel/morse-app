-- 2026-10-15: Turbo fast bonus. Applied by Claude via the Supabase connection, after 011.
-- - Lives are now counted in half-hearts: `halves` (3 hearts = 6, max 5 hearts = 10).
-- - "Fast" = correct within 2 s after the letter finished playing (+0.6 s network slack).
-- - 3 fast correct answers in a row = +1 half-heart (max 10). Slow/wrong/timeout resets the streak.
-- - A wrong answer or timeout still costs a whole heart (2 halves).
-- Responses keep `lives` (= halves / 2, e.g. 2.5) so an old open browser tab doesn't break.

alter table public.turbo_runs
  add column if not exists halves int not null default 6,
  add column if not exists fast_streak int not null default 0;
update public.turbo_runs set halves = lives * 2 where ended_at is null; -- open runs keep their hearts
alter table public.turbo_runs drop column if exists lives;

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
-- Late (letter + 0.4 s lead-in + 5 s + 2.5 s slack) = miss. Fast (letter + 0.4 + 2 + 0.6 s) builds the streak.
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

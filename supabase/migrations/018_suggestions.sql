-- 2026-10-26: 💡 Suggestions from players (text box in the results popup).
-- Players send with submit_suggestion (max 500 characters, 3 per day).
-- Only admins (DAW1) can read them, on …/sugg/ (get_suggestions).
-- Applied by Claude via the Supabase connection, after 017.

alter table public.players add column if not exists is_admin boolean not null default false;
update public.players set is_admin = true where name = 'DAW1';

create table if not exists public.suggestions (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  mode        text not null default 'normal' check (mode in ('normal', 'easy')),
  created_at  timestamptz not null default now()
);
create index if not exists suggestions_player_idx on public.suggestions (player_id, created_at);
alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;

create or replace function public.submit_suggestion(p_name text, p_token text, p_body text, p_mode text default 'normal')
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player uuid := public._player_id(p_name, p_token);
  v_body   text := btrim(p_body);
begin
  if v_player is null then raise exception 'BAD_TOKEN'; end if;
  if v_body is null or char_length(v_body) not between 1 and 500 then raise exception 'BAD_LENGTH'; end if;
  if p_mode not in ('normal', 'easy') then raise exception 'BAD_MODE'; end if;
  if (select count(*) from public.suggestions s
      where s.player_id = v_player
        and (s.created_at at time zone 'Europe/Stockholm')::date = public._today()) >= 3 then
    raise exception 'TOO_MANY';
  end if;
  insert into public.suggestions (player_id, body, mode) values (v_player, v_body, p_mode);
end;
$$;
grant execute on function public.submit_suggestion(text, text, text, text) to anon, authenticated;

-- Admins only: every suggestion, newest first.
create or replace function public.get_suggestions(p_name text, p_token text)
returns table (id bigint, name text, body text, mode text, created_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players p
                 where p.id = public._player_id(p_name, p_token) and p.is_admin) then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    select s.id, p.name, s.body, s.mode, s.created_at
    from public.suggestions s join public.players p on p.id = s.player_id
    order by s.created_at desc;
end;
$$;
grant execute on function public.get_suggestions(text, text) to anon, authenticated;

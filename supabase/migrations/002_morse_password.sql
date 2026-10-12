-- 2026-10-12: callsign + Morse password login (replaces the one-time recovery code).
-- Run once in Supabase SQL Editor, after 001.
--
-- Passwords: 4 symbols of '.' or '-' (16 combinations), so logins are rate limited:
-- 5 wrong tries lock the callsign for 15 minutes. Passwords are stored as bcrypt hashes.
-- Each login creates a session token (only its hash is stored), so one player
-- can be logged in on several devices.

-- ---------- Players: password + lockout ----------
alter table public.players
  add column if not exists password_hash   text,
  add column if not exists failed_attempts int not null default 0,
  add column if not exists locked_until    timestamptz;

-- ---------- Sessions ----------
create table if not exists public.sessions (
  token_hash  text primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.sessions enable row level security;
revoke all on public.sessions from anon, authenticated;

-- Existing browsers stay logged in: move old tokens into sessions.
insert into public.sessions (token_hash, player_id)
select token_hash, id from public.players
on conflict do nothing;

alter table public.players drop column if exists token_hash;
drop function if exists public.claim_name(text);

-- Optional: remove test callsigns (they have no password, so they can't log in elsewhere).
-- delete from public.players;

-- ---------- Functions ----------

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

grant execute on function
  public.register(text, text),
  public.login(text, text),
  public.logout(text, text)
to anon, authenticated;

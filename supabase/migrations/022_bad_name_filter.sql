-- 2026-10-29: 🚫 Basic bad-word filter for new callsigns (two players registered ANAL and GAY; both deleted).
-- register() refuses names on this list with BAD_NAME. Exact matches only: callsigns are 1–4 characters,
-- and partial matching would block ordinary names like BASS or PASS. Add words to the array to block more.
-- Applied by Claude via the Supabase connection, after 021.

create or replace function public._is_bad_name(p_name text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select upper(coalesce(p_name, '')) = any (array[
    -- English: sexual, insults, slurs
    'ANAL', 'ANUS', 'ARSE', 'ASS', 'ASSH', 'BOOB', 'BICH', 'BTCH', 'COCK', 'COON', 'CUM', 'CUMS', 'CUNT',
    'DICK', 'DIKE', 'DYKE', 'FAG', 'FAGS', 'FAGG', 'FCK', 'FCUK', 'FUCK', 'FUK', 'FUKK', 'GAY', 'GAYS',
    'HOE', 'HOES', 'HOMO', 'JIZZ', 'KIKE', 'KKK', 'NAZI', 'NIG', 'NIGA', 'NIGG', 'NEGR', 'PEDO', 'PENI',
    'PISS', 'PORN', 'PUSS', 'RAPE', 'SEX', 'SEXY', 'SHIT', 'SLUT', 'SPIC', 'TIT', 'TITS', 'TWAT', 'WANK', 'WHOR',
    'HITL', 'SS88', '1488',
    -- Swedish
    'KUK', 'FITT', 'FITA', 'HORA', 'KNUL', 'BOGE',
    -- leet spellings
    'A55', '455', 'AN4L', '4NAL', '5EX', 'S3X', 'SH1T', 'D1CK', 'C0CK', 'F4G', 'G4Y', 'N1G', 'N1GG', 'T1TS', 'FVCK', 'KUNT'
  ])
$$;
revoke execute on function public._is_bad_name(text) from public, anon, authenticated;

-- Same as 002, plus the bad-name check first.
create or replace function public.register(p_name text, p_password text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if public._is_bad_name(p_name) then
    raise exception 'BAD_NAME';
  end if;
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

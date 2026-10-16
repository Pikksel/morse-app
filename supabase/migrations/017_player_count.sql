-- 2026-10-16: Total number of players (welcome box: "29 players have joined").
-- Applied by Claude via the Supabase connection, after 016. A number only, no names.

create or replace function public.get_player_count()
returns bigint
language sql stable security definer
set search_path = public
as $$ select count(*) from public.players $$;

grant execute on function public.get_player_count() to anon, authenticated;

-- 2026-10-15: one-time debug rule (applied by Claude via the Supabase connection).
-- If ABC / ASDF haven't played (no Daily score, no Turbo run) since 2026-10-15 05:00 UTC,
-- they are test accounts: delete them (scores, badges, sessions, Turbo runs go with them).
-- Runs once on 2026-10-16 05:01 UTC via pg_cron, then unschedules itself.
-- Not part of schema.sql: it's a one-off cleanup, not part of the game.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public._debug_cleanup_test_accounts()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_since constant timestamptz := '2026-10-15 05:00:00+00';
begin
  delete from public.players p
  where p.name in ('ABC', 'ASDF')
    and not exists (select 1 from public.scores s where s.player_id = p.id and s.created_at >= v_since)
    and not exists (select 1 from public.turbo_runs t where t.player_id = p.id and t.started_at >= v_since);
  perform cron.unschedule('delete-test-accounts-abc-asdf'); -- one time only
end;
$$;
revoke execute on function public._debug_cleanup_test_accounts() from public, anon, authenticated;

-- minute hour day month weekday (UTC): 2026-10-16 05:01
select cron.schedule('delete-test-accounts-abc-asdf', '1 5 16 10 *', 'select public._debug_cleanup_test_accounts()');

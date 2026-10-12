-- 2026-10-10: game changed from 6 guesses to 21 tries (morsle-style).
-- Run once in Supabase SQL Editor if you ran the original schema.sql.
alter table public.scores drop constraint scores_guesses_check;
alter table public.scores add constraint scores_guesses_check check (guesses between 1 and 22);

-- 2026-10-14: security advisor fix for 008. Pin the search_path of the Turbo helper functions,
-- so they can't be tricked into calling look-alike functions from another schema.
-- They only use built-ins (pg_catalog is always searched) and fully qualified public.* calls.

alter function public._morse(text)               set search_path = '';
alter function public._letter_seconds(text, int) set search_path = '';
alter function public._turbo_wpm(int)            set search_path = '';
alter function public._one_edit(text, text)      set search_path = '';
alter function public._turbo_letter(text)        set search_path = '';

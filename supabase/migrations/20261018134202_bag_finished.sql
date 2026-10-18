-- A bag can be marked finished (empty or used up) without deleting it: its brews and recipes stay.
alter table public.user_beans add column finished_at timestamptz;
grant update (finished_at) on public.user_beans to authenticated;

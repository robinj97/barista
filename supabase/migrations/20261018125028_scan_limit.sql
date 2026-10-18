-- Bag photo scans cost money per call, so each person gets 10 a day (UTC days).
-- scan_usage is only written through claim_scan, which runs as its owner: people can see
-- their own count but cannot change it, so the cap cannot be reset from the app.

create table public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  scans int not null default 0 check (scans >= 0),
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

create policy "people see their own scan count"
  on public.scan_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Counts one scan for the caller and returns how many are left today, or -1 when the
-- day's scans are used up (nothing is counted then). The scan-bag function calls this
-- before it calls Claude.
create or replace function public.claim_scan()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  daily_limit constant int := 10;
  used int;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.scan_usage as su (user_id, day, scans)
  values (me, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set scans = su.scans + 1
    where su.scans < daily_limit
  returning su.scans into used;

  if used is null then
    return -1;
  end if;
  return daily_limit - used;
end;
$$;

revoke execute on function public.claim_scan() from public, anon;
grant execute on function public.claim_scan() to authenticated;

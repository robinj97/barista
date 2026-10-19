-- "Suggest a tweak" (docs/suggest-tweak.md): per-person feature access, the suggestion kept on the
-- working recipe, and a daily cap on suggestions.

-- Feature access: one row per person per feature. People can read their own rows so the app knows
-- what to show; nobody can write them from the app (no write policies), grants are made in SQL.
create table public.feature_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null check (feature in ('suggest_tweak')),
  granted_at timestamptz not null default now(),
  primary key (user_id, feature)
);

alter table public.feature_access enable row level security;

create policy "feature_access: owner reads"
  on public.feature_access for select to authenticated
  using (user_id = (select auth.uid()));

-- Whether the signed-in person has a feature. Used by claim_suggestion and the suggest-tweak function.
create or replace function public.has_feature(name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.feature_access
    where user_id = (select auth.uid()) and feature = name
  )
$$;

revoke execute on function public.has_feature(text) from public, anon;
grant execute on function public.has_feature(text) to authenticated;

-- Robin Jain. A no-op on databases where that profile doesn't exist (local, branches).
insert into public.feature_access (user_id, feature)
select id, 'suggest_tweak' from public.profiles where id = 'ae9cdb8f-bbfd-412f-b2b8-ea1c3e04509a'
on conflict do nothing;

-- The suggestion for the draft's last brew. Written by the suggest-tweak function; the app only
-- sets appliedAt. Saving a draft leaves it alone because the upsert doesn't name the column.
alter table public.recipe_drafts
  add column suggestion jsonb check (suggestion is null or jsonb_typeof(suggestion) = 'object');

-- Suggestions call Claude, so each person gets 20 a day (UTC days). Same pattern as scan_usage:
-- people can see their own count but only claim_suggestion writes it.
create table public.suggest_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  suggestions int not null default 0 check (suggestions >= 0),
  primary key (user_id, day)
);

alter table public.suggest_usage enable row level security;

create policy "people see their own suggestion count"
  on public.suggest_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Counts one suggestion for the caller and returns how many are left today, or -1 when the day's
-- suggestions are used up or the person doesn't have the feature (nothing is counted then).
create or replace function public.claim_suggestion()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  daily_limit constant int := 20;
  used int;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.feature_access where user_id = me and feature = 'suggest_tweak') then
    return -1;
  end if;

  insert into public.suggest_usage as su (user_id, day, suggestions)
  values (me, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set suggestions = su.suggestions + 1
    where su.suggestions < daily_limit
  returning su.suggestions into used;

  if used is null then
    return -1;
  end if;
  return daily_limit - used;
end;
$$;

revoke execute on function public.claim_suggestion() from public, anon;
grant execute on function public.claim_suggestion() to authenticated;

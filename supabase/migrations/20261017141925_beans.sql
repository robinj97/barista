-- Beans: shared catalogue (what the coffee is) and personal library (the bag you bought).

create table public.beans (
  id uuid primary key default gen_random_uuid(),
  roaster text not null,
  name text not null,
  origin text,
  region text,
  producer text,
  variety text,
  process text,
  altitude_m int check (altitude_m is null or altitude_m > 0),
  roaster_notes text[] not null default '{}',
  -- normalised roaster + name, used to suggest matches before creating a new entry
  match_key text generated always as (
    lower(regexp_replace(roaster || name, '[^a-zA-Z0-9]', '', 'g'))
  ) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index beans_match_key_trgm_idx on public.beans using gin (match_key extensions.gin_trgm_ops);
create index beans_created_by_idx on public.beans (created_by);

create table public.user_beans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  bean_id uuid not null references public.beans (id) on delete restrict,
  roast_date date,
  grams_remaining numeric check (grams_remaining is null or grams_remaining >= 0),
  status text not null default 'new' check (status in ('new', 'dialing_in', 'locked')),
  collection text,                          -- your own structure (shelf, folder, tag)
  notes text,
  created_at timestamptz not null default now()
);
create index user_beans_user_idx on public.user_beans (user_id);
create index user_beans_bean_idx on public.user_beans (bean_id);

alter table public.beans enable row level security;
alter table public.user_beans enable row level security;

-- Anyone signed in can read and add catalogue beans. Nobody edits them: personal
-- corrections live on user_beans.
create policy "beans: signed-in can read"
  on public.beans for select to authenticated using (true);
create policy "beans: signed-in can add"
  on public.beans for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "user_beans: owner reads"
  on public.user_beans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_beans: owner adds"
  on public.user_beans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_beans: owner updates"
  on public.user_beans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "user_beans: owner removes"
  on public.user_beans for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.beans, public.user_beans from anon;
revoke update, delete, truncate, references, trigger on public.beans from authenticated;

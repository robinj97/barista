-- Equipment: grinders and filters, plus each user's own list ("my gear").

create table public.grinders (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  unit_label text not null,                 -- 'clicks', 'dial', 'steps'
  min_setting numeric,
  max_setting numeric,
  unique (brand, model)
);

create table public.grinder_calibration (   -- setting -> approximate microns
  grinder_id uuid not null references public.grinders (id) on delete cascade,
  setting numeric not null,
  microns numeric not null check (microns > 0),
  source text not null check (source in ('manufacturer', 'chart', 'learned')),
  primary key (grinder_id, setting)
);

create table public.user_grinders (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  grinder_id uuid not null references public.grinders (id) on delete restrict,
  offset_um numeric not null default 0,     -- personal correction learned from feedback
  nickname text,
  primary key (user_id, grinder_id)
);
create index user_grinders_grinder_idx on public.user_grinders (grinder_id);

create table public.filters (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  size text,                                -- '01', '02', '03' for V60 cones
  material text not null default 'paper' check (material in ('paper', 'metal', 'cloth')),
  flow_class text check (flow_class in ('fast', 'medium', 'slow')),   -- null = unknown
  bleached boolean,
  -- normalised so 'CAFEC T-90' and 'CAFEC T90' collide
  match_key text generated always as (
    lower(regexp_replace(brand || model, '[^a-zA-Z0-9]', '', 'g'))
  ) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique nulls not distinct (match_key, size)
);
create index filters_created_by_idx on public.filters (created_by);

create table public.user_filters (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  filter_id uuid not null references public.filters (id) on delete restrict,
  nickname text,
  is_default boolean not null default false,
  primary key (user_id, filter_id)
);
create index user_filters_filter_idx on public.user_filters (filter_id);
create unique index user_filters_one_default_idx on public.user_filters (user_id) where is_default;

alter table public.grinders enable row level security;
alter table public.grinder_calibration enable row level security;
alter table public.user_grinders enable row level security;
alter table public.filters enable row level security;
alter table public.user_filters enable row level security;

-- Catalogues are readable by any signed-in user. Grinders are curated by migrations.
create policy "grinders: signed-in can read"
  on public.grinders for select to authenticated using (true);
create policy "grinder_calibration: signed-in can read"
  on public.grinder_calibration for select to authenticated using (true);

create policy "filters: signed-in can read"
  on public.filters for select to authenticated using (true);
create policy "filters: signed-in can add"
  on public.filters for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "user_grinders: owner reads"
  on public.user_grinders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_grinders: owner adds"
  on public.user_grinders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_grinders: owner updates"
  on public.user_grinders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "user_grinders: owner removes"
  on public.user_grinders for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "user_filters: owner reads"
  on public.user_filters for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_filters: owner adds"
  on public.user_filters for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_filters: owner updates"
  on public.user_filters for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "user_filters: owner removes"
  on public.user_filters for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.grinders, public.grinder_calibration, public.user_grinders,
  public.filters, public.user_filters from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.grinders, public.grinder_calibration from authenticated;
revoke update, delete, truncate, references, trigger on public.filters from authenticated;

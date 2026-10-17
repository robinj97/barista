-- Recipes (identity), recipe versions (immutable snapshots) and brews (append-only log).
-- See docs/architecture.md section 3 for the invariants this enforces.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  bean_id uuid not null references public.beans (id) on delete restrict,
  method text not null check (method in ('v60', 'aeropress', 'espresso')),
  name text not null,
  locked_version_id uuid,                   -- null = private; set = visible to friends
  archived_at timestamptz,                  -- recipes are archived, never hard-deleted
  created_at timestamptz not null default now()
);
create index recipes_owner_idx on public.recipes (owner_id);
create index recipes_bean_idx on public.recipes (bean_id);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  parent_version_id uuid references public.recipe_versions (id) on delete restrict,
  -- pointer to the friend's version this was copied from; informational only, so no FK
  forked_from_version_id uuid,
  params jsonb not null check (jsonb_typeof(params) = 'object'),
  grind_um numeric not null check (grind_um > 0),
  created_at timestamptz not null default now(),
  unique (id, recipe_id)
);
create index recipe_versions_recipe_idx on public.recipe_versions (recipe_id);
create index recipe_versions_parent_idx on public.recipe_versions (parent_version_id);

-- A locked version must belong to its own recipe (null skips the check).
alter table public.recipes
  add constraint recipes_locked_version_fk
  foreign key (locked_version_id, id)
  references public.recipe_versions (id, recipe_id);

-- Versions are immutable.
create function public.forbid_recipe_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'recipe_versions are immutable' using errcode = 'P0001';
end;
$$;

create trigger recipe_versions_immutable
  before update on public.recipe_versions
  for each row execute function public.forbid_recipe_version_update();

create table public.brews (
  id uuid primary key default gen_random_uuid(),   -- minted on the device so offline writes are idempotent
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  user_bean_id uuid not null references public.user_beans (id) on delete restrict,
  recipe_version_id uuid not null references public.recipe_versions (id) on delete restrict,
  params jsonb not null check (jsonb_typeof(params) = 'object'),   -- what was actually brewed
  actual_time_s int check (actual_time_s is null or actual_time_s > 0),
  yield_ml numeric check (yield_ml is null or yield_ml > 0),
  feedback jsonb,                           -- taste axes, strength, per-note hit/miss
  tuning jsonb,                             -- see docs/tuning.md section 7
  change_applied jsonb,                     -- the change actually made after this brew
  outcome_improved boolean,                 -- filled in when the next brew is logged
  brewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index brews_user_brewed_idx on public.brews (user_id, brewed_at desc);
create index brews_version_idx on public.brews (recipe_version_id);
create index brews_user_bean_idx on public.brews (user_bean_id);

alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.brews enable row level security;

-- recipes: private to the owner; friends see a recipe only while it is locked.
create policy "recipes: owner or friend of a locked recipe can read"
  on public.recipes for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      locked_version_id is not null
      and archived_at is null
      and public.are_friends(owner_id, (select auth.uid()))
    )
  );
create policy "recipes: owner adds"
  on public.recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "recipes: owner updates"
  on public.recipes for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- recipe_versions: the owner reads all; friends read only the currently locked version.
create policy "recipe_versions: owner or friend of the locked version can read"
  on public.recipe_versions for select to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_versions.recipe_id
        and (
          r.owner_id = (select auth.uid())
          or (
            r.locked_version_id = recipe_versions.id
            and r.archived_at is null
            and public.are_friends(r.owner_id, (select auth.uid()))
          )
        )
    )
  );
create policy "recipe_versions: owner adds"
  on public.recipe_versions for insert to authenticated
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_versions.recipe_id
        and r.owner_id = (select auth.uid())
    )
  );

-- brews: private to the user; can only reference the user's own bag and recipe versions.
create policy "brews: owner reads"
  on public.brews for select to authenticated
  using (user_id = (select auth.uid()));
create policy "brews: owner adds"
  on public.brews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_beans ub
      where ub.id = brews.user_bean_id and ub.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.recipe_versions v
      join public.recipes r on r.id = v.recipe_id
      where v.id = brews.recipe_version_id and r.owner_id = (select auth.uid())
    )
  );
create policy "brews: owner updates"
  on public.brews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "brews: owner removes"
  on public.brews for delete to authenticated
  using (user_id = (select auth.uid()));

-- Column-level privileges keep the log append-only in spirit: after insert, only the
-- feedback and outcome fields can change.
revoke all on public.recipes, public.recipe_versions, public.brews from anon;
revoke update, delete, truncate, references, trigger on public.recipes from authenticated;
grant update (name, locked_version_id, archived_at) on public.recipes to authenticated;
revoke update, delete, truncate, references, trigger on public.recipe_versions from authenticated;
revoke update, truncate, references, trigger on public.brews from authenticated;
grant update (actual_time_s, yield_ml, feedback, tuning, change_applied, outcome_improved)
  on public.brews to authenticated;

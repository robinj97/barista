-- Working recipe (one mutable draft per user, bean and method) and locking.
--
-- Until a recipe is locked in, the person's settings for a bean live in ONE row that is
-- overwritten on every brew: no history, so the database does not fill with half-tuned
-- attempts. Locking creates the immutable recipe version and a brew (with its rating) and
-- makes it the recipe's locked version; friends can only ever see locked versions.

create table public.recipe_drafts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  bean_id uuid not null references public.beans (id) on delete cascade,
  method text not null check (method in ('v60', 'aeropress', 'espresso')),
  choices jsonb not null check (jsonb_typeof(choices) = 'object'),   -- the Brew screen's choices and edits
  last_brew jsonb check (last_brew is null or jsonb_typeof(last_brew) = 'object'),   -- the latest brew's result, overwritten each time
  updated_at timestamptz not null default now(),
  primary key (user_id, bean_id, method)
);

alter table public.recipe_drafts enable row level security;

create policy "recipe_drafts: owner reads"
  on public.recipe_drafts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "recipe_drafts: owner adds"
  on public.recipe_drafts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "recipe_drafts: owner updates"
  on public.recipe_drafts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.recipe_drafts from anon;
revoke truncate, references, trigger on public.recipe_drafts from authenticated;

-- Lock a brew in as the person's recipe for this bean and method. One transaction:
-- the recipe (created the first time), a new immutable version, the brew with its rating, and
-- the pointer to the locked version. Idempotent for the same brew id, so an offline retry is safe.
create function public.lock_recipe(
  p_recipe_id uuid,
  p_version_id uuid,
  p_brew_id uuid,
  p_user_bean_id uuid,
  p_method text,
  p_name text,
  p_params jsonb,
  p_grind_um numeric,
  p_brew_params jsonb,
  p_actual_time_s int,
  p_yield_ml numeric,
  p_feedback jsonb,
  p_brewed_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  bean uuid;
  recipe uuid;
  parent uuid;
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select v.recipe_id into recipe
  from public.brews b
  join public.recipe_versions v on v.id = b.recipe_version_id
  where b.id = p_brew_id and b.user_id = me;
  if recipe is not null then
    return recipe;
  end if;

  select ub.bean_id into bean from public.user_beans ub where ub.id = p_user_bean_id and ub.user_id = me;
  if bean is null then
    raise exception 'bag_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'invalid_recipe_name' using errcode = 'P0001';
  end if;

  select r.id, coalesce(r.locked_version_id, (
           select v.id from public.recipe_versions v where v.recipe_id = r.id order by v.created_at desc limit 1))
    into recipe, parent
  from public.recipes r
  where r.owner_id = me and r.bean_id = bean and r.method = p_method and r.archived_at is null
  order by r.created_at
  limit 1;

  if recipe is null then
    insert into public.recipes (id, owner_id, bean_id, method, name)
    values (p_recipe_id, me, bean, p_method, trim(p_name));
    recipe := p_recipe_id;
  end if;

  insert into public.recipe_versions (id, recipe_id, parent_version_id, params, grind_um)
  values (p_version_id, recipe, parent, p_params, p_grind_um);

  insert into public.brews (id, user_id, user_bean_id, recipe_version_id, params, actual_time_s, yield_ml, feedback, brewed_at)
  values (p_brew_id, me, p_user_bean_id, p_version_id, p_brew_params, p_actual_time_s, p_yield_ml, p_feedback, p_brewed_at);

  update public.recipes set locked_version_id = p_version_id where id = recipe;
  return recipe;
end;
$$;

revoke execute on function public.lock_recipe(uuid, uuid, uuid, uuid, text, text, jsonb, numeric, jsonb, int, numeric, jsonb, timestamptz) from public, anon;
grant execute on function public.lock_recipe(uuid, uuid, uuid, uuid, text, text, jsonb, numeric, jsonb, int, numeric, jsonb, timestamptz) to authenticated;

-- One entry per coffee in the shared catalogue.
--
-- Until now only add_bag looked for an existing bean, with no uniqueness rule behind it: two
-- people adding the same bag at the same moment, or anyone inserting a bean straight through the
-- API, could create two entries. This adds:
--   * bean_dedupe_key(roaster, name): lower case, accents dropped, filler words dropped from the
--     roaster (coffee, roasters, roastery, roasting, co, company, the), letters and digits only.
--     "Rogue Wave", "Rogue Wave Coffee" and "Rogue Wave Coffee Roasters" give the same key.
--   * beans.dedupe_key (generated) with a UNIQUE index, so the database refuses a second copy.
--   * add_bag reuses the bean with the same key, and when it loses a race it uses the winner's.
--   * similar_beans(roaster, name): beans that are the same (exact key) or look very alike, for
--     the "is it one of these?" step before a new bean is created.
-- match_key (used by search) is unchanged.

create function public.bean_dedupe_key(p_roaster text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select
    regexp_replace(
      regexp_replace(translate(lower(coalesce(p_roaster, '')), 'àáâãäåçèéêëìíîïñòóôõöøùúûüýÿšž', 'aaaaaaceeeeiiiinoooooouuuuyysz'), '\m(coffee|roasters?|roastery|roasting|co|company|the)\M', '', 'g'),
      '[^a-z0-9]', '', 'g'
    )
    || regexp_replace(translate(lower(coalesce(p_name, '')), 'àáâãäåçèéêëìíîïñòóôõöøùúûüýÿšž', 'aaaaaaceeeeiiiinoooooouuuuyysz'), '[^a-z0-9]', '', 'g');
$$;

alter table public.beans
  add column dedupe_key text generated always as (public.bean_dedupe_key(roaster, name)) stored;

create unique index beans_dedupe_key_key on public.beans (dedupe_key);
create index beans_dedupe_key_trgm_idx on public.beans using gin (dedupe_key extensions.gin_trgm_ops);
alter table public.beans add constraint beans_dedupe_key_not_empty check (dedupe_key <> '');

create or replace function public.add_bag(
  p_bean_id uuid default null,
  p_new_bean jsonb default null,
  p_roast_date date default null,
  p_grams numeric default null,
  p_bag_id uuid default gen_random_uuid(),
  p_new_bean_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  b_id uuid := p_bean_id;
  b_roaster text;
  b_key text;
  b_name text;
  b_notes text[];
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_roast_date is not null and (p_roast_date > current_date or p_roast_date < current_date - 730) then
    raise exception 'invalid_roast_date' using errcode = 'P0001';
  end if;
  if p_grams is not null and (p_grams <= 0 or p_grams > 5000) then
    raise exception 'invalid_bag_size' using errcode = 'P0001';
  end if;

  if b_id is null then
    if p_new_bean is null then
      raise exception 'bean_required' using errcode = 'P0001';
    end if;
    b_roaster := btrim(coalesce(p_new_bean ->> 'roaster', ''));
    b_name := btrim(coalesce(p_new_bean ->> 'name', ''));
    if char_length(b_roaster) not between 1 and 80 or char_length(b_name) not between 1 and 120 then
      raise exception 'invalid_bean_name' using errcode = 'P0001';
    end if;

    select array(
      select left(btrim(n), 40)
      from jsonb_array_elements_text(coalesce(p_new_bean -> 'roaster_notes', '[]'::jsonb)) as n
      where btrim(n) <> ''
    ) into b_notes;
    if cardinality(b_notes) > 12 then
      raise exception 'too_many_notes' using errcode = 'P0001';
    end if;

    -- The same coffee spelled a little differently ("Rogue Wave" / "Rogue Wave Coffee Roasters",
    -- Café / Cafe) has the same dedupe key and reuses the existing bean.
    b_key := public.bean_dedupe_key(b_roaster, b_name);
    select b.id into b_id from public.beans b where b.dedupe_key = b_key order by b.created_at limit 1;

    if b_id is null then
      b_id := p_new_bean_id;
      insert into public.beans (
        id, roaster, name, origin, region, producer, variety, process,
        altitude_m, roast_level, roaster_notes
      )
      values (
        b_id, b_roaster, b_name,
        nullif(btrim(p_new_bean ->> 'origin'), ''),
        nullif(btrim(p_new_bean ->> 'region'), ''),
        nullif(btrim(p_new_bean ->> 'producer'), ''),
        nullif(btrim(p_new_bean ->> 'variety'), ''),
        nullif(btrim(p_new_bean ->> 'process'), ''),
        nullif(p_new_bean ->> 'altitude_m', '')::int,
        nullif(p_new_bean ->> 'roast_level', ''),
        b_notes
      )
      on conflict do nothing;
      -- Someone else may have added it a moment ago (the unique key stopped a second copy): use theirs.
      select b.id into b_id from public.beans b where b.dedupe_key = b_key order by b.created_at limit 1;
    end if;
  end if;

  insert into public.user_beans (id, bean_id, roast_date, grams_remaining)
  values (p_bag_id, b_id, p_roast_date, p_grams)
  on conflict (id) do nothing;

  if not exists (select 1 from public.user_beans ub where ub.id = p_bag_id and ub.user_id = me) then
    raise exception 'bag_not_saved' using errcode = 'P0001';
  end if;

  return p_bag_id;
end;
$$;

create function public.similar_beans(p_roaster text, p_name text)
returns table (
  id uuid,
  roaster text,
  name text,
  origin text,
  region text,
  producer text,
  variety text,
  process text,
  altitude_m int,
  roast_level text,
  roaster_notes text[],
  owned boolean,
  friends_with_recipe int,
  exact boolean,
  score real
)
language sql
stable
set search_path = ''
as $$
  with p as (select public.bean_dedupe_key(p_roaster, p_name) as key)
  select
    b.id, b.roaster, b.name, b.origin, b.region, b.producer, b.variety, b.process,
    b.altitude_m, b.roast_level, b.roaster_notes,
    exists (
      select 1 from public.user_beans ub
      where ub.bean_id = b.id and ub.user_id = (select auth.uid())
    ) as owned,
    (
      select count(distinct r.owner_id)::int
      from public.recipes r
      where r.bean_id = b.id
        and r.locked_version_id is not null
        and r.archived_at is null
        and r.owner_id <> (select auth.uid())
    ) as friends_with_recipe,
    (b.dedupe_key = p.key) as exact,
    extensions.similarity(b.dedupe_key, p.key) as score
  from public.beans b, p
  where p.key <> ''
    and (b.dedupe_key = p.key or extensions.similarity(b.dedupe_key, p.key) >= 0.6)
  order by (b.dedupe_key = p.key) desc, score desc
  limit 3;
$$;

revoke execute on function public.bean_dedupe_key(text, text) from public, anon;
grant execute on function public.bean_dedupe_key(text, text) to authenticated;
revoke execute on function public.similar_beans(text, text) from public, anon;
grant execute on function public.similar_beans(text, text) to authenticated;
revoke execute on function public.add_bag(uuid, jsonb, date, numeric, uuid, uuid) from public, anon;
grant execute on function public.add_bag(uuid, jsonb, date, numeric, uuid, uuid) to authenticated;

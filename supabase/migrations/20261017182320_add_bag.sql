-- Adding a bag: roast level on the shared bean, catalogue search, and an atomic add_bag.
-- See docs/add-bean.md. The shared catalogue holds only static facts about the coffee;
-- roast date and bag size live on the private user_beans row.

alter table public.beans
  add column roast_level text check (roast_level in ('light', 'medium', 'dark')),
  add constraint beans_roaster_length check (char_length(btrim(roaster)) between 1 and 80),
  add constraint beans_name_length check (char_length(btrim(name)) between 1 and 120),
  add constraint beans_notes_count check (cardinality(roaster_notes) <= 12);

-- Catalogue search: every word must appear in roaster + name (any order), or the whole
-- query must be similar. Also reports whether you already own the bean and how many
-- friends have a locked recipe for it (visibility comes from the recipe policies).
create function public.search_beans(q text, max_results int default 20)
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
  score real
)
language sql
stable
set search_path = ''
as $$
  with p as (
    select
      lower(regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9]', '', 'g')) as key,
      array(
        select regexp_replace(t, '[^a-z0-9]', '', 'g')
        from unnest(string_to_array(lower(coalesce(q, '')), ' ')) as t
        where regexp_replace(t, '[^a-z0-9]', '', 'g') <> ''
      ) as tokens
  )
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
    extensions.similarity(b.match_key, p.key) as score
  from public.beans b, p
  where cardinality(p.tokens) > 0
    and (
      not exists (select 1 from unnest(p.tokens) as t where b.match_key not like '%' || t || '%')
      or extensions.similarity(b.match_key, p.key) > 0.3
    )
  order by score desc, b.roaster, b.name
  limit least(greatest(max_results, 1), 50);
$$;

-- Adds a bag to the caller's inventory, creating the shared catalogue bean first when needed.
-- One transaction, runs as the caller so row-level security still applies. Safe to retry:
-- the client mints the ids. An exact roaster + name match reuses the existing catalogue bean.
create function public.add_bag(
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

    select b.id into b_id
    from public.beans b
    where b.match_key = lower(regexp_replace(b_roaster || b_name, '[^a-zA-Z0-9]', '', 'g'))
    order by b.created_at
    limit 1;

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
      on conflict (id) do nothing;
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

revoke execute on function public.search_beans(text, int) from public, anon;
grant execute on function public.search_beans(text, int) to authenticated;
revoke execute on function public.add_bag(uuid, jsonb, date, numeric, uuid, uuid) from public, anon;
grant execute on function public.add_bag(uuid, jsonb, date, numeric, uuid, uuid) to authenticated;

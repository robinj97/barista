-- Fuzzy matching in search_beans: compare the query with the best-matching part of
-- "roaster + name" (word_similarity) instead of the whole string. Whole-string trigram
-- similarity was too low for short queries against long keys ("eltoo arbegonna" scored
-- 0.27; word_similarity scores it 0.53, while unrelated words score 0 to 0.22).

create or replace function public.search_beans(q text, max_results int default 20)
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
    extensions.word_similarity(p.key, b.match_key) as score
  from public.beans b, p
  where cardinality(p.tokens) > 0
    and (
      not exists (select 1 from unnest(p.tokens) as t where b.match_key not like '%' || t || '%')
      or extensions.word_similarity(p.key, b.match_key) > 0.45
    )
  order by score desc, b.roaster, b.name
  limit least(greatest(max_results, 1), 50);
$$;

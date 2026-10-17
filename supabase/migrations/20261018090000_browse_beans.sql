-- The whole catalogue in alphabetical order (roaster, then name), for the add-bag sheet to
-- show before you type and to narrow on the device as you do. Same row shape as
-- search_beans without the score. Capped so a large catalogue stays a sensible download;
-- the app falls back to search_beans when the cap is hit.

create or replace function public.browse_beans(max_results int default 1000)
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
  friends_with_recipe int
)
language sql
stable
set search_path = ''
as $$
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
    ) as friends_with_recipe
  from public.beans b
  order by lower(b.roaster), lower(b.name)
  limit least(greatest(max_results, 1), 5000);
$$;

revoke execute on function public.browse_beans(int) from public, anon;
grant execute on function public.browse_beans(int) to authenticated;

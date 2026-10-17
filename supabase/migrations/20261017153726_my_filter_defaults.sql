-- Keeps "a non-empty filter list has exactly one default" true on add and remove.
-- Both run as the caller (security invoker), so row-level security still applies.
-- A per-user advisory lock serialises them so two quick adds cannot both claim the default.

-- Adds a catalogue filter to the caller's list. It becomes the default when the list has none.
-- Adding a filter that is already in the list does nothing.
create function public.add_my_filter(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('user_filters:' || me::text, 0));

  insert into public.user_filters (filter_id, is_default)
  values (
    target,
    not exists (select 1 from public.user_filters where user_id = me and is_default)
  )
  on conflict (user_id, filter_id) do nothing;
end;
$$;

-- Removes a filter from the caller's list. Removing the default promotes another filter.
create function public.remove_my_filter(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('user_filters:' || me::text, 0));

  delete from public.user_filters where user_id = me and filter_id = target;

  if not exists (select 1 from public.user_filters where user_id = me and is_default) then
    update public.user_filters
    set is_default = true
    where user_id = me
      and filter_id = (
        select uf.filter_id
        from public.user_filters uf
        join public.filters f on f.id = uf.filter_id
        where uf.user_id = me
        order by f.brand, f.model, f.size nulls first
        limit 1
      );
  end if;
end;
$$;

revoke execute on function public.add_my_filter(uuid) from public, anon;
grant execute on function public.add_my_filter(uuid) to authenticated;
revoke execute on function public.remove_my_filter(uuid) from public, anon;
grant execute on function public.remove_my_filter(uuid) to authenticated;

-- Lists left without a default by earlier removals get one.
update public.user_filters uf
set is_default = true
where uf.filter_id = (
    select x.filter_id
    from public.user_filters x
    join public.filters f on f.id = x.filter_id
    where x.user_id = uf.user_id
    order by f.brand, f.model, f.size nulls first
    limit 1
  )
  and not exists (
    select 1 from public.user_filters d where d.user_id = uf.user_id and d.is_default
  );

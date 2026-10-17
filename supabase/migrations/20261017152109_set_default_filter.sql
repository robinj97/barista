-- Makes one of the caller's filters the default, atomically. Runs as the caller (security
-- invoker), so row-level security still applies.
create function public.set_default_filter(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.user_filters
  set is_default = false
  where user_id = (select auth.uid()) and is_default and filter_id <> target;

  update public.user_filters
  set is_default = true
  where user_id = (select auth.uid()) and filter_id = target;

  if not found then
    raise exception 'filter_not_in_list' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.set_default_filter(uuid) from public, anon;
grant execute on function public.set_default_filter(uuid) to authenticated;

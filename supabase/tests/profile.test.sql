-- Profile preference and gear checks. Same style as rls.test.sql: one DO block, ends by
-- raising PROFILE_TESTS_PASSED so everything rolls back. Any other message is a failure.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  f1 uuid;
  f2 uuid;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'a@test.local', jsonb_build_object('full_name', repeat('x', 200))),
    (b, 'b@test.local', '{}');

  -- the sign-up trigger copes with an absurdly long name and applies defaults
  select char_length(display_name) into n from public.profiles where id = a;
  assert n = 60, 'long names are truncated to 60 characters';
  select count(*) into n from public.profiles where id = a and temp_unit = 'c' and default_method = 'v60';
  assert n = 1, 'new profiles default to C and V60';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.profiles set temp_unit = 'f', default_method = 'aeropress', display_name = 'Robin' where id = a;
  get diagnostics n = row_count;
  assert n = 1, 'owner can update their own preferences';

  failed := false;
  begin
    update public.profiles set temp_unit = 'k' where id = a;
  exception when others then failed := true;
  end;
  assert failed, 'unknown temperature unit is rejected';

  failed := false;
  begin
    update public.profiles set default_method = 'chemex' where id = a;
  exception when others then failed := true;
  end;
  assert failed, 'unknown method is rejected';

  failed := false;
  begin
    update public.profiles set display_name = '   ' where id = a;
  exception when others then failed := true;
  end;
  assert failed, 'blank display name is rejected';

  failed := false;
  begin
    update public.profiles set display_name = repeat('y', 61) where id = a;
  exception when others then failed := true;
  end;
  assert failed, 'display name over 60 characters is rejected';

  failed := false;
  begin
    update public.profiles set created_at = now() where id = a;
  exception when others then failed := true;
  end;
  assert failed, 'other profile columns stay read-only';

  -- gear: two filters, one default at a time
  insert into public.filters (brand, model, size) values ('Test', 'One', '02') returning id into f1;
  insert into public.filters (brand, model, size) values ('Test', 'Two', '02') returning id into f2;
  insert into public.user_filters (filter_id, is_default) values (f1, true);
  insert into public.user_filters (filter_id) values (f2);

  perform public.set_default_filter(f2);
  select count(*) into n from public.user_filters where is_default;
  assert n = 1, 'exactly one default filter';
  select count(*) into n from public.user_filters where is_default and filter_id = f2;
  assert n = 1, 'the chosen filter is the default';

  failed := false;
  begin
    perform public.set_default_filter(gen_random_uuid());
  exception when others then failed := true;
  end;
  assert failed, 'cannot default a filter that is not in your list';
  select count(*) into n from public.user_filters where is_default and filter_id = f2;
  assert n = 1, 'a failed default change leaves the default alone';

  -- B cannot touch A's profile or gear
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set temp_unit = 'c' where id = a;
  get diagnostics n = row_count;
  assert n = 0, 'a friend or stranger cannot edit your profile';
  select count(*) into n from public.user_filters;
  assert n = 0, 'filter lists are private';
  failed := false;
  begin
    perform public.set_default_filter(f1);
  exception when others then failed := true;
  end;
  assert failed, 'cannot default a filter you do not have';

  -- anon cannot call it at all
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  failed := false;
  begin
    perform public.set_default_filter(f1);
  exception when others then failed := true;
  end;
  assert failed, 'anon cannot call set_default_filter';

  reset role;
  raise exception 'PROFILE_TESTS_PASSED';
end;
$$;

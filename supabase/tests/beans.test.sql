-- Beans: search_beans, browse_beans, add_bag and the static-versus-private split. Same style as the other
-- tests: one DO block, ends by raising BEANS_TESTS_PASSED so everything rolls back.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  bag_a uuid := gen_random_uuid();
  bag_b uuid := gen_random_uuid();
  bean uuid;
  bean_again uuid;
  recipe uuid;
  version uuid;
  got uuid;
  n int;
  r record;
  failed boolean;
begin
  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local'), (c, 'c@test.local');
  insert into public.friendships (user_a, user_b)
  values (least(a, b), greatest(a, b));   -- A and B are friends; C is a stranger

  -- A adds a brand-new bean and a bag --------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  got := public.add_bag(
    p_new_bean := '{"roaster":"  Coffea Circulor ","name":"Elto Arbegona","origin":"Ethiopia","region":"Sidama","process":"Washed","roast_level":"light","roaster_notes":["bergamot","tangerine"]}',
    p_roast_date := current_date - 5,
    p_grams := 250,
    p_bag_id := bag_a
  );
  assert got = bag_a, 'add_bag returns the bag id';
  select ub.bean_id into bean from public.user_beans ub where ub.id = bag_a;
  select count(*) into n from public.beans where id = bean and roaster = 'Coffea Circulor' and roast_level = 'light' and cardinality(roaster_notes) = 2;
  assert n = 1, 'the catalogue bean is created and trimmed';
  select count(*) into n from public.user_beans where id = bag_a and grams_remaining = 250 and roast_date = current_date - 5 and status = 'new';
  assert n = 1, 'the bag keeps the variable details';

  -- retrying the same call changes nothing
  perform public.add_bag(p_new_bean := '{"roaster":"Coffea Circulor","name":"Elto Arbegona"}', p_bag_id := bag_a);
  select count(*) into n from public.user_beans where id = bag_a;
  assert n = 1, 'add_bag is idempotent for the same bag id';
  select count(*) into n from public.beans;
  assert n = 1, 'a retry does not create a second catalogue bean';

  -- validation ---------------------------------------------------------------------
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"  "}'); exception when others then failed := true; end;
  assert failed, 'a blank name is rejected';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y"}', p_roast_date := current_date + 1); exception when others then failed := true; end;
  assert failed, 'a future roast date is rejected';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y"}', p_roast_date := current_date - 800); exception when others then failed := true; end;
  assert failed, 'a roast date over two years old is rejected';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y"}', p_grams := 0); exception when others then failed := true; end;
  assert failed, 'a zero bag size is rejected';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y"}', p_grams := 6000); exception when others then failed := true; end;
  assert failed, 'an oversized bag is rejected';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y","roast_level":"burnt"}'); exception when others then failed := true; end;
  assert failed, 'an unknown roast level is rejected';
  failed := false;
  begin
    perform public.add_bag(p_new_bean := jsonb_build_object('roaster', 'X', 'name', 'Y',
      'roaster_notes', (select jsonb_agg('n' || i) from generate_series(1, 13) i)));
  exception when others then failed := true; end;
  assert failed, 'more than 12 tasting notes are rejected';
  failed := false;
  begin perform public.add_bag(); exception when others then failed := true; end;
  assert failed, 'a bean or new bean is required';
  select count(*) into n from public.beans;
  assert n = 1, 'failed adds leave no catalogue beans behind';

  -- A's friend recipe signal: a locked recipe for the bean ------------------------------
  insert into public.recipes (bean_id, method, name) values (bean, 'v60', 'A v60') returning id into recipe;
  insert into public.recipe_versions (recipe_id, params, grind_um) values (recipe, '{}', 800) returning id into version;
  update public.recipes set locked_version_id = version where id = recipe;

  select * into r from public.search_beans('elto');
  assert r.owned, 'owner sees owned = true';
  assert r.friends_with_recipe = 0, 'your own locked recipe is not counted as a friend';

  -- B: search, friend signal, reuse of the catalogue bean --------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select * into r from public.search_beans('elto');
  assert r.id = bean and not r.owned and r.friends_with_recipe = 1, 'a friend with a locked recipe is reported';
  select count(*) into n from public.search_beans('arbegona coffea');
  assert n = 1, 'word order does not matter';
  select count(*) into n from public.search_beans('Coffea Circulor Elto Arbegona');
  assert n = 1, 'full names match';
  select count(*) into n from public.search_beans('eltoo arbegonna');
  assert n = 1, 'small typos still match by similarity';
  select count(*) into n from public.search_beans('zzzzz');
  assert n = 0, 'unrelated queries match nothing';
  select count(*) into n from public.search_beans('   ');
  assert n = 0, 'a blank query matches nothing';
  select count(*) into n from public.search_beans('%_');
  assert n = 0, 'wildcard characters are not special';
  select count(*) into n from public.search_beans('colombia');
  assert n = 0, 'a different origin word does not match';
  select * into r from public.browse_beans() where id = bean;
  assert not r.owned and r.friends_with_recipe = 1, 'browse_beans carries the same owned and friend signals';
  select count(*) into n from public.browse_beans(1);
  assert n = 1, 'browse_beans respects its cap';

  perform public.add_bag(p_new_bean := '{"roaster":"coffea  circulor","name":"ELTO arbegona!"}', p_bag_id := bag_b);
  select count(*) into n from public.beans;
  assert n = 1, 'the same coffee in different spelling reuses the catalogue bean';
  select ub.bean_id into bean_again from public.user_beans ub where ub.id = bag_b;
  assert bean_again = bean, 'B own bag points at the shared bean';
  select * into r from public.search_beans('elto');
  assert r.owned, 'B now owns it too';

  -- the shared bean carries no variable details; bags are private --------------------------
  select count(*) into n from public.user_beans;
  assert n = 1, 'B only sees their own bag';
  select count(*) into n from public.user_beans where id = bag_a;
  assert n = 0, 'B cannot see A''s bag';
  failed := false;
  begin update public.beans set name = 'Hijacked' where id = bean; exception when others then failed := true; end;
  assert failed, 'nobody edits catalogue beans';
  failed := false;
  begin perform public.add_bag(p_bean_id := bean, p_bag_id := bag_a); exception when others then failed := true; end;
  assert failed, 'a bag id that belongs to someone else cannot be claimed';

  -- C: a stranger sees the bean but no friend signal -------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into r from public.search_beans('elto');
  assert r.friends_with_recipe = 0 and not r.owned, 'a stranger gets no friend signal';

  -- anon gets nothing --------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  failed := false;
  begin perform * from public.search_beans('elto'); exception when others then failed := true; end;
  assert failed, 'anon cannot search';
  failed := false;
  begin perform public.add_bag(p_new_bean := '{"roaster":"X","name":"Y"}'); exception when others then failed := true; end;
  assert failed, 'anon cannot add bags';

  reset role;
  raise exception 'BEANS_TESTS_PASSED';
end;
$$;

-- Drafts and locking: one mutable draft per bean, lock_recipe creates immutable versions,
-- friends see only the locked version. Rolled back at the end (raises LOCK_TESTS_PASSED).

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  bag_a uuid := gen_random_uuid();
  bean uuid;
  rec1 uuid;
  rec2 uuid;
  v1 uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid();
  brew1 uuid := gen_random_uuid();
  brew2 uuid := gen_random_uuid();
  n int;
  failed boolean;
begin
  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local'), (c, 'c@test.local');
  insert into public.friendships (user_a, user_b) values (least(a, b), greatest(a, b));

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.add_bag(p_new_bean := '{"roaster":"R","name":"N"}', p_bag_id := bag_a);
  select ub.bean_id into bean from public.user_beans ub where ub.id = bag_a;

  -- the draft is one row per bean and method, overwritten --------------------------------
  insert into public.recipe_drafts (bean_id, method, choices) values (bean, 'v60', '{"cups":2}')
  on conflict (user_id, bean_id, method) do update set choices = excluded.choices;
  insert into public.recipe_drafts (bean_id, method, choices, last_brew) values (bean, 'v60', '{"cups":3}', '{"taste":"good"}')
  on conflict (user_id, bean_id, method) do update set choices = excluded.choices, last_brew = excluded.last_brew;
  select count(*) into n from public.recipe_drafts where choices = '{"cups":3}' and last_brew is not null;
  assert n = 1, 'the draft is overwritten, not appended';
  select count(*) into n from public.recipe_drafts;
  assert n = 1, 'still one draft';

  -- lock: creates the recipe, a version and a brew ---------------------------------------
  rec1 := public.lock_recipe(gen_random_uuid(), v1, brew1, bag_a, 'v60', 'My V60', '{"doseG":20}', 800, '{"doseG":20}', 170, 260, '{"rating":4}');
  select count(*) into n from public.recipes where id = rec1 and locked_version_id = v1;
  assert n = 1, 'the recipe is locked to the new version';
  select count(*) into n from public.brews where id = brew1 and feedback = '{"rating":4}';
  assert n = 1, 'the brew is stored with its rating';

  -- retrying the same brew changes nothing
  rec2 := public.lock_recipe(gen_random_uuid(), gen_random_uuid(), brew1, bag_a, 'v60', 'My V60', '{"doseG":20}', 800, '{"doseG":20}', 170, 260, '{"rating":4}');
  assert rec2 = rec1, 'idempotent for the same brew id';
  select count(*) into n from public.recipe_versions;
  assert n = 1, 'a retry adds no version';

  -- locking again adds a version on the same recipe, with the old one as parent
  rec2 := public.lock_recipe(gen_random_uuid(), v2, brew2, bag_a, 'v60', 'ignored', '{"doseG":18}', 780, '{"doseG":18}', 160, null, '{"rating":5}');
  assert rec2 = rec1, 'the same recipe is reused for the bean and method';
  select count(*) into n from public.recipe_versions where id = v2 and parent_version_id = v1;
  assert n = 1, 'the new version points to the previous one';
  select count(*) into n from public.recipes where id = rec1 and locked_version_id = v2;
  assert n = 1, 'the lock moves to the newest version';

  -- versions are immutable
  failed := false;
  begin update public.recipe_versions set grind_um = 1 where id = v1; exception when others then failed := true; end;
  assert failed, 'versions cannot be changed';

  -- validation
  failed := false;
  begin perform public.lock_recipe(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'v60', 'x', '{}', 800, '{}', null, null, null); exception when others then failed := true; end;
  assert failed, 'a bag that is not yours is refused';

  -- visibility: a friend sees the locked version only, a stranger nothing, nobody sees drafts
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.recipes where id = rec1;
  assert n = 1, 'a friend sees the locked recipe';
  select count(*) into n from public.recipe_versions where id = v2;
  assert n = 1, 'a friend sees the locked version';
  select count(*) into n from public.recipe_versions where id = v1;
  assert n = 0, 'a friend does not see older versions';
  select count(*) into n from public.recipe_drafts;
  assert n = 0, 'drafts are private';
  select count(*) into n from public.brews;
  assert n = 0, 'brews are private';

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.recipes;
  assert n = 0, 'a stranger sees nothing';

  raise exception 'LOCK_TESTS_PASSED';
end;
$$;

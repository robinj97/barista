-- RLS and invariants test. Run against a database with the migrations applied, for
-- example through the Supabase SQL editor or the MCP execute_sql tool.
--
-- Everything happens inside one DO block and ends by raising RLS_TESTS_PASSED, which
-- rolls the transaction back, so no test data is left behind. Any failed assertion
-- raises a different message instead.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  bean_id uuid;
  bean_b uuid;
  ub_a uuid;
  ub_b uuid;
  recipe_id uuid;
  version_id uuid;
  recipe2_id uuid;
  version2_id uuid;
  brew_id uuid;
  tok text;
  tok2 text;
  tok3 text;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email) values
    (a, 'a@test.local'), (b, 'b@test.local'), (c, 'c@test.local');

  select count(*) into n from public.profiles where id in (a, b, c);
  assert n = 3, 'profiles are created by the auth trigger';

  -- A builds a bean, bag, recipe, version and brew ---------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.beans (roaster, name) values ('Test Roaster', 'Test Bean') returning id into bean_id;
  insert into public.user_beans (bean_id) values (bean_id) returning id into ub_a;
  insert into public.recipes (bean_id, method, name) values (bean_id, 'v60', 'A recipe') returning id into recipe_id;
  insert into public.recipe_versions (recipe_id, params, grind_um) values (recipe_id, '{"dose_g": 20}', 800) returning id into version_id;
  insert into public.brews (user_bean_id, recipe_version_id, params) values (ub_a, version_id, '{"dose_g": 20}') returning id into brew_id;

  -- invites ---------------------------------------------------------------
  tok := public.create_invite();
  tok2 := public.create_invite();
  tok3 := public.create_invite();
  select count(*) into n from public.invites;
  assert n = 3, 'inviter can see own invites (hashes only)';

  failed := false;
  begin
    perform public.accept_invite(tok2);
  exception when others then failed := true;
  end;
  assert failed, 'cannot accept your own invite';

  reset role;
  update public.invites set expires_at = now() - interval '1 day'
  where token_hash = encode(extensions.digest(tok3, 'sha256'), 'hex');

  -- B and C --------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  failed := false;
  begin
    perform public.accept_invite(tok3);
  exception when others then failed := true;
  end;
  assert failed, 'expired invite is rejected';
  failed := false;
  begin
    perform public.accept_invite('not-a-real-token');
  exception when others then failed := true;
  end;
  assert failed, 'unknown token is rejected';
  select count(*) into n from public.invites;
  assert n = 0, 'a stranger cannot read invites';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  failed := false;
  begin
    perform public.accept_invite(tok);
  exception when others then failed := true;
  end;
  assert failed, 'invite is single-use';
  select count(*) into n from public.friendships;
  assert n = 1, 'accepting creates one friendship';

  -- visibility before locking: nobody but A sees the recipe ------------------
  select count(*) into n from public.recipes where id = recipe_id;
  assert n = 0, 'friend cannot see an unlocked recipe';
  select count(*) into n from public.recipe_versions where id = version_id;
  assert n = 0, 'friend cannot see an unlocked version';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- A creates a second recipe and tries to lock the wrong version -----------------
  insert into public.recipes (bean_id, method, name) values (bean_id, 'v60', 'Other') returning id into recipe2_id;
  insert into public.recipe_versions (recipe_id, params, grind_um) values (recipe2_id, '{}', 700) returning id into version2_id;
  failed := false;
  begin
    update public.recipes set locked_version_id = version2_id where id = recipe_id;
  exception when others then failed := true;
  end;
  assert failed, 'cannot lock a version that belongs to another recipe';

  failed := false;
  begin
    update public.recipe_versions set grind_um = 900 where id = version_id;
  exception when others then failed := true;
  end;
  assert failed, 'recipe versions cannot be updated by clients';

  failed := false;
  begin
    update public.brews set params = '{}' where id = brew_id;
  exception when others then failed := true;
  end;
  assert failed, 'brew parameters cannot be rewritten';
  update public.brews set outcome_improved = true where id = brew_id;
  get diagnostics n = row_count;
  assert n = 1, 'brew outcome can be filled in later';

  -- A locks the right version ----------------------------------------------
  update public.recipes set locked_version_id = version_id where id = recipe_id;
  get diagnostics n = row_count;
  assert n = 1, 'owner can lock their own version';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.recipes where id = recipe_id;
  assert n = 1, 'friend sees a locked recipe';
  select count(*) into n from public.recipe_versions where id = version_id;
  assert n = 1, 'friend sees the locked version';
  select count(*) into n from public.recipes where id = recipe2_id;
  assert n = 0, 'friend still cannot see the unlocked recipe';
  select count(*) into n from public.recipe_versions where id = version2_id;
  assert n = 0, 'friend still cannot see other versions';
  select count(*) into n from public.profiles where id = a;
  assert n = 1, 'friends can read each other''s profile';
  select count(*) into n from public.brews where id = brew_id;
  assert n = 0, 'brews are never visible to friends';

  update public.recipes set name = 'hijacked' where id = recipe_id;
  get diagnostics n = row_count;
  assert n = 0, 'friend cannot edit the recipe';

  insert into public.beans (roaster, name) values ('B Roaster', 'B Bean') returning id into bean_b;
  insert into public.user_beans (bean_id) values (bean_b) returning id into ub_b;
  failed := false;
  begin
    insert into public.brews (user_bean_id, recipe_version_id, params) values (ub_b, version_id, '{}');
  exception when others then failed := true;
  end;
  assert failed, 'cannot log a brew against a friend''s version directly (fork first)';

  failed := false;
  begin
    insert into public.filters (brand, model, created_by) values ('Spoof', 'Filter', a);
  exception when others then failed := true;
  end;
  assert failed, 'cannot add catalogue entries in someone else''s name';
  insert into public.filters (brand, model) values ('CAFEC', 'T-90');
  failed := false;
  begin
    insert into public.filters (brand, model) values ('CAFEC', 'T90');
  exception when others then failed := true;
  end;
  assert failed, 'duplicate filters collide on the normalised key';

  failed := false;
  begin
    perform private.are_friends(a, b);
  exception when others then failed := true;
  end;
  assert not failed, 'policies can still call the private helper';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.recipes where id = recipe_id;
  assert n = 0, 'non-friend cannot see a locked recipe';
  select count(*) into n from public.recipe_versions where id = version_id;
  assert n = 0, 'non-friend cannot see a locked version';
  select count(*) into n from public.profiles where id = a;
  assert n = 0, 'non-friend cannot read profiles';
  select count(*) into n from public.beans;
  assert n = 2, 'any signed-in user can read the bean catalogue';

  -- archiving hides a locked recipe from friends --------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.recipes set archived_at = now() where id = recipe_id;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.recipes where id = recipe_id;
  assert n = 0, 'archived recipes disappear for friends';

  -- anonymous users get nothing -----------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  failed := false;
  begin
    perform count(*) from public.beans;
  exception when others then failed := true;
  end;
  assert failed, 'anon cannot read beans';
  failed := false;
  begin
    perform public.create_invite();
  exception when others then failed := true;
  end;
  assert failed, 'anon cannot create invites';
  failed := false;
  begin
    perform private.are_friends(a, b);
  exception when others then failed := true;
  end;
  assert failed, 'anon cannot reach the private schema';

  reset role;
  raise exception 'RLS_TESTS_PASSED';
end;
$$;
